import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyFrame, type SituationFrame } from "../types.ts";
import { decide, planNextAction, recommendStyles } from "../decide.ts";
import { buildBasketOptions, buildBudgetComparison } from "../promotion.ts";
import { buildTaskRequest, buildTradeoffPayload, parseTaskRequest, projectTradeoffState, assertHobbySafe } from "../privacy.ts";
import { evaluateTradeoff, type JevTransport } from "../jev.ts";
import { mentionsDailyRotation } from "../questions.ts";

const c = <T>(value: T) => ({ value, provenance: "confirmed" as const });
function frame(patch: Partial<SituationFrame> = {}): SituationFrame {
  return { ...emptyFrame(), canReachBackClosure: c(true), canPassOverHead: c(true),
    needsNudeColourway: c(true), requiresNoVisibleLines: c(false), priority: c("balanced"),
    matchingSetDesired: c(false), quantityIntent: c(1), budgetMaxTwd: c(5000),
    basketPriority: c("construction_balance"), ...patch };
}
const fake: JevTransport = async (body: any) => ({
  model: "typesafe-ai/jev",
  answers: Object.fromEntries(Object.entries(body.questions).map(([id, q]: [string, any]) => {
    const keys = Object.keys(q.criteria);
    return [id, { type: "choice", choice: keys[0], probabilities: Object.fromEntries(keys.map((key, i) => [key, i === 0 ? 1 : 0])) }];
  })),
  providerMetadata: { typesafe: { confidence: Object.fromEntries(Object.keys(body.questions).map(id => [id, 0.9])) } },
});

test("loop asks only unconfirmed needs, never promotes local text hints", () => {
  const step = planNextAction(emptyFrame());
  assert.equal(step.kind, "confirm");
  if (step.kind === "confirm") {
    assert.ok(step.fields.includes("quantityIntent"));
    assert.ok(!(step.fields as string[]).includes("area"));
    assert.ok(!(step.fields as string[]).includes("tripDurationDays"));
  }
});

test("display cap never turns a qualifying fourth product into unknown", () => {
  const result = decide(frame());
  assert.ok(result.items.filter(item => item.bucket === "best_fit").length > 3);
  assert.equal(result.bestFitCount, 3);
  assert.ok(!result.items.some(item => item.bucket === "check_with_you" && !item.openQuestion && !item.uncertain.length));
});

test("only one eligible style needs no model; answered unknown is not asked forever", () => {
  const f = frame({ canReachBackClosure: c(false), canRotateBandAroundTorso: c(false), canPassOverHead: c(false) });
  assert.equal(projectTradeoffState("style_tradeoff", f), null);
  assert.equal(planNextAction(f).kind, "recommend");
});

test("a hard no-visible-lines requirement remains unknown; JEV compares but cannot certify it", () => {
  const f = frame({ requiresNoVisibleLines: c(true) });
  assert.equal(decide(f).bestFitCount, 0);
  // Held open, not excluded: construction trade-offs may still be compared...
  const state = projectTradeoffState("style_tradeoff", f)!;
  assert.ok(state.products.length >= 2);
  // ...but the contract forbids judging visibility, and every card stays "needs your answer".
  assert.match(buildTradeoffPayload(state).questions[`style_${state.products[0].id}`].instructions, /visibility through a shirt/);
  assert.ok(decide(f).items.filter(i => i.bucket !== "not_a_fit").every(i => i.bucket === "check_with_you"));
});

test("unresolved confirmed operation restrictions never silently pass", () => {
  for (const field of ["canRaiseArmsOverhead", "canPerformFineMotorPinch"] as const) {
    const f = frame({ [field]: c(false) });
    assert.equal(decide(f).bestFitCount, 0);
    // Still open, so JEV may compare them; none becomes best fit.
    assert.ok(projectTradeoffState("style_tradeoff", f));
  }
  assert.equal(decide(frame({ canReachBackClosure: { value: null, provenance: "confirmed" } })).bestFitCount, 0);
});

test("typed request rejects raw fields, extra fields, short prose, and unconfirmed provenance", () => {
  const valid = buildTaskRequest("style_tradeoff", frame());
  for (const fields of [
    { outerGarment: "thin_fitted" },
    { outerGarment: c("下週去東京穿白襯衫") },
    { priority: { value: "comfort", provenance: "stated" } },
    { email: c("synthetic@example.invalid") },
    { quantityIntent: c(10) },
  ]) assert.throws(() => parseTaskRequest({ ...valid, fields }));
  assert.throws(() => parseTaskRequest({ ...valid, product: { seam_construction: "flat" } }));
});

test("both task projections block invented evidence and context even after serialization", () => {
  for (const task of ["style_tradeoff", "basket_tradeoff"] as const) {
    const state = projectTradeoffState(task, frame())!;
    assert.ok(state);
    assert.throws(() => assertHobbySafe({ model: "typesafe-ai/jev", state: { ...state, utterance: "私密困擾" }, questions: {} }));
    const copied = JSON.parse(JSON.stringify(state));
    copied.products[0].seam_construction = "invented";
    assert.throws(() => assertHobbySafe({ model: "typesafe-ai/jev", state: copied, questions: {} }));
  }
});

test("style task sends one batch of Choice questions and preserves the actual choice", async () => {
  let calls = 0;
  const transport: JevTransport = async (body: any, signal) => {
    calls++;
    assert.equal(body.state.task, "style_tradeoff");
    assert.equal(body.providerOptions.gateway.disallowPromptTraining, true);
    assert.ok(!JSON.stringify(body).includes("台北"));
    const res = await fake(body, signal);
    for (const answer of Object.values(res.answers)) {
      answer.choice = "lower_priority";
      answer.probabilities = { prefer: 0, consider: 0, lower_priority: 1, insufficient_evidence: 0 };
    }
    return res;
  };
  const result = await evaluateTradeoff(buildTaskRequest("style_tradeoff", frame({ area: c("台北") })), transport);
  assert.equal(calls, 1);
  assert.equal(result.status, "complete");
  assert.ok(result.judgments.every(j => j.choice === "lower_priority" && j.status === "judged"));
});

test("rules-only basket tasks do not reach transport; no stated preference still gets a style comparison", async () => {
  const f = frame({ priority: c("not_stated"), basketPriority: c("lowest_total") });
  let calls = 0;
  const basket = await evaluateTradeoff(buildTaskRequest("basket_tradeoff", f), async (...args) => { calls++; return fake(...args); });
  assert.equal(basket.status, "skipped");
  assert.equal(calls, 0);
  const style = await evaluateTradeoff(buildTaskRequest("style_tradeoff", f), async (...args) => { calls++; return fake(...args); });
  assert.equal(style.status, "complete");
  assert.equal(calls, 1);
});

test("styles excluded by a hard blocker never reach JEV", () => {
  const f = frame({ needsNudeColourway: c(true) });
  const state = projectTradeoffState("style_tradeoff", f)!;
  const excluded = decide(f).items.filter(i => i.bucket === "not_a_fit").map(i => i.productId);
  assert.ok(excluded.length > 0);
  assert.ok(state.products.every(p => !excluded.includes(p.id)));
});

test("basket prices and quantity come from code, not the request or JEV", async () => {
  const f = frame({ quantityIntent: c(2) });
  const options = buildBasketOptions(f);
  assert.ok(options.length > 1);
  for (const b of options) {
    assert.equal(b.lines.filter(l => l.id.startsWith("nude-")).reduce((n, l) => n + l.qty, 0), 2);
    // Public activity price from the deterministic engine, never from the request or JEV.
    assert.equal(b.calculation.defaultTotal, Math.round(b.lines.reduce((n, l) => n + l.price * l.qty, 0) * 0.9));
    assert.equal(b.calculation.defaultTotal, b.calculation.finalTotal);
    assert.ok(b.budget.withinBudget);
  }
  const result = await evaluateTradeoff(buildTaskRequest("basket_tradeoff", f), fake);
  assert.equal(result.status, "complete");
  assert.ok(options.some(b => b.id === result.judgments[0].choice));
});

test("Tokyo one-set comparison keeps original total separate from conditional simulations", () => {
  const f = frame({ matchingSetDesired: c(true), quantityIntent: c(1) });
  const basket = buildBasketOptions(f).find(option => option.braId === "nude-09" && option.pantyId === "panty-02");
  assert.ok(basket, "nude-09 must have its official p-02 partner");
  const comparison = buildBudgetComparison(basket!);
  assert.deepEqual(comparison && {
    one: [comparison.oneSet.originalTotal, comparison.oneSet.conditionalSimulation, comparison.oneSet.deltaFromOneSet],
    threeBras: [comparison.threeBras.originalTotal, comparison.threeBras.conditionalSimulation, comparison.threeBras.deltaFromOneSet],
    threeSets: [comparison.threeSets.originalTotal, comparison.threeSets.conditionalSimulation, comparison.threeSets.deltaFromOneSet],
    termsVerified: comparison.termsVerified,
  }, {
    one: [2460, 2214, 0],
    threeBras: [5640, 3948, 1734],
    threeSets: [7380, 3690, 1476],
    termsVerified: true,
  });
  // Average per set comes from the three-set activity price; the basket itself is unchanged.
  assert.equal(comparison!.threeSetsConditionalAveragePerSet, 1230);
  assert.equal(basket!.calculation.defaultTotal, 2214);
  assert.equal(basket!.calculation.preDiscountTotal, 2460);
  assert.deepEqual(basket!.lines.map(line => line.qty), [1, 1]);
});

test("daily-rotation wording hint needs her own words and never touches the task request", () => {
  assert.equal(mentionsDailyRotation("下週去東京出差穿白襯衫，想搭配一套"), false);
  assert.equal(mentionsDailyRotation("想要日常替換用的"), true);
  const request = JSON.stringify(buildTaskRequest("basket_tradeoff", frame({ matchingSetDesired: c(true), quantityIntent: c(1) })));
  assert.ok(!request.includes("日常") && !request.includes("替換"));
});

test("basket proposals never reinstate excluded bras or silently add quantity", () => {
  const f = frame({ canReachBackClosure: c(false), canRotateBandAroundTorso: c(false), canPassOverHead: c(false), quantityIntent: c(1) });
  const baskets = buildBasketOptions(f);
  assert.equal(baskets.length, 1);
  assert.deepEqual(baskets[0].lines.map(l => [l.id, l.qty]), [["nude-09", 1]]);
});

test("style recommendation also respects the confirmed whole-basket ceiling", () => {
  // Cheapest eligible bra ×3 at 七折 is NT$3,948, still over a NT$3,000 ceiling.
  const f = frame({ quantityIntent: c(3), budgetMaxTwd: c(3000) });
  assert.equal(recommendStyles(f).length, 0);
  assert.equal(projectTradeoffState("style_tradeoff", f), null);
  assert.equal(planNextAction({ ...f, canPassOverHead: { value: null, provenance: "unknown" } }).kind, "recommend");
});

test("unreviewed panties do not become verified baskets; all calculations remain conditional", () => {
  const baskets = buildBasketOptions(frame({ matchingSetDesired: c(true) }));
  assert.ok(baskets.length > 0);
  assert.ok(baskets.every(b => b.needsReview && b.unknowns.length > 0));
  assert.equal(projectTradeoffState("basket_tradeoff", frame({ matchingSetDesired: c(true) })), null);
});

test("malformed Choice, confidence conflict, or JEV failure cannot become a recommendation", async () => {
  for (const mode of ["outage", "bad_choice", "conflict", "missing_confidence", "nan_distribution", "nan_confidence"] as const) {
    const result = await evaluateTradeoff(buildTaskRequest("style_tradeoff", frame()), async (body, signal) => {
      if (mode === "outage") throw new Error("synthetic 429");
      const res = await fake(body, signal);
      for (const a of Object.values(res.answers)) {
        if (mode === "bad_choice") a.choice = "not_a_real_option";
        if (mode === "conflict") a.confidence = 0.1;
        if (mode === "nan_confidence") a.confidence = NaN;
        if (mode === "nan_distribution") a.probabilities.prefer = NaN;
      }
      if (mode === "missing_confidence") delete res.providerMetadata;
      return res;
    });
    assert.ok(result.status === "unavailable" || result.judgments.every(j => j.status === "unknown"));
    assert.ok(decide(frame()).bestFitCount > 0, "facts still work");
  }
});

test("completed/failed task is not repeated when a quantity edit leaves candidates unchanged", () => {
  const f = frame({ budgetMaxTwd: c(8000) });
  const first = planNextAction(f);
  assert.equal(first.kind, "judge");
  if (first.kind !== "judge") return;
  assert.equal(first.task, "style_tradeoff");
  const done = new Set([first.key]);
  const second = planNextAction({ ...f, quantityIntent: c(2) }, done);
  assert.ok(second.kind !== "judge" || second.task !== "style_tradeoff");
});

test("abstention preserves the model's original Choice and probabilities", async () => {
  const result = await evaluateTradeoff(buildTaskRequest("style_tradeoff", frame()), async (body: any, signal) => {
    const res = await fake(body, signal);
    for (const [id, answer] of Object.entries(res.answers)) {
      answer.choice = "consider";
      answer.probabilities = { prefer: 0.15, consider: 0.72, lower_priority: 0.04, insufficient_evidence: 0.09 };
      res.providerMetadata!.typesafe!.confidence![id] = 0.62;
    }
    return res;
  });
  assert.ok(result.judgments.every(j => j.choice === "consider" && j.status === "unknown" && j.probabilities.consider === 0.72));
});

test("a uniquely preferred style at the lowest total needs no second judgment", async () => {
  const f = frame();
  const style = await evaluateTradeoff(buildTaskRequest("style_tradeoff", f), async (body: any, signal) => {
    const res = await fake(body, signal);
    for (const [id, answer] of Object.entries(res.answers)) {
      const choice = id === "style_nude-09" ? "prefer" : "lower_priority";
      answer.choice = choice;
      answer.probabilities = { prefer: choice === "prefer" ? 1 : 0, consider: 0, lower_priority: choice === "lower_priority" ? 1 : 0, insufficient_evidence: 0 };
    }
    return res;
  });
  const state = projectTradeoffState("style_tradeoff", f)!;
  assert.equal(planNextAction(f, new Set([JSON.stringify(state)]), style).kind, "recommend");
});

test("task payload cannot replace fixed questions, model or training policy", async () => {
  let captured: any;
  await evaluateTradeoff(buildTaskRequest("style_tradeoff", frame()), async (body, signal) => {
    captured = body;
    return fake(body, signal);
  });
  assert.doesNotThrow(() => assertHobbySafe(captured));
  for (const patch of [
    { model: "private text" },
    { questions: { leak: { type: "choice", instructions: "私密困擾", criteria: { a: "a" } } } },
    { providerOptions: { gateway: { disallowPromptTraining: false } } },
  ]) assert.throws(() => assertHobbySafe({ ...captured, ...patch }));
});

test("a transport that ignores AbortSignal still ends in a bounded degraded result", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const pending = evaluateTradeoff(buildTaskRequest("style_tradeoff", frame()), async () => new Promise(() => {}));
  t.mock.timers.tick(8000);
  assert.equal((await pending).status, "unavailable");
});
