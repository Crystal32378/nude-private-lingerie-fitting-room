/**
 * The long-form Q&A. v3 §七 / §十三.
 *
 * Every question is a closed set. The raw life-problem text never leaves the
 * browser; it only decides WHICH of these get asked, via deterministic keyword
 * matching that runs client-side with no model and no network.
 */
import type { SituationFrame } from "./types.ts";

export type Stage =
  | "access" | "occasion" | "appearance" | "set" | "size" | "budget" | "quantity" | "logistics";

export interface Choice { label: string; value: unknown }

export interface Question {
  id: string;
  field: keyof SituationFrame;
  stage: Stage;
  ask: string;
  /** Said out loud when the reason is not self-evident. v3 §七 Step 4. */
  why?: string;
  choices: Choice[];
}

const YN = (yes: string, no: string): Choice[] => [
  { label: yes, value: true }, { label: no, value: false }, { label: "不確定", value: null },
];

export const QUESTIONS: Question[] = [
  // ---- 1. dressing access ----
  { id: "q_back", field: "canReachBackClosure", stage: "access",
    ask: "背扣對妳來說好操作嗎？",
    choices: YN("可以，沒問題", "不好操作") },
  { id: "q_rotate", field: "canRotateBandAroundTorso", stage: "access",
    ask: "可以先在身前扣好，再把它轉到背後嗎？",
    why: "這一題會改變最多選項——回答之後，背扣款有可能重新進入考慮。",
    choices: YN("可以", "不行") },
  { id: "q_overhead", field: "canRaiseArmsOverhead", stage: "access",
    ask: "把手舉高過頭，對妳來說困難嗎？",
    choices: [{ label: "不困難", value: true }, { label: "困難", value: false }, { label: "不確定", value: null }] },
  { id: "q_overhead_pass", field: "canPassOverHead", stage: "access",
    ask: "有一件是繞頸不可拆的設計，要從頭套下去。這樣妳可以嗎？",
    why: "這件從前面扣，但頸圈不能拆開，所以頭仍然要穿過去。只有妳能回答這一題。",
    choices: YN("可以", "沒辦法") },
  { id: "q_pinch", field: "canPerformFineMotorPinch", stage: "access",
    ask: "用兩隻手捏住小扣環對齊，對妳來說可以嗎？",
    choices: YN("可以", "有困難") },

  // ---- 2. occasion ----
  { id: "q_garment", field: "outerGarment", stage: "occasion",
    ask: "外面那件白襯衫是合身薄料，還是較寬鬆、較厚的布料？",
    choices: [
      { label: "合身、薄料", value: "thin_fitted" },
      { label: "寬鬆或較厚", value: "thick_or_loose" },
      { label: "其他衣物", value: "other" },
    ] },
  { id: "q_duration", field: "wearDuration", stage: "occasion",
    ask: "那天大概會穿多久？",
    choices: [
      { label: "4 小時以內", value: "under_4" },
      { label: "4 到 8 小時", value: "4_to_8" },
      { label: "超過 8 小時", value: "over_8" },
    ] },
  { id: "q_priority", field: "priority", stage: "occasion",
    ask: "出差時更重視整天舒適，還是希望胸型更集中俐落？",
    choices: [
      { label: "舒適", value: "comfort" },
      { label: "塑形", value: "shaping" },
      { label: "都要，平衡就好", value: "balanced" },
    ] },

  // ---- 3. appearance ----
  { id: "q_nude", field: "needsNudeColourway", stage: "appearance",
    ask: "需要裸色嗎？",
    choices: YN("需要", "不一定") },
  { id: "q_lines", field: "requiresNoVisibleLines", stage: "appearance",
    ask: "衣服下面完全不顯線條，是這次不能退讓的條件嗎？",
    why: "裸色與無痕是兩件事。目前缺少薄白襯衫的實測，不能保證無痕。",
    choices: YN("是，必須先確認無痕", "可以先比較構造") },

  // ---- 4. matching set ----
  { id: "q_set", field: "matchingSetDesired", stage: "set",
    ask: "要不要一起搭配內褲？",
    why: "內褲我們不做試穿——實體店本來也不會試。這裡只幫妳看價格和尺寸。",
    choices: YN("要", "不用") },

  // ---- 5. size: the user picks from the site's own chart. Never inferred. ----
  { id: "q_size", field: "pantySize", stage: "size",
    ask: "內褲尺寸請妳自己選一個（依官網對照表）",
    why: "這是官網寫的腰臀圍對照，我們不會替妳從內衣尺碼推算。",
    choices: [
      { label: "S　32-35 吋", value: "S" },
      { label: "M　36-39 吋", value: "M" },
      { label: "L　40-42 吋", value: "L" },
    ] },

  // ---- 6. budget: a ceiling, never a target ----
  { id: "q_budget", field: "budgetMaxTwd", stage: "budget",
    ask: "這次最多想花到多少？",
    choices: [
      { label: "NT$3,000 以內", value: 3000 },
      { label: "NT$5,000 以內", value: 5000 },
      { label: "NT$8,000 以內", value: 8000 },
    ] },

  // ---- 7. quantity: confirmed by her, never derived from trip length ----
  { id: "q_days", field: "tripDurationDays", stage: "quantity",
    ask: "這趟出差大概幾天？",
    why: "只是想確認要不要多帶一套替換，不會替妳決定數量。",
    choices: [
      { label: "3 天以內", value: 3 }, { label: "4 到 7 天", value: 7 }, { label: "超過一週", value: 10 },
    ] },
  { id: "q_qty", field: "quantityIntent", stage: "quantity",
    ask: "這次想買幾套？",
    choices: [
      { label: "1 套", value: 1 }, { label: "2 套", value: 2 }, { label: "3 套", value: 3 },
    ] },
  { id: "q_basket_priority", field: "basketPriority", stage: "budget",
    ask: "比較組合時，妳最在意什麼？",
    choices: [{ label: "符合需求下，總額最低", value: "lowest_total" },
      { label: "也比較款式與構造的取捨", value: "construction_balance" }] },

  // ---- 8. logistics ----
  { id: "q_date", field: "requiredByDate", stage: "logistics",
    ask: "最晚哪一天要拿到？",
    why: "為了確認出發前真的拿得到，這一題要請妳給確切日期——「下週」我們不會自己換算。",
    choices: [] },
  { id: "q_receive", field: "receiveMethod", stage: "logistics",
    ask: "比較方便取貨還是收件？",
    choices: [{ label: "門市取貨", value: "pickup" }, { label: "宅配到府", value: "delivery" }] },
  { id: "q_area", field: "area", stage: "logistics",
    ask: "配送或取貨的區域？",
    choices: [] },
];

export const byId = (id: string) => QUESTIONS.find((q) => q.id === id);
export const byField = (f: keyof SituationFrame) => QUESTIONS.find((q) => q.field === f);

/**
 * Client-side only. The utterance is inspected here and nowhere else; it is never
 * returned, stored, or put in any payload. Returns question ids to surface first.
 */
export function hintsFromUtterance(text: string): string[] {
  const hit: string[] = [];
  const lower = text.toLowerCase();
  const has = (...ws: string[]) => ws.some((w) => lower.includes(w));
  if (has("背扣", "扣不到", "手不容易舉", "舉不高", "肩膀", "back clasp", "back hook", "shoulder")) hit.push("q_back", "q_rotate");
  if (has("舉高", "舉不高", "抬手", "肩膀", "overhead", "raise my arm", "shoulder")) hit.push("q_overhead");
  if (has("白襯衫", "襯衫", "不露痕", "痕跡", "透", "shirt", "blouse", "show through", "visible line")) hit.push("q_garment", "q_nude");
  if (has("出差", "旅行", "東京", "出國", "business trip", "travel", "tokyo")) hit.push("q_duration", "q_days", "q_date", "q_receive");
  if (has("預算", "元", "NT", "$")) hit.push("q_budget");
  if (has("成套", "內褲", "一套", "matching", "brief", "panty", "set")) hit.push("q_set", "q_size");
  return [...new Set(hit)];
}

/**
 * Client-side only, same boundary as hintsFromUtterance: the text is never sent.
 * True only when she already said this is an everyday / rotation need. It only
 * unlocks a conditional wording hint; it never changes quantity or the basket.
 */
export function mentionsDailyRotation(text: string): boolean {
  const lower = text.toLowerCase();
  return ["日常", "每天", "每日", "天天", "常備", "替換", "換洗", "輪替", "輪流穿",
    "everyday", "every day", "daily", "rotation"].some((w) => lower.includes(w));
}
