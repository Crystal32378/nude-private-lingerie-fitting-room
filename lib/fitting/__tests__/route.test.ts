import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../../../app/api/fitting/judge/route.ts";

function request(origin: string) {
  // Next may expose an internal localhost URL while the browser uses 127.0.0.1.
  return new Request("http://localhost:3107/api/fitting/judge", {
    method: "POST", headers: { "Content-Type": "application/json", Host: "127.0.0.1:3107", Origin: origin },
    body: JSON.stringify({ task: "style_tradeoff", fields: {} }),
  });
}
test("same public origin survives Next's internal localhost URL", async () => {
  const response = await POST(request("http://127.0.0.1:3107"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { task: "style_tradeoff", status: "skipped", judgments: [] });
});
test("a genuinely different origin is still rejected before evaluation", async () => {
  const response = await POST(request("https://example.invalid"));
  assert.equal(response.status, 403);
});

// ---------------------------------------------------------------- credential source
// Regression for the Preview outage: the OIDC token lives in the request context
// header on Vercel, not in process.env. Only the source label may surface.
import { afterEach } from "node:test";
import { emptyFrame, type SituationFrame } from "../types.ts";
import { buildTaskRequest } from "../privacy.ts";

const CONTEXT = Symbol.for("@vercel/request-context");
const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const fakeJwt = (label: string) => `${b64({ alg: "none" })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600, label })}.sig`;
const confirmed = <T>(value: T) => ({ value, provenance: "confirmed" as const });
const styleFrame: SituationFrame = { ...emptyFrame(), canReachBackClosure: confirmed(true), canPassOverHead: confirmed(true),
  needsNudeColourway: confirmed(true), requiresNoVisibleLines: confirmed(false), priority: confirmed("balanced"),
  matchingSetDesired: confirmed(false), quantityIntent: confirmed(1), budgetMaxTwd: confirmed(5000),
  basketPriority: confirmed("construction_balance") };
const savedEnv = process.env.VERCEL_OIDC_TOKEN;

function judgeRequest(): Request {
  return new Request("http://localhost:3107/api/fitting/judge", {
    method: "POST", headers: { "Content-Type": "application/json", Host: "localhost:3107" },
    body: JSON.stringify(buildTaskRequest("style_tradeoff", styleFrame)),
  });
}
function setContextToken(token: string | undefined) {
  (globalThis as Record<symbol, unknown>)[CONTEXT] = token ? { get: () => ({ headers: { "x-vercel-oidc-token": token } }) } : undefined;
}
afterEach(() => {
  setContextToken(undefined);
  if (savedEnv === undefined) delete process.env.VERCEL_OIDC_TOKEN; else process.env.VERCEL_OIDC_TOKEN = savedEnv;
});

test("request-context OIDC header is used, labelled oidc_header, and never echoed", async (t) => {
  const headerToken = fakeJwt("header");
  process.env.VERCEL_OIDC_TOKEN = fakeJwt("env");
  setContextToken(headerToken);
  let sentAuth = "";
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    sentAuth = new Headers(init.headers).get("authorization") ?? "";
    return new Response("upstream down", { status: 500 });
  });
  const response = await POST(judgeRequest());
  const text = await response.text();
  assert.equal(sentAuth, `Bearer ${headerToken}`);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("x-jev-token-source"), "oidc_header");
  assert.deepEqual(JSON.parse(text), { error: "judgment_unavailable", tokenSource: "oidc_header" });
  assert.ok(!text.includes(headerToken) && ![...response.headers.values()].some(v => v.includes(headerToken)));
});

test("local VERCEL_OIDC_TOKEN is labelled local_env; a refused credential is auth_unavailable", async (t) => {
  const envToken = fakeJwt("env");
  process.env.VERCEL_OIDC_TOKEN = envToken;
  t.mock.method(globalThis, "fetch", async () => new Response("unauthorized", { status: 401 }));
  const response = await POST(judgeRequest());
  const text = await response.text();
  assert.equal(response.status, 503);
  assert.deepEqual(JSON.parse(text), { error: "auth_unavailable", tokenSource: "local_env" });
  assert.ok(!text.includes(envToken));
});

test("no credential at all is auth_unavailable/missing and never reaches the network", async (t) => {
  delete process.env.VERCEL_OIDC_TOKEN;
  const network = t.mock.method(globalThis, "fetch", async () => { throw new Error("network is disabled in this test"); });
  const response = await POST(judgeRequest());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "auth_unavailable", tokenSource: "missing" });
  assert.equal(response.headers.get("x-jev-token-source"), "missing");
  assert.equal(network.mock.callCount(), 0);
});

test("malformed input is still invalid_confirmed_fields, before any credential lookup", async () => {
  const response = await POST(new Request("http://localhost:3107/api/fitting/judge", {
    method: "POST", headers: { Host: "localhost:3107" }, body: "{not json" }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_confirmed_fields" });
  assert.equal(response.headers.get("x-jev-token-source"), null);
});
