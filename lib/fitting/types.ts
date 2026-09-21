/**
 * Core types for the Private Fitting Room decision layer.
 * Architecture: BRIEFING-NUDE-JEV-ARCHITECTURE-v3.md
 *
 * Rule 1 (v3 §14.0): classification may move when the user confirms something.
 *                    Product facts may NOT be rewritten by model output.
 * Rule 2:            high confidence != correct. A model never overrides evidence.
 * Rule 3:            site page / brand knowledge / generated image / JEV judgment
 *                    are four distinct sources and may never impersonate each other.
 */

export type EvidenceSource =
  | "site_stated"
  | "crystal_brand_knowledge"
  | "observed_from_product_image"
  | "generated_image"
  | "jev_judgment";

/** Every fact-bearing value carries where it came from. Rule 3. */
export interface Sourced<T> {
  value: T;
  source: EvidenceSource;
  confirmedAt?: string;
  confirmedBy?: string;
}

// ---------------------------------------------------------------- frame

export type Provenance = "stated" | "confirmed" | "inferred" | "unknown";

/** Produced by a model. May never drive a hard constraint while `inferred`. */
export interface JevField<T> {
  value: T | null;
  provenance: "inferred" | "confirmed" | "unknown";
  probability?: number;
  confidence?: number;
}

/** Supplied by the user. The only kind that may exclude a product. */
export interface UserField<T> {
  value: T | null;
  provenance: "stated" | "confirmed" | "unknown";
}

export const unknownUser = <T>(): UserField<T> => ({ value: null, provenance: "unknown" });

export type OuterGarment = "thin_fitted" | "thick_or_loose" | "other" | "not_stated";
export type WearDuration = "under_4" | "4_to_8" | "over_8" | "not_stated";
export type Priority = "comfort" | "shaping" | "balanced" | "not_stated";
export type ReceiveMethod = "pickup" | "delivery";
export type PantySize = "S" | "M" | "L";

export interface SituationFrame {
  // --- dressing access. Only the user may answer these. v3 §四 ---
  canReachBackClosure: UserField<boolean>;
  canRotateBandAroundTorso: UserField<boolean>;
  canRaiseArmsOverhead: UserField<boolean>;
  canPassOverHead: UserField<boolean>;
  canPerformFineMotorPinch: UserField<boolean>;

  // --- occasion / appearance ---
  outerGarment: UserField<OuterGarment>;
  wearDuration: UserField<WearDuration>;
  priority: UserField<Priority>;
  needsNudeColourway: UserField<boolean>;
  requiresNoVisibleLines: UserField<boolean>;

  // --- set / quantity ---
  matchingSetDesired: UserField<boolean>;
  pantySize: UserField<PantySize>;
  quantityIntent: UserField<number>;
  tripDurationDays: UserField<number>; // decides WHAT TO ASK. Never converted to quantity.

  // --- budget. Ceiling, never a target. v3 §九 ---
  budgetMaxTwd: UserField<number>;
  budgetCovers: UserField<"bra_only" | "bra_and_underwear">;
  basketPriority: UserField<"lowest_total" | "construction_balance">;

  // --- logistics ---
  requiredByDate: UserField<string>;
  receiveMethod: UserField<ReceiveMethod>;
  area: UserField<string>;
}

export function emptyFrame(): SituationFrame {
  return {
    canReachBackClosure: unknownUser(), canRotateBandAroundTorso: unknownUser(),
    canRaiseArmsOverhead: unknownUser(), canPassOverHead: unknownUser(),
    canPerformFineMotorPinch: unknownUser(),
    outerGarment: unknownUser(), wearDuration: unknownUser(), priority: unknownUser(),
    needsNudeColourway: unknownUser(), requiresNoVisibleLines: unknownUser(), matchingSetDesired: unknownUser(),
    pantySize: unknownUser(), quantityIntent: unknownUser(), tripDurationDays: unknownUser(),
    budgetMaxTwd: unknownUser(), budgetCovers: unknownUser(), basketPriority: unknownUser(),
    requiredByDate: unknownUser(), receiveMethod: unknownUser(), area: unknownUser(),
  };
}

/** Only `stated` or `confirmed` may exclude a product. v3 §四. */
export function binds<T>(f: UserField<T>): boolean {
  return f.value !== null && (f.provenance === "stated" || f.provenance === "confirmed");
}

// ---------------------------------------------------------------- judgment

export type Verdict = "yes" | "no" | "unknown";
export type Band = "high" | "dead" | "low";

export interface JudgmentProvenance {
  requestedModelId: string;
  generationId: string | null;
  routing: unknown;
  sdkVersion: string;
  evaluatedAt: string;
  /** Gateway does not expose it. Never guess. v3 §13.6 */
  upstreamModelVersion: "unknown";
  /** Audit receipt for the tradeoff tasks. Identifiers and hashes only — never the
   *  request state, the user's answers, or a credential. */
  receiptId?: string;
  transport?: "vercel-ai-gateway" | "typesafe-system-one";
  /** Model id exactly as the provider returned it (e.g. "jev-1.13.0"). */
  returnedModel?: string;
  /** Provider request id (x-typesafe-request-id / gateway generation id), if any. */
  upstreamRequestId?: string | null;
  /** First 16 hex chars of sha256 over the returned judgments. */
  resultHash?: string;
  latencyMs?: number;
}

export interface Judgment {
  productId: string;
  criterion: string;
  primitive: "boolean" | "choice" | "score";
  raw: number | string;
  distribution?: Record<string, number>;
  confidence?: number;
  verdict: Verdict;
  band: Band;
  evidenceFields: string[];
  conflict?: string;
  provenance: JudgmentProvenance;
}

export type TradeoffTask = "style_tradeoff" | "basket_tradeoff";
export type StyleChoice = "prefer" | "consider" | "lower_priority" | "insufficient_evidence";
export interface TradeoffJudgment {
  targetId: string;
  choice: string;
  probabilities: Record<string, number>;
  confidence?: number;
  status: "judged" | "unknown";
  evidenceFields: string[];
}
export interface TradeoffResult {
  task: TradeoffTask;
  status: "complete" | "skipped" | "unavailable";
  judgments: TradeoffJudgment[];
  provenance?: JudgmentProvenance;
  usage?: { inputTokens: number; outputTokens: number };
}

// ---------------------------------------------------------------- results

export type Bucket = "best_fit" | "check_with_you" | "not_a_fit" | "availability_unknown";

export interface OpenQuestion {
  id: string;
  ask: string;
  field: keyof SituationFrame;
  options: { label: string; value: unknown }[];
}

export interface ResultItem {
  productId: string;
  bucket: Bucket;
  /** Only from fields that exist. Never a comfort claim without evidence. v3 §14.3 */
  reasons: { text: string; field: string }[];
  uncertain: string[];
  openQuestion?: OpenQuestion;
}

export interface DecisionResult {
  items: ResultItem[];
  /** 0..3. A maximum, never a quota. v3 §四 */
  bestFitCount: number;
  whyOnlyN: string[];
  degraded: boolean;
}
