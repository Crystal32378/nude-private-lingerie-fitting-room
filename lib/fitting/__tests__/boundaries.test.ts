import { test } from "node:test";
import assert from "node:assert/strict";
import { NUDE_PRODUCTS } from "../../products.ts";
import { emptyFrame, type SituationFrame } from "../types.ts";
import { assertHobbySafe, buildOutboundContext, projectProductState, PrivacyViolationError } from "../privacy.ts";
import { evaluateProduct, evidenceFieldsFor, gatewayTransport, type EvaluateArgs } from "../jev.ts";
import { calculate, checkSetBudget, type BasketLine } from "../promotion.ts";

const bra = NUDE_PRODUCTS.find(p => p.id === "nude-09")!;
const confirmed = <T>(value: T) => ({ value, provenance: "confirmed" as const });
const frame = (): SituationFrame => ({ ...emptyFrame(), outerGarment: confirmed("thin_fitted") });
const payload = (context: unknown) => ({
  model: "typesafe-ai/jev", state: { product: projectProductState(bra), context }, questions: {},
});

// Fake only the paid network boundary. The adapter, projection, and guard are real.
async function blockedBeforeTransport(state: unknown, expected: RegExp | typeof PrivacyViolationError) {
  let calls = 0;
  await assert.rejects(() => evaluateProduct({
    productId: bra.id, state,
    questions: { q: { type: "boolean", instructions: "Does the closure require reaching behind the back?" } },
    hardConstraints: new Set(["q"]),
    transport: async () => {
      calls++;
      return { model: "typesafe-ai/jev", answers: { q: { type: "boolean", probability: 0.02 } } };
    },
  } as EvaluateArgs), expected);
  assert.equal(calls, 0, "invalid data must not reach the transport");
}

test("AT-15 builder throws on a confirmed short sentence; errors do not echo it", () => {
  const utterance = "下週去東京穿白襯衫";
  const f = { ...frame(), outerGarment: confirmed(utterance) } as unknown as SituationFrame;
  assert.throws(() => buildOutboundContext(f), (error: unknown) => {
    assert.ok(error instanceof PrivacyViolationError);
    assert.ok(!JSON.stringify(error).includes(utterance));
    assert.ok(!error.message.includes(utterance));
    return true;
  });
});

for (const [name, field] of [
  ["one-character enum", confirmed("薄")],
  ["numeric enum", confirmed(1)],
  ["object enum", confirmed({ value: "thin_fitted" })],
  ["raw primitive", "thin_fitted"],
  ["extra UserField property", { ...confirmed("thin_fitted"), utterance: "私密困擾" }],
  ["unknown provenance", { value: "thin_fitted", provenance: "model_says_yes" }],
] as const) {
  test(`AT-15 builder rejects ${name}`, () => {
    assert.throws(() => buildOutboundContext({ ...frame(), outerGarment: field } as unknown as SituationFrame),
      PrivacyViolationError);
  });
}

test("AT-15 builder rejects wrong boolean types and extra frame fields", () => {
  assert.throws(() => buildOutboundContext({ ...frame(), needsNudeColourway: confirmed("true") } as unknown as SituationFrame),
    PrivacyViolationError);
  assert.throws(() => buildOutboundContext({ ...frame(), utterance: "私密困擾" } as SituationFrame),
    PrivacyViolationError);
});

test("AT-15 unconfirmed fields never leave; local logistics are not serialized", () => {
  const f: SituationFrame = {
    ...frame(), priority: { value: "comfort", provenance: "stated" },
    canPassOverHead: confirmed(false), area: confirmed("台北市大安區"),
    requiredByDate: confirmed("2026-10-01"),
  };
  const ctx = buildOutboundContext(f);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx)), { outerGarment: "thin_fitted", canPassOverHead: false });
  assert.doesNotThrow(() => assertHobbySafe(payload(ctx)));
});

test("AT-15 raw legal primitives and copied contexts are rejected before transport", async () => {
  const ctx = buildOutboundContext(frame());
  for (const context of [{ outerGarment: "thin_fitted" }, { ...ctx }, { outerGarment: "下週去東京穿白襯衫" }]) {
    await blockedBeforeTransport({ product: projectProductState(bra), context }, PrivacyViolationError);
  }
});

test("AT-15 a built context cannot be changed after its confirmation check", () => {
  const f = frame();
  const ctx = buildOutboundContext(f);
  f.outerGarment.value = "other";
  assert.equal(ctx.outerGarment, "thin_fitted", "output is a snapshot, not the caller's mutable field");
  assert.throws(() => Object.assign(ctx, { outerGarment: "下週去東京穿白襯衫" }), TypeError);
  assert.throws(() => Object.assign(ctx, { email: "synthetic@example.invalid" }), TypeError);
});

test("AT-15 direct Gateway transport also guards before credential lookup or fetch", async (t) => {
  const network = t.mock.method(globalThis, "fetch", async () => { throw new Error("network is disabled in this test"); });
  await assert.rejects(() => gatewayTransport(payload({ outerGarment: "下週去東京穿白襯衫" }), new AbortController().signal),
    PrivacyViolationError);
  assert.equal(network.mock.callCount(), 0);
});

test("AT-2 product projection refuses invented evidence and altered canonical values", () => {
  assert.throws(() => projectProductState({ ...bra, seam_construction: "flat-locked" } as typeof bra), /seam_construction/);
  assert.throws(() => projectProductState({ ...bra, structureNotes: "下週去東京穿白襯衫" }), /InvalidEvidenceField/);
  assert.throws(() => projectProductState({ ...bra, closure: 7 } as unknown as typeof bra), /InvalidEvidenceField/);
});

test("AT-2 missing or arbitrary product states cannot manufacture a judgment", async () => {
  for (const product of [undefined, {}, { id: bra.id }, { ...projectProductState(bra), seam_construction: "flat-locked" }]) {
    await blockedBeforeTransport({ product }, /InvalidEvidenceField|Hobby privacy guard/);
  }
});

test("AT-2 evidence validation independently rejects missing and wrong-type evidence", () => {
  for (const product of [undefined, {}, [], { id: bra.id, closure: 42 }, { id: bra.id, seam_construction: "flat-locked" }]) {
    assert.throws(() => evidenceFieldsFor({ product }), /InvalidEvidenceField/);
  }
});

test("AT-2 product ID cannot attach one product's evidence to another", async () => {
  await blockedBeforeTransport({ product: projectProductState(NUDE_PRODUCTS.find(p => p.id === "nude-08")!) },
    /InvalidEvidenceField/);
});

test("AT-2 confirmed context and canonical product produce a judgment using only sent evidence", async () => {
  let sent: unknown;
  const js = await evaluateProduct({
    productId: bra.id,
    state: { product: projectProductState(bra), context: buildOutboundContext(frame()) },
    questions: { q: { type: "boolean", instructions: "Does the closure require reaching behind the back?" } },
    hardConstraints: new Set(["q"]),
    transport: async body => {
      sent = JSON.parse(JSON.stringify(body));
      return { model: "typesafe-ai/jev", answers: { q: { type: "boolean", probability: 0.02 } } };
    },
  });
  assert.deepEqual((sent as { state: { context: unknown } }).state.context, { outerGarment: "thin_fitted" });
  assert.equal(js[0].verdict, "no");
  assert.deepEqual(js[0].evidenceFields,
    ["id", "category", "closure", "wire", "padding", "straps", "cup", "material", "structureNotes"]);
  assert.ok(!JSON.stringify(sent).includes("price"));
});

test("SET-BUDGET a simulation below the ceiling cannot mask an over-budget basket", () => {
  const lines: BasketLine[] = [
    { id: "nude-09", name: "內衣", price: 1880, promotionEligible: "yes", qty: 3 },
    { id: "panty-02", name: "內褲", price: 580, promotionEligible: "yes", qty: 3 },
  ];
  const calc = calculate(lines, new Date("2026-09-25T00:00:00+08:00"));
  assert.equal(calc.finalTotal, 3690, "conditional simulation only");
  const check = checkSetBudget(calc, 5000);
  assert.equal(check.defaultTotal, 7380);
  assert.equal(check.withinBudget, false);
  assert.equal(check.overBy, 2380);
  assert.ok(check.note?.includes("整組"));
});
