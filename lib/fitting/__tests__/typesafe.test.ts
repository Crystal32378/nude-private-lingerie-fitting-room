import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createTypesafeTransport, evaluateTradeoff, TYPESAFE_URL } from "../jev.ts";
import { selectJevProvider, resolveTypesafeCredential } from "../gateway-credential.ts";
import { buildTaskRequest } from "../privacy.ts";
import { emptyFrame, type SituationFrame } from "../types.ts";
import { POST } from "../../../app/api/fitting/judge/route.ts";

const c = <T>(value: T) => ({ value, provenance: "confirmed" as const });
const frame: SituationFrame = { ...emptyFrame(), canReachBackClosure: c(true), canPassOverHead: c(true),
  needsNudeColourway: c(true), requiresNoVisibleLines: c(false), priority: c("balanced"),
  matchingSetDesired: c(false), quantityIntent: c(1), budgetMaxTwd: c(5000), basketPriority: c("construction_balance") };
const KEY = "ts_test_key_do_not_log_123";
const saved = { key: process.env.TYPESAFE_API_KEY, provider: process.env.JEV_PROVIDER };
afterEach(() => {
  if (saved.key === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = saved.key;
  if (saved.provider === undefined) delete process.env.JEV_PROVIDER; else process.env.JEV_PROVIDER = saved.provider;
});

/** A documented TypeSafe System One response: inline confidence, snake_case usage. */
function typesafeReply(body: any) {
  const answers: Record<string, unknown> = {};
  for (const id of Object.keys(body.questions)) answers[id] = { type: "choice", choice: "prefer",
    probabilities: { prefer: 0.8, consider: 0.15, lower_priority: 0.03, insufficient_evidence: 0.02 }, confidence: 0.83 };
  return new Response(JSON.stringify({ model: "jev-1.13.0", answers, usage: { input_tokens: 900, output_tokens: 40 } }),
    { status: 200, headers: { "Content-Type": "application/json", "x-typesafe-request-id": "req_abc" } });
}

test("provider choice: explicit JEV_PROVIDER wins, else a TypeSafe key selects TypeSafe, else Gateway", () => {
  assert.equal(selectJevProvider({}), "gateway");
  assert.equal(selectJevProvider({ TYPESAFE_API_KEY: "k" }), "typesafe");
  assert.equal(selectJevProvider({ TYPESAFE_API_KEY: "k", JEV_PROVIDER: "gateway" }), "gateway");
  assert.equal(selectJevProvider({ JEV_PROVIDER: "typesafe" }), "typesafe");
  assert.deepEqual(resolveTypesafeCredential({}), { token: null, source: "missing" });
  assert.equal(resolveTypesafeCredential({ TYPESAFE_API_KEY: KEY }).source, "typesafe_env");
});

test("TypeSafe transport: documented endpoint, Bearer key, jev-latest, no Gateway-only options; response normalised", async (t) => {
  let seen: { url: string; auth: string | null; body: any } | null = null;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    seen = { url, auth: new Headers(init.headers).get("authorization"), body };
    return typesafeReply(body);
  });
  const result = await evaluateTradeoff(buildTaskRequest("style_tradeoff", frame), createTypesafeTransport(async () => KEY));
  assert.equal(seen!.url, TYPESAFE_URL);
  assert.equal(seen!.auth, `Bearer ${KEY}`);
  assert.equal(seen!.body.model, "jev-latest");
  assert.deepEqual(Object.keys(seen!.body).sort(), ["model", "questions", "state"]);
  assert.equal(result.status, "complete");
  assert.ok(result.judgments.length > 1 && result.judgments.every(j => j.status === "judged" && j.confidence === 0.83));
  assert.deepEqual(result.usage, { inputTokens: 900, outputTokens: 40 });
  const p = result.provenance!;
  assert.equal(p.transport, "typesafe-system-one");
  assert.equal(p.requestedModelId, "jev-latest");
  assert.equal(p.returnedModel, "jev-1.13.0");
  assert.equal(p.upstreamRequestId, "req_abc");
  assert.match(p.receiptId!, /^jev_[0-9a-f]{12}$/);
  assert.match(p.resultHash!, /^[0-9a-f]{16}$/);
});

test("TypeSafe transport rejects a non-jev model and treats low confidence as unknown", async (t) => {
  t.mock.method(globalThis, "fetch", async (_u: string, init: RequestInit) => {
    const r = await typesafeReply(JSON.parse(String(init.body))).json();
    return new Response(JSON.stringify({ ...r, model: "some-other-model" }), { status: 200 });
  });
  assert.equal((await evaluateTradeoff(buildTaskRequest("style_tradeoff", frame), createTypesafeTransport(async () => KEY))).status, "unavailable");
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async (_u: string, init: RequestInit) => {
    const r = await typesafeReply(JSON.parse(String(init.body))).json();
    for (const a of Object.values(r.answers) as any[]) a.confidence = 0.5;
    return new Response(JSON.stringify(r), { status: 200 });
  });
  const low = await evaluateTradeoff(buildTaskRequest("style_tradeoff", frame), createTypesafeTransport(async () => KEY));
  assert.equal(low.status, "complete");
  assert.ok(low.judgments.every(j => j.status === "unknown"), "below 0.7 is never adopted");
});

function judgeRequest(): Request {
  return new Request("http://localhost:3107/api/fitting/judge", {
    method: "POST", headers: { "Content-Type": "application/json", Host: "localhost:3107" },
    body: JSON.stringify(buildTaskRequest("style_tradeoff", frame)),
  });
}

test("route uses the TypeSafe key when set, labels it, returns a receipt, and never echoes the key", async (t) => {
  process.env.TYPESAFE_API_KEY = KEY;
  t.mock.method(globalThis, "fetch", async (_u: string, init: RequestInit) => typesafeReply(JSON.parse(String(init.body))));
  const logs = t.mock.method(console, "info", () => {});
  const response = await POST(judgeRequest());
  const text = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-jev-token-source"), "typesafe_env");
  assert.equal(response.headers.get("x-jev-transport"), "typesafe-system-one");
  assert.match(JSON.parse(text).provenance.receiptId, /^jev_/);
  const logged = logs.mock.calls.map(call => String(call.arguments[0])).join("\n");
  assert.ok(logged.includes("receiptId") && !logged.includes(KEY) && !text.includes(KEY));
  assert.ok(!logged.includes("canReachBackClosure"), "audit log carries no answers");
});

test("route: a refused TypeSafe key is auth_unavailable", async (t) => {
  process.env.TYPESAFE_API_KEY = KEY;
  t.mock.method(globalThis, "fetch", async () => new Response("unauthorized", { status: 401 }));
  t.mock.method(console, "info", () => {});
  const response = await POST(judgeRequest());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "auth_unavailable", tokenSource: "typesafe_env" });
});
