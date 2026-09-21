import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyFrame, type SituationFrame } from "../types.ts";
import { mentionsMovement, byField } from "../questions.ts";
import { recommendStyles } from "../decide.ts";
import { buildTaskRequest, parseTaskRequest, projectTradeoffState } from "../privacy.ts";

const c = <T,>(value: T) => ({ value, provenance: "confirmed" as const });
const active = (): SituationFrame => ({ ...emptyFrame(),
  canReachBackClosure: c(true), needsNudeColourway: c(false), requiresNoVisibleLines: c(false),
  priority: c("movement" as const), matchingSetDesired: c(false), quantityIntent: c(1), budgetMaxTwd: c(3000),
  canPassOverHead: c(true) });

test("her words about moving are recognised, other words are not", () => {
  assert.equal(mentionsMovement("想找一件去健身房穿的"), true);
  assert.equal(mentionsMovement("I need a sports bra for the gym"), true);
  assert.equal(mentionsMovement("出差要穿白襯衫"), false);
});

test("movement is an option on the existing priority question, not a new question", () => {
  assert.ok(byField("priority")!.choices.some(ch => ch.value === "movement"));
});

test("movement priority crosses the privacy boundary as a closed value", () => {
  const { frame } = parseTaskRequest(buildTaskRequest("style_tradeoff", active()));
  assert.equal(frame.priority.value, "movement");
  const state = projectTradeoffState("style_tradeoff", active());
  assert.ok(state);
  assert.ok(state!.products.some(p => p.id === "nude-10"), "the pull-on piece reaches JEV once she can pass it over her head");
});

test("a piece she opened in the showroom leads among equal judgments", () => {
  const plain = recommendStyles(active()).map(i => i.productId);
  const seen = recommendStyles(active(), undefined, ["nude-10"]).map(i => i.productId);
  assert.ok(!plain.includes("nude-10"), "without the showroom signal the cheaper pieces fill the three slots");
  assert.equal(seen[0], "nude-10");
  assert.equal(seen.length, 3);
});
