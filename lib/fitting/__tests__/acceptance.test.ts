/**
 * Adversarial acceptance tests AT-1 … AT-14.  v3 §十.
 * Each passes only when the system DECLINES correctly — not when it produces output.
 * Run: node --experimental-strip-types --test lib/fitting/__tests__/acceptance.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { NUDE_PRODUCTS } from "../../products.ts";
import { PANTIES } from "../panties.ts";
import { emptyFrame, type SituationFrame } from "../types.ts";
import { decide, decideDegraded } from "../decide.ts";
import { runGates, highestLeverageQuestion } from "../gates.ts";
import { calculate, tierUpgradeOption, checkSetBudget, PROMO, type BasketLine } from "../promotion.ts";
import { assertHobbySafe, isHobbySafe, PrivacyViolationError,
         buildOutboundContext, projectProductState } from "../privacy.ts";
import { evaluateProduct, resolveConfidence, bandForBoolean, evidenceFieldsFor,
         type EvaluateResponse } from "../jev.ts";
import { QUESTIONS } from "../questions.ts";

const confirmed = <T>(value: T) => ({ value, provenance: "confirmed" as const });
const stated = <T>(value: T) => ({ value, provenance: "stated" as const });
const canonicalState = () => ({ product: projectProductState(NUDE_PRODUCTS.find(p => p.id === "nude-09")!) });

function tokyoFrame(over: Partial<SituationFrame> = {}): SituationFrame {
  return { ...emptyFrame(),
    needsNudeColourway: confirmed(true),
    canReachBackClosure: stated(false),
    outerGarment: confirmed("thin_fitted"),
    budgetMaxTwd: confirmed(5000),
    ...over } as SituationFrame;
}

// ───────────────────────────────── AT-1 · abstention
test("AT-1 nothing survives → zero recommendations, fully explained", () => {
  const f = tokyoFrame({
    canRotateBandAroundTorso: confirmed(false),
    canPassOverHead: confirmed(false),
    budgetMaxTwd: confirmed(1000),          // below every bra
  });
  const r = decide(f);
  assert.equal(r.bestFitCount, 0, "must not recommend anything");
  assert.equal(r.items.filter(i => i.bucket === "best_fit").length, 0);
  assert.ok(r.whyOnlyN.length > 0, "must say why");
  assert.ok(r.whyOnlyN.some(w => w.includes("沒有同時符合")), "must state the honest outcome");
  for (const i of r.items) assert.ok(i.reasons.every(x => x.field), "every reason names a field");
});

// ───────────────────────────────── AT-2 · missing evidence
test("AT-2 a state carrying a non-existent field fails the whole call", async () => {
  const smuggled = {
    product: {
      id: "nude-09", closure: "front (no back closure)",
      seam_construction: "flat-locked",   // does not exist in the corpus
      surface_finish: "matte",            // ditto
    },
  };
  let thrown: unknown;
  await assert.rejects(async () => {
    try {
      return await evaluateProduct({
        productId: "nude-09", state: smuggled as any, // deliberate runtime schema violation
        questions: { q: { type: "boolean", instructions: "x" } },
        hardConstraints: new Set(),
        transport: async () => { throw new Error("network must never be reached"); },
      });
    } catch (e) { thrown = e; throw e; }
  });
  // Two independent defences reject it; the egress guard happens to fire first.
  assert.match(String((thrown as Error).message), /seam_construction/,
    "the rejection must name the smuggled field");
  assert.ok(thrown instanceof PrivacyViolationError,
    "blocked at the egress point, before any network call");
});

test("AT-2-1b the adapter's own evidence check fails closed independently", () => {
  // Proven without the guard, so neither layer is load-bearing alone.
  assert.throws(
    () => evidenceFieldsFor({ product: { id: "nude-09", seam_construction: "flat-locked" } }),
    /InvalidEvidenceField.*seam_construction/);
});

test("AT-2-2 evidence fields come from the allowlist, not from the caller's object", () => {
  assert.throws(() => evidenceFieldsFor({ product: { id: "x", seam_construction: "y" } }),
    /InvalidEvidenceField/);
  // A projected product yields only allowlisted keys, so the check cannot validate itself.
  const projected = projectProductState(NUDE_PRODUCTS.find(p => p.id === "nude-09")!);
  const fields = evidenceFieldsFor({ product: projected });
  assert.ok(fields.includes("closure"));
  assert.ok(!fields.includes("seam_construction"));
  assert.ok(!fields.includes("nameZh"), "non-allowlisted corpus fields are not evidence either");
});

test("AT-2-3 projection rejects unknown source fields and omits known non-evidence fields", () => {
  const p = NUDE_PRODUCTS.find(x => x.id === "nude-08")!;
  assert.throws(() => projectProductState({ ...p, seam_construction: "injected" } as any),
    /seam_construction/);
  const projected = projectProductState(p);
  assert.ok(!("seam_construction" in projected));
  assert.ok(!("price" in projected), "price is deterministic; it is not JEV's business");
  assert.equal(projected.closure, p.closure);
});

// ───────────────────────────────── AT-3a · planned/unverified promotion
test("AT-3a public site terms → designated items use the activity price; unknown items stay list price", () => {
  const at = new Date("2026-09-25T00:00:00+08:00");
  assert.equal(PROMO.termsVerified, true);
  const listed = calculate([
    { id: "nude-09", name: "魔幻時尚前扣", price: 1880, promotionEligible: "yes", qty: 1 },
    { id: "panty-02", name: "魔幻時尚無痕", price: 580, promotionEligible: "yes", qty: 1 },
  ], at);
  assert.equal(listed.isSimulation, false);
  assert.equal(listed.defaultTotal, 2214, "public activity price (一件9折)");
  assert.ok(listed.notes.some(n => n.includes("實付以購物車為準")), "never claimed as the checkout payment");
  const unlisted = calculate([
    { id: "x-1", name: "未列指定", price: 1880, promotionEligible: "unknown", qty: 1 },
  ], at);
  assert.equal(unlisted.defaultTotal, 1880, "not on the official list → no discount (fail closed)");
});

test("AT-3a-2 unresolved eligibility is fail-closed, never counted", () => {
  const lines: BasketLine[] = PANTIES.slice(0, 5)
    .map(p => ({ id: p.id, name: p.nameZh, price: p.price, promotionEligible: p.promotionEligible, qty: 1 }));
  const c = calculate(lines, new Date("2026-09-25T00:00:00+08:00"));
  assert.equal(c.eligibleItemCount, 0, "unknown eligibility must not reach a tier");
  assert.equal(c.appliedTier, "none");
});

// ───────────────────────────────── AT-3b · promotion must not override fit
test("AT-3b excluded bras never enter the basket, even to reach a tier", () => {
  const f = tokyoFrame();
  const run = runGates(f);
  const basket: BasketLine[] = run.eligibleBraIds.map(id => {
    const p = NUDE_PRODUCTS.find(x => x.id === id)!;
    return { id, name: p.nameZh, price: p.price, promotionEligible: "yes" as const, qty: 1 };
  });
  for (const ex of run.excludedBraIds) {
    assert.ok(!basket.some(l => l.id === ex), `${ex} is excluded and must never be in the basket`);
  }
  const available: BasketLine[] = run.eligiblePantyIds.map(id => {
    const p = PANTIES.find(x => x.id === id)!;
    return { id, name: p.nameZh, price: p.price, promotionEligible: "yes" as const, qty: 1 };
  });
  const up = tierUpgradeOption(basket, available, new Date("2026-09-25T00:00:00+08:00"));
  if (up) for (const a of up.addItems) {
    assert.ok(!run.excludedBraIds.includes(a.id), "upgrade must not add an excluded bra");
  }
});

// ───────────────────────────────── AT-4 · nude-08 stays Check with you
test("AT-4 nude-08 is neither recommended nor removed before she answers", () => {
  const r = decide(tokyoFrame());
  const n8 = r.items.find(i => i.productId === "nude-08")!;
  assert.equal(n8.bucket, "check_with_you", "must not be excluded, must not be best fit");
  assert.ok(n8.openQuestion, "must carry the one open question");
  assert.equal(n8.openQuestion!.field, "canPassOverHead");
});

test("AT-4-2 only her answer moves nude-08 to Not a fit", () => {
  const no = decide(tokyoFrame({ canPassOverHead: confirmed(false) }));
  assert.equal(no.items.find(i => i.productId === "nude-08")!.bucket, "not_a_fit");
  const yes = decide(tokyoFrame({ canPassOverHead: confirmed(true) }));
  assert.equal(yes.items.find(i => i.productId === "nude-08")!.bucket, "best_fit");
});

// ───────────────────────────────── AT-4b · inference may not silently bind
test("AT-4b unanswered rotate question does not shrink the set", () => {
  const f = tokyoFrame();
  assert.equal(f.canRotateBandAroundTorso.provenance, "unknown");
  const before = runGates(f).eligibleBraIds.length;
  const after = runGates(tokyoFrame({ canRotateBandAroundTorso: confirmed(true) })).eligibleBraIds.length;
  assert.ok(after > before, "answering it must be able to re-admit products");
  assert.equal(highestLeverageQuestion(f), "canRotateBandAroundTorso");
});

// ───────────────────────────────── AT-5 · malformed output, no partial success
test("AT-5 a malformed response fails the whole call", async () => {
  const bad: EvaluateResponse = {
    model: "typesafe-ai/jev",
    answers: { a: { type: "boolean", probability: 1.7 }, b: { type: "boolean", probability: 0.2 } },
  };
  await assert.rejects(
    () => evaluateProduct({
      productId: "nude-09", state: canonicalState(),
      questions: { a: { type: "boolean", instructions: "x" }, b: { type: "boolean", instructions: "y" } },
      hardConstraints: new Set(), transport: async () => bad,
    }),
    /InvalidResponseData/, "no partial success: sibling answers must not survive");
});

test("AT-5-2 a missing answer id fails the whole call", async () => {
  await assert.rejects(() => evaluateProduct({
    productId: "nude-09", state: canonicalState(),
    questions: { a: { type: "boolean", instructions: "x" }, b: { type: "boolean", instructions: "y" } },
    hardConstraints: new Set(),
    transport: async () => ({ model: "typesafe-ai/jev", answers: { a: { type: "boolean", probability: 0.2 } } }),
  }), /InvalidResponseData/);
});

// ───────────────────────────────── AT-6 · JEV failure degrades, never blanks
test("AT-6 deterministic facts survive a model outage", () => {
  const r = decideDegraded(tokyoFrame());
  assert.equal(r.degraded, true);
  const n9 = r.items.find(i => i.productId === "nude-09")!;
  assert.equal(n9.bucket, "best_fit");
  assert.ok(n9.reasons.some(x => x.field === "closure"));
  assert.ok(n9.reasons.some(x => x.field === "price"));
});

test("AT-6-2 timeout and http errors propagate rather than hang", async () => {
  await assert.rejects(() => evaluateProduct({
    productId: "nude-09", state: canonicalState(),
    questions: { a: { type: "boolean", instructions: "x" } },
    hardConstraints: new Set(),
    transport: async () => { throw new Error("gateway 429"); },
  }), /429/);
});

// ───────────────────────────────── AT-7 · never padded
test("AT-7 result count is whatever survives, capped at 3", () => {
  const r = decide(tokyoFrame());
  assert.equal(r.bestFitCount, 1, "the honest answer here is one");
  assert.ok(r.bestFitCount <= 3);
  const loose = decide({ ...emptyFrame(), needsNudeColourway: confirmed(false) } as SituationFrame);
  assert.ok(loose.bestFitCount <= 3, "cap holds when many qualify");
});

// ───────────────────────────────── AT-8 · no unsourced claims
test("AT-8 every rendered reason names an existing product field", () => {
  const r = decide(tokyoFrame());
  const real = new Set(Object.keys(NUDE_PRODUCTS[0]));
  for (const item of r.items) {
    for (const reason of item.reasons) {
      assert.ok(real.has(reason.field), `${reason.field} must be a real field`);
      assert.ok(!/最舒服|整天穿不壓|不會痛|保證/.test(reason.text), `unsourced comfort claim: ${reason.text}`);
    }
  }
});

test("AT-8-2 p-08 efficacy copy never reaches the record", () => {
  const p8 = PANTIES.find(p => p.id === "panty-08")!;
  const blob = JSON.stringify(p8);
  for (const banned of ["A酸", "咖啡因", "28天", "臨床", "少一吋", "480"]) {
    assert.ok(!blob.includes(banned), `efficacy claim leaked: ${banned}`);
  }
});

// ───────────────────────────────── AT-9 · Layer 0 capability boundary
test("AT-9 no question asks for free text, numbers, dates or regions from a model", () => {
  const modelBacked = QUESTIONS.filter(q => q.choices.length > 0);
  for (const q of modelBacked) {
    assert.ok(q.choices.length > 0, `${q.id} must be a closed set`);
    for (const c of q.choices) assert.ok("value" in c, `${q.id} choice needs a typed value`);
  }
  const openEnded = QUESTIONS.filter(q => q.choices.length === 0).map(q => q.field);
  assert.deepEqual(openEnded.sort(), ["area", "requiredByDate"], "only user-typed fields may be open");
});

// ───────────────────────────────── AT-10 · dates are never silently converted
test("AT-10 「下週」 does not become a date", () => {
  const f = tokyoFrame();
  assert.equal(f.requiredByDate.provenance, "unknown");
  assert.equal(f.requiredByDate.value, null);
  const q = QUESTIONS.find(x => x.field === "requiredByDate")!;
  assert.equal(q.choices.length, 0, "she types the date; nothing infers it");
  assert.ok(q.why?.includes("不會自己換算"));
});

// ───────────────────────────────── AT-11 · tier upgrade shows absolute delta
test("AT-11 upgrade is offered unselected with the real spend change", () => {
  const cur: BasketLine[] = [
    { id: "nude-09", name: "a", price: 1880, promotionEligible: "yes", qty: 1 },
    { id: "panty-02", name: "b", price: 580, promotionEligible: "yes", qty: 1 },
  ];
  const avail: BasketLine[] = [{ id: "panty-01", name: "c", price: 580, promotionEligible: "yes", qty: 1 }];
  const up = tierUpgradeOption(cur, avail, new Date("2026-09-25T00:00:00+08:00"));
  assert.ok(up, "an upgrade to 3 items exists");
  assert.equal(up!.preSelected, false, "never pre-selected");
  assert.equal(typeof up!.absoluteDelta, "number", "absolute spend change must be reported");
  assert.ok(up!.addItems.length > 0);
});

// ───────────────────────────────── AT-12 · confidence absent or conflicting
test("AT-12 absent confidence degrades to unknown, never 0 or 1", async () => {
  const js = await evaluateProduct({
    productId: "nude-09", state: canonicalState(),
    questions: { vis: { type: "score", instructions: "x", criteria: ["a", "b", "c", "d"] } },
    hardConstraints: new Set(),
    transport: async () => ({ model: "typesafe-ai/jev", answers: { vis: { type: "score", score: 2.7 } } }),
  });
  assert.equal(js[0].confidence, undefined);
  assert.equal(js[0].verdict, "unknown");
});

test("AT-12-2 inline vs metadata mismatch becomes a conflict, not a coin toss", () => {
  const r = resolveConfidence("vis", 0.9, { vis: 0.4 });
  assert.ok(r.conflict, "mismatch must be recorded as a conflict");
  assert.equal(r.confidence, undefined, "must not silently pick one side");
});

test("AT-12-3 booleans carry no confidence, by contract", () => {
  assert.deepEqual(bandForBoolean(0.55, true), { verdict: "unknown", band: "dead" });
  assert.deepEqual(bandForBoolean(0.02, true), { verdict: "no", band: "low" });
  assert.deepEqual(bandForBoolean(0.9, true), { verdict: "yes", band: "high" });
});

// ───────────────────────────────── AT-13 · expired campaign
test("AT-13 after the campaign ends no tier is applied", () => {
  const lines: BasketLine[] = [
    { id: "a", name: "a", price: 1880, promotionEligible: "yes", qty: 1 },
    { id: "b", name: "b", price: 580, promotionEligible: "yes", qty: 1 },
    { id: "c", name: "c", price: 580, promotionEligible: "yes", qty: 1 },
  ];
  const after = calculate(lines, new Date("2026-10-16T09:00:00+08:00"));
  assert.equal(after.appliedTier, "none");
  assert.equal(after.finalTotal, after.preDiscountTotal);
  assert.ok(after.notes.some(n => n.includes("活動已結束")));
});

test("AT-13-2 our earlier end date governs, the site's later one is observation only", () => {
  assert.equal(PROMO.validityEnd, "2026-10-15T23:59:59+08:00");
  assert.equal(PROMO.observedSiteEnd, "2026-10-16T08:00:00+08:00");
  const between = new Date("2026-10-16T03:00:00+08:00");
  const c = calculate([{ id: "a", name: "a", price: 1880, promotionEligible: "yes", qty: 3 }], between);
  assert.equal(c.appliedTier, "none", "we stop claiming before the site stops giving");
});

// ───────────────────────────────── AT-14 · the reason for asking is the reason for acting
test("AT-14 no question is triggered by a promotion tier", () => {
  for (const q of QUESTIONS) {
    const blob = `${q.ask} ${q.why ?? ""}`;
    assert.ok(!/折|優惠|省|便宜|划算/.test(blob), `${q.id} must not be motivated by the discount`);
  }
});

test("AT-14-2 trip length never becomes quantity", () => {
  const f = tokyoFrame({ tripDurationDays: confirmed(7) });
  assert.equal(f.quantityIntent.provenance, "unknown", "days must not derive quantity");
  assert.equal(f.quantityIntent.value, null);
});

// ───────────────────────────────── AT-15 · Hobby payload guard (strict schema)
const okPayload = (context: unknown) => ({
  model: "typesafe-ai/jev",
  state: { product: projectProductState(NUDE_PRODUCTS.find(p => p.id === "nude-09")!), context },
  questions: {},
});

test("AT-15 free text inside a LEGAL field is still blocked", () => {
  // The field name is on the allowlist; the value is a sentence. This is exactly the
  // case a length or regex heuristic would wave through.
  assert.throws(
    () => assertHobbySafe(okPayload({ outerGarment: "下週去東京穿白襯衫" })),
    PrivacyViolationError);
  assert.equal(isHobbySafe(okPayload({ outerGarment: "薄" })), false, "even a one-character value");
  assert.equal(isHobbySafe(okPayload({ outerGarment: "thin_fitted" })), false,
    "legal primitives still lack confirmed UserField provenance");
});

test("AT-15-2 raw utterance, extra fields and wrong types all throw", () => {
  assert.equal(isHobbySafe(okPayload({ utterance: "下週要去東京出差" })), false);
  assert.equal(isHobbySafe(okPayload({ email: "a@b.com" })), false);
  assert.equal(isHobbySafe(okPayload({ area: "台北市大安區" })), false, "area is not a Gateway field");
  assert.equal(isHobbySafe(okPayload({ needsNudeColourway: "yes" })), false, "wrong type");
  assert.equal(isHobbySafe(okPayload({ wearDuration: 8 })), false, "wrong type");
  assert.equal(isHobbySafe({ state: { context: {} }, secrets: 1 }), false, "unexpected top-level key");
  assert.equal(isHobbySafe({ state: { notes: "x", context: {} } }), false, "unexpected state key");
});

test("AT-15-3 the caller cannot hand in an arbitrary object", () => {
  assert.equal(isHobbySafe(okPayload("thin_fitted")), false, "context must be an object");
  assert.equal(isHobbySafe(okPayload(["thin_fitted"])), false, "arrays rejected");
  assert.equal(isHobbySafe({ ...okPayload({}), state: { product: "nude-09", context: {} } }), false);
});

test("AT-15-4 only confirmed fields are built into an outbound context", () => {
  const f = tokyoFrame({ canPassOverHead: confirmed(true) });
  f.canReachBackClosure = stated(false);      // stated, not confirmed
  const ctx = buildOutboundContext(f);
  assert.equal(ctx.outerGarment, "thin_fitted");
  assert.equal(ctx.canPassOverHead, true);
  assert.ok(!("canReachBackClosure" in ctx), "stated-but-unconfirmed must not be sent");
  assert.ok(!("budgetMaxTwd" in ctx), "budget is deterministic; it never goes to the model");
  assert.equal(isHobbySafe(okPayload(ctx)), true, "a built context always validates");
});

// ───────────────────────────────── set budget (whole basket, not per item)
test("SET-BUDGET per-item affordable but the set overshoots is NOT within budget", () => {
  const lines: BasketLine[] = [
    { id: "nude-03", name: "雪紡貝蕾", price: 2980, promotionEligible: "unknown", qty: 1 },
    { id: "panty-08", name: "超激塑", price: 1280, promotionEligible: "unknown", qty: 1 },
  ];
  const budget = 3000;
  for (const l of lines) assert.ok(l.price < budget, "each item alone is affordable");
  const calc = calculate(lines, new Date("2026-09-25T00:00:00+08:00"));
  const check = checkSetBudget(calc, budget);
  assert.equal(calc.defaultTotal, 4260);
  assert.equal(check.withinBudget, false, "the set overshoots and must not read as within budget");
  assert.equal(check.overBy, 1260);
  assert.ok(check.note && check.note.includes("整組"));
});

test("SET-BUDGET the demo set really is within budget", () => {
  const lines: BasketLine[] = [
    { id: "nude-09", name: "魔幻時尚前扣", price: 1880, promotionEligible: "unknown", qty: 1 },
    { id: "panty-02", name: "魔幻時尚無痕", price: 580, promotionEligible: "unknown", qty: 1 },
  ];
  const check = checkSetBudget(calculate(lines, new Date("2026-09-25T00:00:00+08:00")), 3000);
  assert.equal(check.defaultTotal, 2460, "list price: terms are unverified");
  assert.equal(check.withinBudget, true);
  assert.equal(check.overBy, 0);
});

test("SET-BUDGET three sets checked against the ceiling, not per unit", () => {
  const lines: BasketLine[] = [
    { id: "nude-09", name: "a", price: 1880, promotionEligible: "unknown", qty: 3 },
    { id: "panty-02", name: "b", price: 580, promotionEligible: "unknown", qty: 3 },
  ];
  const check = checkSetBudget(calculate(lines, new Date("2026-09-25T00:00:00+08:00")), 5000);
  assert.equal(check.defaultTotal, 7380);
  assert.equal(check.withinBudget, false, "quantity must be counted against the set ceiling");
});
