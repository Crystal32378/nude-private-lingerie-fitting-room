/**
 * Orchestration: gates -> (optional) JEV -> buckets. v3 §五 / §十四.
 *
 * Three result paths is a MAXIMUM, never a quota. Zero is a first-class,
 * renderable outcome. Nothing is ever padded to fill the screen.
 */
import { NUDE_PRODUCTS, getProductById, type Product } from "../products.ts";
import { runGates, highestLeverageQuestion, type GateRun } from "./gates.ts";
import { byField } from "./questions.ts";
import type { DecisionResult, ResultItem, SituationFrame, TradeoffTask, TradeoffResult } from "./types.ts";
import { projectTradeoffState, type TaskField } from "./privacy.ts";
import { buildBasketOptions } from "./promotion.ts";

export const MAX_BEST_FIT = 3;

/** Fields we may quote. A comfort claim with no field behind it is not allowed. */
function factReasons(p: Product): { text: string; field: string }[] {
  const closure = p.closure.startsWith("front") ? "前扣，不需背手"
    : p.closure.startsWith("none") ? "無背扣，直接套上" : `背扣（${p.closure}）`;
  const out = [{ text: closure, field: "closure" }];
  out.push({ text: p.wire === "wireless" ? "無鋼圈" : "軟鋼圈", field: "wire" });
  if (/裸|膚/.test(p.colors.join(""))) out.push({ text: `有裸色（${p.colors.join("、")}）`, field: "colors" });
  out.push({ text: `NT$${p.price}`, field: "price" });
  return out;
}

export function decide(frame: SituationFrame, judgments: Map<string, string[]> = new Map()): DecisionResult {
  const run: GateRun = runGates(frame);
  const items: ResultItem[] = [];

  for (const g of run.bras) {
    const p = getProductById(g.productId)!;
    const uncertain = [...(judgments.get(g.productId) ?? []), ...(g.unknowns ?? [])];

    if (!g.passed) {
      items.push({
        productId: p.id, bucket: "not_a_fit",
        reasons: g.blockers.map((b) => ({ text: b.text, field: b.field })),
        uncertain,
        openQuestion: g.reversibleBy ? openQuestionFor(g.reversibleBy) : undefined,
      });
      continue;
    }
    if (g.reversibleBy || g.unknowns?.length) {
      // Held open by a question, not excluded. nude-08 lives here. v3 §五
      items.push({
        productId: p.id, bucket: "check_with_you",
        reasons: factReasons(p), uncertain,
        openQuestion: g.reversibleBy ? openQuestionFor(g.reversibleBy) : undefined,
      });
      continue;
    }
    items.push({ productId: p.id, bucket: "best_fit", reasons: factReasons(p), uncertain });
  }

  // Cap presentation, never rewrite product classification to fit a layout.
  const best = items.filter((i) => i.bucket === "best_fit");

  return {
    items,
    bestFitCount: Math.min(best.length, MAX_BEST_FIT),
    whyOnlyN: explain(run, frame),
    degraded: false,
  };
}

function openQuestionFor(field: keyof SituationFrame) {
  const q = byField(field);
  return q ? { id: q.id, ask: q.ask, field, options: q.choices } : undefined;
}

/** Names which constraint removed which products, by field. Never a bare count. */
function explain(run: GateRun, frame: SituationFrame): string[] {
  const out: string[] = [];
  const total = NUDE_PRODUCTS.length;
  const noNude = run.bras.filter((g) => g.blockers.some((b) => b.field === "colors"));
  const backClosure = run.bras.filter((g) => g.blockers.some((b) => b.field === "closure"));
  const overBudget = run.bras.filter((g) => g.blockers.some((b) => b.field === "price"));

  if (noNude.length) out.push(`${total} 件裡有 ${noNude.length} 件沒有裸色`);
  if (backClosure.length) out.push(`${backClosure.length} 件是背扣，妳說過背扣不好操作`);
  if (overBudget.length) out.push(`${overBudget.length} 件超過預算上限`);
  if (run.openBraIds.length) out.push(`${run.openBraIds.length} 件還需要跟妳確認一個問題`);

  const lever = highestLeverageQuestion(frame);
  if (lever) {
    const q = byField(lever);
    if (q) out.push(`回答「${q.ask}」會改變最多選項`);
  }
  if (run.eligibleBraIds.length === 0) {
    out.push("目前這九件裡沒有同時符合妳所有條件的。這不是錯誤，是這批商品的真實狀況。");
  }
  return out;
}

/** Fail-closed render when JEV is unavailable. Deterministic facts still hold. AT-6 */
export function decideDegraded(frame: SituationFrame): DecisionResult {
  const r = decide(frame);
  return {
    ...r, degraded: true,
    whyOnlyN: [...r.whyOnlyN, "部分判斷這次沒有完成，以下只顯示不需要模型也成立的事實"],
  };
}

export type AgentAction =
  | { kind: "confirm"; fields: TaskField[] }
  | { kind: "ask"; field: TaskField }
  | { kind: "judge"; task: TradeoffTask; key: string }
  | { kind: "recommend" };

const CORE_FIELDS: TaskField[] = ["canReachBackClosure", "needsNudeColourway", "requiresNoVisibleLines",
  "priority", "matchingSetDesired", "quantityIntent", "budgetMaxTwd"];

/** Re-evaluate after each answer; no stage counter, hidden quantity inference,
 * or retry loop. The set holds completed AND failed projections for this visit. */
export function planNextAction(frame: SituationFrame, attempted = new Set<string>(), priorStyle?: TradeoffResult): AgentAction {
  const missing = CORE_FIELDS.filter(key => frame[key].provenance !== "confirmed");
  if (missing.length) return { kind: "confirm", fields: missing };
  const potential = runGates(frame).bras.filter(g => g.passed);
  const minimumBraCost = Math.min(...potential.map(g => getProductById(g.productId)!.price)) * (frame.quantityIntent.value ?? 1);
  // Even before adding a panty, no possible answer to an operation question can
  // put this confirmed quantity inside the budget. Do not ask a useless question.
  if (frame.budgetMaxTwd.value !== null && minimumBraCost > frame.budgetMaxTwd.value) return { kind: "recommend" };
  const followup = highestLeverageQuestion(frame);
  if (followup && frame[followup].provenance !== "confirmed") return { kind: "ask", field: followup as TaskField };
  const style = projectTradeoffState("style_tradeoff", frame);
  if (style) {
    const key = JSON.stringify(style);
    if (!attempted.has(key)) return { kind: "judge", task: "style_tradeoff", key };
  }
  const readyBaskets = buildBasketOptions(frame).filter(b => !b.needsReview);
  if (style && priorStyle?.task === "style_tradeoff" && priorStyle.status === "complete"
    && style.products.every(p => priorStyle.judgments.some(j => j.targetId === p.id && j.status === "judged"))) {
    const preferred = priorStyle.judgments.filter(j => j.choice === "prefer" && j.status === "judged");
    if (preferred.length === 1 && readyBaskets.some(b => b.braId === preferred[0].targetId
      && b.calculation.defaultTotal === readyBaskets[0]?.calculation.defaultTotal)) return { kind: "recommend" };
  }
  if (readyBaskets.length > 1 && frame.basketPriority.provenance !== "confirmed") {
    return { kind: "ask", field: "basketPriority" };
  }
  const basket = projectTradeoffState("basket_tradeoff", frame);
  if (basket) {
    const key = JSON.stringify(basket);
    if (!attempted.has(key)) return { kind: "judge", task: "basket_tradeoff", key };
  }
  return { kind: "recommend" };
}

/** Choice semantics stay intact. "Lower priority" never removes a fit-compatible
 * product; absent evidence never creates a confident model recommendation. */
export function recommendStyles(frame: SituationFrame, result?: TradeoffResult): ResultItem[] {
  const items = decide(frame).items;
  const rank: Record<string, number> = { prefer: 0, consider: 1, lower_priority: 3 };
  const choices = new Map(result?.task === "style_tradeoff" && result.status === "complete"
    ? result.judgments.map(j => [j.targetId, j]) : []);
  const hasBasket = frame.quantityIntent.provenance === "confirmed" && frame.quantityIntent.value !== null
    && frame.matchingSetDesired.provenance === "confirmed" && frame.matchingSetDesired.value !== null
    && frame.budgetMaxTwd.provenance === "confirmed" && frame.budgetMaxTwd.value !== null;
  const affordable = new Set(buildBasketOptions(frame).map(b => b.braId));
  return items.filter(i => i.bucket === "best_fit" && (!hasBasket || affordable.has(i.productId))).sort((a, b) => {
    const ja = choices.get(a.productId), jb = choices.get(b.productId);
    const ar = ja?.status === "judged" ? rank[ja.choice] ?? 2 : 2;
    const br = jb?.status === "judged" ? rank[jb.choice] ?? 2 : 2;
    return ar - br || getProductById(a.productId)!.price - getProductById(b.productId)!.price
      || a.productId.localeCompare(b.productId);
  }).slice(0, MAX_BEST_FIT);
}
