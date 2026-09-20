/**
 * JEV adapter. Vercel AI Gateway, model typesafe-ai/jev. v3 §六 / §十三.
 *
 * Verified against the live contract on 2026-09-20
 * (docs/evidence/gateway-contract-spike-2026-09-20.md):
 *   - boolean answers carry `probability` only; there is no confidence. Correct.
 *   - choice/score carry `probabilities`; `legend` and `rounding` are ABSENT, so
 *     level descriptions stay in our own schema.
 *   - confidence appears BOTH inline and in providerMetadata.typesafe.confidence.
 *     providerMetadata is canonical; a mismatch is a conflict, not a coin toss.
 *   - `model` echoes "typesafe-ai/jev" — the upstream version is never exposed.
 */
import { assertHobbySafe, assertProductState, PRODUCT_STATE_ALLOWLIST,
         parseTaskRequest, projectTradeoffState, buildTradeoffPayload, type ProductState, type OutboundContext } from "./privacy.ts";
import type { Band, Judgment, JudgmentProvenance, Verdict, TradeoffJudgment, TradeoffResult } from "./types.ts";

export const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/evaluate";
export const MODEL_ID = "typesafe-ai/jev";
export const TIMEOUT_MS = 8_000;
const SDK_VERSION = "not_used (native fetch; HTTP /v1/evaluate)";

export type BooleanQ = { type: "boolean"; instructions: string; criteria?: { true: string; false: string } };
export type ChoiceQ = { type: "choice"; instructions: string; criteria: Record<string, string> };
export type ScoreQ = { type: "score"; instructions: string; criteria: string[] };
export type Question = BooleanQ | ChoiceQ | ScoreQ;

export interface EvaluateResponse {
  model: string;
  answers: Record<string, any>;
  usage?: { inputTokens: number; outputTokens: number };
  providerMetadata?: { typesafe?: { confidence?: Record<string, number> }; gateway?: any };
}

export interface JevTransport {
  (body: unknown, signal: AbortSignal): Promise<EvaluateResponse>;
}

/** Real transport. ZDR is unavailable on hobby, so we send disallowPromptTraining —
 *  which is NOT the same thing and must never be described as zero retention. */
export const gatewayTransport: JevTransport = async (body, signal) => {
  // Exported transport must not let callers bypass the adapter's egress guard.
  assertHobbySafe(body);
  const key = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!key) throw new Error("no gateway credential");
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`gateway ${res.status}`);
  return (await res.json()) as EvaluateResponse;
};

// ------------------------------------------------------------ thresholds
// Provisional. NOT calibrated. Until D2 runs, output is prototype judgment,
// never validated recommendation. v3 §八.

export const THRESHOLDS = {
  hardConstraint: { yes: 0.85, no: 0.15 },
  soft: { yes: 0.75, no: 0.25 },
  scoreConfidence: { accept: 0.7, caveat: 0.45 },
} as const;

export function bandForBoolean(p: number, hard: boolean): { verdict: Verdict; band: Band } {
  const t = hard ? THRESHOLDS.hardConstraint : THRESHOLDS.soft;
  if (p >= t.yes) return { verdict: "yes", band: "high" };
  if (p <= t.no) return { verdict: "no", band: "low" };
  return { verdict: "unknown", band: "dead" };
}

/** providerMetadata is canonical; if the inline value disagrees, that is a conflict
 *  and the judgment degrades to unknown. We do not pick a side. v3 §14.1 B-4 */
export function resolveConfidence(
  id: string, inline: number | undefined, meta: Record<string, number> | undefined,
): { confidence?: number; conflict?: string } {
  const m = meta?.[id];
  if (m === undefined && inline === undefined) return {};
  if ((m !== undefined && (!Number.isFinite(m) || m < 0 || m > 1))
    || (inline !== undefined && (!Number.isFinite(inline) || inline < 0 || inline > 1))) {
    return { conflict: `invalid confidence for ${id}` };
  }
  if (m === undefined) return { confidence: undefined, conflict: `confidence only inline for ${id}` };
  if (inline !== undefined && Math.abs(inline - m) > 1e-6) {
    return { conflict: `confidence mismatch for ${id}: inline ${inline} vs metadata ${m}` };
  }
  return { confidence: m };
}

export interface EvaluateArgs {
  productId: string;
  state: { product: ProductState; context?: OutboundContext };
  questions: Record<string, Question>;
  hardConstraints: Set<string>;
  transport?: JevTransport;
}

export async function evaluateProduct(args: EvaluateArgs): Promise<Judgment[]> {
  const body = {
    model: MODEL_ID,
    state: args.state,
    questions: args.questions,
    // Not ZDR. Do not describe it as zero retention anywhere. v3 §13.4
    providerOptions: { gateway: { disallowPromptTraining: true, only: ["typesafe-ai"] } },
  };

  // Single egress point. Throws rather than sanitising. AT-15.
  assertHobbySafe(body);
  const evidenceFields = evidenceFieldsFor(body.state);
  if (body.state.product.id !== args.productId) {
    throw new Error("InvalidEvidenceField: productId does not match projected product");
  }
  // Hold the validated snapshot across the asynchronous transport.
  body.state = Object.freeze({ ...body.state });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: EvaluateResponse;
  try {
    res = await (args.transport ?? gatewayTransport)(body, controller.signal);
  } finally {
    clearTimeout(timer);
  }

  // No partial success: a malformed response invalidates the whole call. v3 AT-5
  if (!res || typeof res !== "object" || !res.answers) throw new Error("InvalidResponseData: no answers");
  for (const id of Object.keys(args.questions)) {
    if (!(id in res.answers)) throw new Error(`InvalidResponseData: missing answer ${id}`);
  }

  const provenance: JudgmentProvenance = {
    requestedModelId: MODEL_ID,
    generationId: res.providerMetadata?.gateway?.generationId ?? null,
    routing: res.providerMetadata?.gateway?.routing ?? null,
    sdkVersion: SDK_VERSION,
    evaluatedAt: new Date().toISOString(),
    upstreamModelVersion: "unknown",
  };
  const meta = res.providerMetadata?.typesafe?.confidence;

  return Object.entries(args.questions).map(([id, q]) => {
    const a = res.answers[id];
    if (q.type === "boolean") {
      const p = a?.probability;
      if (typeof p !== "number" || p < 0 || p > 1) throw new Error(`InvalidResponseData: ${id} probability`);
      const { verdict, band } = bandForBoolean(p, args.hardConstraints.has(id));
      return { productId: args.productId, criterion: id, primitive: "boolean", raw: p,
               verdict, band, evidenceFields, provenance };
    }
    const { confidence, conflict } = resolveConfidence(id, a?.confidence, meta);
    // Absent confidence, or a conflict, degrades to unknown. Never 0, never 1. AT-12
    const accepted = conflict === undefined && confidence !== undefined
      && confidence >= THRESHOLDS.scoreConfidence.accept;
    const caveat = conflict === undefined && confidence !== undefined
      && confidence >= THRESHOLDS.scoreConfidence.caveat && !accepted;
    return {
      productId: args.productId, criterion: id, primitive: q.type,
      raw: q.type === "score" ? a?.score : a?.choice,
      distribution: a?.probabilities,
      confidence, conflict,
      verdict: accepted ? "yes" : "unknown",
      band: accepted ? "high" : caveat ? "dead" : "low",
      evidenceFields, provenance,
    } as Judgment;
  });
}

/**
 * Evidence fields are the allowlisted product keys ACTUALLY present in the state we
 * sent — never `Object.keys(state.product)`, which would make the check circular:
 * whatever a caller smuggled in would validate itself as evidence. An unknown key
 * is rejected before any Judgment is built. v3 AT-2.
 */
export function evidenceFieldsFor(state: unknown): string[] {
  const p = (state as { product?: unknown } | null)?.product;
  assertProductState(p);
  return PRODUCT_STATE_ALLOWLIST.filter((k) => typeof p[k] === "string");
}

/** Production uses exactly these two typed tasks. Candidates, questions, and
 * prices are constructed here from canonical inputs; callers never supply them. */
export async function evaluateTradeoff(input: unknown, transport: JevTransport = gatewayTransport): Promise<TradeoffResult> {
  const { task, frame } = parseTaskRequest(input); // invalid ingress throws before any network
  const state = projectTradeoffState(task, frame);
  if (!state) return { task, status: "skipped", judgments: [] };
  const body = buildTradeoffPayload(state);
  const questions = body.questions;
  assertHobbySafe(body);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("evaluation timeout")); }, TIMEOUT_MS);
    });
    const response = await Promise.race([transport(body, controller.signal), timeout]);
    if (!response || response.model !== MODEL_ID || !response.answers || typeof response.answers !== "object"
      || Array.isArray(response.answers) || Object.keys(response.answers).length !== Object.keys(questions).length) throw new Error("invalid response");
    const judgments: TradeoffJudgment[] = Object.entries(questions).map(([id, question]) => {
      const answer = response.answers[id];
      const options = Object.keys(question.criteria);
      const probabilities = answer?.probabilities;
      if (answer?.type !== "choice" || !options.includes(answer?.choice)
        || !probabilities || typeof probabilities !== "object" || Array.isArray(probabilities)
        || Object.keys(probabilities).some(key => !options.includes(key))) throw new Error("invalid choice");
      // Gateway may return a sparse distribution. Missing legal options mean zero.
      const distribution = Object.fromEntries(options.map(key => [key, probabilities[key] ?? 0]));
      const values = Object.values(distribution);
      if (values.some(v => typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1)
        || Math.abs(values.reduce((a, b) => a + b, 0) - 1) > 0.02) throw new Error("invalid probabilities");
      const resolved = resolveConfidence(id, answer.confidence, response.providerMetadata?.typesafe?.confidence);
      const confident = !resolved.conflict && typeof resolved.confidence === "number"
        && Number.isFinite(resolved.confidence) && resolved.confidence >= THRESHOLDS.scoreConfidence.accept && resolved.confidence <= 1;
      const known = confident && answer.choice !== "insufficient_evidence";
      return { targetId: task === "style_tradeoff" ? id.slice("style_".length) : "basket_tradeoff", choice: answer.choice, probabilities: distribution,
        confidence: resolved.confidence, status: known ? "judged" : "unknown",
        evidenceFields: state.products.flatMap(p => PRODUCT_STATE_ALLOWLIST.map(field => `${p.id}.${field}`)) };
    });
    return { task, status: "complete", judgments,
      usage: response.usage && Number.isFinite(response.usage.inputTokens) && Number.isFinite(response.usage.outputTokens)
        ? response.usage : undefined,
      provenance: { requestedModelId: MODEL_ID, generationId: typeof response.providerMetadata?.gateway?.generationId === "string"
          ? response.providerMetadata.gateway.generationId : null,
        routing: response.providerMetadata?.gateway?.routing ?? null, sdkVersion: SDK_VERSION,
        evaluatedAt: new Date().toISOString(), upstreamModelVersion: "unknown" } };
  } catch {
    // No raw provider error, echoed prompt or user fields go to logs or the client.
    return { task, status: "unavailable", judgments: [] };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
