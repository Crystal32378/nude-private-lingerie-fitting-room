/**
 * Presentation-only strings for the fitting room. English is the default; 中文 is
 * one tap away. Both languages render the SAME frame, products, prices and JEV
 * results — nothing here computes, filters or decides. Product names, prices and
 * official promotion terms stay as the brand publishes them.
 */
import type { Question } from "./questions.ts";
import { getProductById } from "../products.ts";
import { getPanty } from "./panties.ts";

export type Lang = "en" | "zh";

/** Display name for any bra or brief id; data lives with the product, not here. */
export function productName(id: string, lang: Lang, fallback = id): string {
  const item = getProductById(id) ?? getPanty(id);
  if (!item) return fallback;
  return lang === "en" ? `NUDE ${item.nameEn}` : item.nameZh;
}

type QText = { ask: string; why?: string; choices: Record<string, string> };

/** English for the closed question set, keyed by question id and JSON(choice value). */
const QUESTIONS_EN: Record<string, QText> = {
  q_back: { ask: "Is a back clasp easy for you to fasten?", choices: { true: "Yes, no problem", false: "Not easy", null: "Not sure" } },
  q_rotate: { ask: "Could you fasten it in front, then turn it round to the back?",
    why: "This answer changes the most options — back-clasp styles may come back into view.",
    choices: { true: "Yes", false: "No", null: "Not sure" } },
  q_overhead: { ask: "Is raising your arms above your head difficult?", choices: { true: "Not difficult", false: "Difficult", null: "Not sure" } },
  q_overhead_pass: { ask: "Some styles go on over your head — a halter neck that doesn't unclip, or a pull-on style with no clasp. Is that OK for you?",
    why: "These need no back clasp, but your head still has to go through. Only you can answer this.",
    choices: { true: "Yes", false: "I can't", null: "Not sure" } },
  q_pinch: { ask: "Can you pinch and line up a small hook with both hands?", choices: { true: "Yes", false: "That's hard", null: "Not sure" } },
  q_garment: { ask: "Is the white shirt fitted and thin, or looser and thicker?",
    choices: { '"thin_fitted"': "Fitted and thin", '"thick_or_loose"': "Loose or thicker", '"other"': "Something else" } },
  q_duration: { ask: "Roughly how long will you wear it that day?",
    choices: { '"under_4"': "Under 4 hours", '"4_to_8"': "4 to 8 hours", '"over_8"': "Over 8 hours" } },
  q_priority: { ask: "What matters more this time?",
    choices: { '"comfort"': "Comfort", '"shaping"': "Shaping", '"balanced"': "Both — a balance", '"movement"': "Moving freely, staying put", '"not_stated"': "No particular preference" } },
  q_nude: { ask: "Do you need a nude shade?", choices: { true: "Yes", false: "Not necessarily", null: "Not sure" } },
  q_lines: { ask: "Is \"no visible lines at all\" a must this time?",
    why: "Nude and seamless are different things. There's no test under a thin white shirt yet, so seamless can't be promised.",
    choices: { true: "Yes, seamless must be confirmed first", false: "I can compare construction first", null: "Not sure" } },
  q_set: { ask: "Would you like matching briefs too?",
    why: "We don't try on briefs — stores don't either. Here we only help with price and size.",
    choices: { true: "Yes", false: "No thanks", null: "Not sure" } },
  q_size: { ask: "Please pick your brief size (from the official size chart)",
    why: "This is the site's own waist/hip chart; we never infer it from your bra size.", choices: {} },
  q_budget: { ask: "What's the most you'd like to spend on the whole set?",
    choices: { "3000": "Up to NT$3,000", "5000": "Up to NT$5,000", "8000": "Up to NT$8,000" } },
  q_qty: { ask: "How many do you need this time?", choices: {} },
  q_basket_priority: { ask: "When comparing combinations, what matters most?",
    choices: { '"lowest_total"': "Lowest total that meets my needs", '"construction_balance"': "Also weigh style and construction" } },
};

export function askText(q: Question | undefined, lang: Lang): string {
  if (!q) return "";
  return lang === "en" ? QUESTIONS_EN[q.id]?.ask ?? q.ask : q.ask;
}
export function whyText(q: Question | undefined, lang: Lang): string | undefined {
  if (!q) return undefined;
  return lang === "en" ? QUESTIONS_EN[q.id]?.why ?? q.why : q.why;
}
export function choiceText(q: Question | undefined, value: unknown, zhLabel: string, lang: Lang): string {
  if (lang === "zh" || !q) return zhLabel;
  return QUESTIONS_EN[q.id]?.choices[JSON.stringify(value)] ?? zhLabel;
}

/** JEV option codes → readable labels. Internal codes never reach the screen. */
export const CHOICE_LABEL: Record<Lang, Record<string, string>> = {
  zh: { prefer: "優先考慮", consider: "可以考慮，有取捨", lower_priority: "偏好排序較後", insufficient_evidence: "取捨仍待確認" },
  en: { prefer: "Worth prioritising", consider: "Worth considering, with trade-offs", lower_priority: "Lower on your preferences", insufficient_evidence: "Trade-off still to confirm" },
};

/** Reasons and blockers carry a field key; English is rebuilt from that key and the
 *  brand's own values in parentheses, so no logic is duplicated. */
export function reasonText(reason: { text: string; field: string }, lang: Lang): string {
  if (lang === "zh") return reason.text;
  const inner = reason.text.match(/（(.*)）/)?.[1];
  const withInner = (s: string) => inner ? `${s} (${inner})` : s;
  switch (reason.field) {
    case "closure": return reason.text.startsWith("前扣") ? "Front closure — no reaching behind"
      : reason.text.startsWith("無背扣，直接") ? "No clasp — pulls on"
      : reason.text.startsWith("無背扣") ? "No clasp, but it goes on over the head" : withInner("Back closure");
    case "wire": return reason.text === "無鋼圈" ? "Wire-free" : "Soft underwire";
    case "colors": case "colours": return reason.text.startsWith("有裸色") ? withInner("Has a nude shade") : withInner("No nude shade");
    case "straps": return withInner("Halter neck that doesn't unclip — goes on over the head");
    case "price": { const n = reason.text.match(/NT\$(\d+)/)?.[1]; return n ? `NT$${Number(n).toLocaleString("en-US")} is over the budget ceiling` : "Over the budget ceiling"; }
    default: return reason.text;
  }
}

const NOTES_EN: Record<string, string> = {
  "背扣操作能力尚未確認，不能宣稱穿脫條件已通過": "Back-clasp handling isn't confirmed yet, so dressing access can't be marked as passed.",
  "缺少穿法實測，尚無法確認是否能完全避免抬手過頭": "No dressing test yet, so we can't confirm it avoids raising your arms overhead.",
  "扣件操作細節不足，尚無法確認是否能避免精細捏合": "Not enough clasp detail to confirm it avoids fine pinching.",
  "褲款資料尚待品牌逐列核對": "Brief details still to be checked by the brand",
  "褲款裸色仍待品牌確認": "Brief nude shade still to be confirmed by the brand",
};
export function noteText(note: string, lang: Lang): string {
  return lang === "en" ? NOTES_EN[note] ?? note : note;
}

const nt = (n: number) => `NT$${n.toLocaleString("en-US")}`;

/** Every visible UI string of the fitting room, in both languages. */
export const UI = {
  en: {
    catalogAria: "NUDE catalogue", backToCatalog: "Back to catalogue", langSwitch: "中文", langSwitchAria: "切換為中文",
    h1: "Start with your life, then choose the bra.",
    lede: "We first learn how you'll wear it, then look at styles and the whole-set budget. You can change any answer. You make the final decision.",
    needsAria: "Your needs", contextLabel: "What would you like to solve this time?",
    placeholder: "e.g. A business trip in a white shirt, back clasps are hard for me, and I'd like a matching set.",
    privacy: "This text stays in this browser's memory only and is never sent to a model. The options below are the needs you confirm.",
    confirmNeeds: "Confirm my needs", fillExample: "Fill in a demo case",
    firstThings: "First, the things that matter", editAnswers: "Edit answers",
    hintsNote: "Your description gave us question hints. We don't assume any limitation for you — please choose the answers you confirm.",
    labels: { canReachBackClosure: "Is a back clasp easy to fasten?", needsNudeColourway: "Do you need a nude shade?",
      requiresNoVisibleLines: "Is \"no visible lines\" a must?", priority: "What matters more this time?",
      matchingSetDesired: "Matching briefs too?", quantityIntent: "How many this time", budgetMaxTwd: "Whole-set budget ceiling" } as Record<string, string>,
    short: { canReachBackClosure: "Back clasp", needsNudeColourway: "Nude", requiresNoVisibleLines: "Seamless", priority: "Priority", matchingSetDesired: "Set" } as Record<string, string>,
    choose: "Please choose", notProvided: "Not provided",
    qtyOption: (n: number, set: boolean) => set ? `${n} ${n === 1 ? "set" : "sets"} (bra + brief)` : `${n} ${n === 1 ? "bra" : "bras"}`,
    qtyChip: (n: number, set: boolean) => set ? `${n} ${n === 1 ? "set" : "sets"}` : `${n} ${n === 1 ? "bra" : "bras"}`,
    ceilingChip: (n: number) => `Set ceiling ${nt(n)}`, noPreference: "No particular preference",
    extraSummary: "Other dressing steps to note (optional)",
    budgetNote: "The budget is a ceiling for the whole set, not a spending target. You decide how many — we never add items to reach a discount.",
    submit: "Confirm, show me",
    asideAria: "What you can do now", asideTitle: "Right now, let's look at this",
    asideIdle: "First we confirm the conditions that really change your choice — no need to fill in a whole questionnaire.",
    asideLoading: "Comparing the options that already fit. Product facts and prices are still checked by code.",
    asideAsk: "This answer changes the choices in front of you.",
    asideFailed: "The model judgment didn't complete this time. You can still see product facts, compare combinations, or edit your answers.",
    asideDone: "When there's enough information, the choice is yours. Anything unknown stays visible — we don't guess for you.",
    stylesTitle: "Styles worth a look",
    stylesCount: (n: number) => `${n} ${n === 1 ? "style" : "styles"} to compare first, shown by your confirmed needs and preferences.`,
    stylesNone: "No style yet meets every confirmed must-have. Answer the question below, or edit your answers.",
    jevNote: " JEV gives a trade-off reference, not a guarantee of how it will wear.",
    partialFail: "Part of the model comparison didn't complete. Product facts and code-calculated prices are kept below. You can still choose or edit your answers.",
    photoNote: "Official product photo; the colour shown may not be the shade you pick.",
    needsCheck: "Needs your answer", fitsConfirmed: "Meets your confirmed needs",
    perItem: "/ item, recorded price",
    distSummary: "View judgment distribution", distNote: "Prototype judgment: this is a distribution over options, not a fit rate.",
    receipt: (id: string, model?: string) => `Receipt ${id}${model ? ` · ${model}` : ""}`,
    jevPending: "JEV is judging; product facts and prices are still checked by code.",
    jevNone: "JEV gave no judgment this time and no model result is used; this style is listed by your confirmed needs.",
    viewProduct: "View on official site",
    whyExcluded: "Why are some styles not listed?",
    seamlessNote: "A nude shade doesn't mean seamless under a thin white shirt; that hasn't been tested. Stock and delivery time aren't confirmed yet.",
    basketTitle: "Combinations that fit what you need this time",
    basketIntro: (n: number, set: boolean) => `Calculated for your confirmed ${n} ${set ? (n === 1 ? "set" : "sets") : (n === 1 ? "bra" : "bras")}, with the official public summer promotion applied (1 item 10% off, 3 items 30% off, 5 items 50% off). Offer ends Oct 16, 2026 at 8:00 AM (Taipei time). Member, credit-card and points offers may stack at checkout; the site cart decides what you pay.`,
    basketDist: "View combination judgment distribution",
    basketDistNote: "Prototype judgment: compares trade-offs for your confirmed needs, not a guarantee of savings or fit.",
    basketUndecided: " It can't yet tell which combination fits your preferences better.",
    insufficient: "Not enough evidence", candidate: "Candidate combination",
    noBasket: "At this quantity, no combination meets both your conditions and the whole-set budget. You can edit your answers; we never reduce the quantity or add styles that don't fit.",
    draftSet: "Set draft, pending brand check", jevSuggests: "JEV suggests comparing this one first",
    ruleAgrees: "Your style preference and the lowest total agree", lowest: "Lowest activity-price total right now", another: "Another combination that fits",
    activityWas: (pre: number) => `Official activity price, was ${nt(pre)}`, setTotal: "Whole-set total", shippingLater: " / shipping confirmed later",
    vsLowest: (d: number) => d === 0 ? "Same as the lowest total." : `${nt(d)} more than the lowest total.`,
    basis: "Price and promotion basis",
    basisLine: (pre: number, count: number, tier: string, fin: number) => `List total ${nt(pre)}. ${count} designated ${count === 1 ? "item" : "items"}, ${tier} applied, official activity price ${nt(fin)}.`,
    basisSource: "From the official public promotion page (recorded Sep 21, 2026). Offer ends Oct 16, 2026 at 8:00 AM (Taipei time); not a live lookup. Member, credit-card and points offers need a site login or are confirmed at checkout.",
    tier: { none: "list price (no tier reached, or the offer has ended)", tier_1_90: "10% off", tier_3_70: "30% off", tier_5_50: "50% off" } as Record<string, string>,
    viewed: "You looked at this in the showroom",
    kept: "Kept", keepDraft: "Keep draft, check with the brand", chooseThis: "I'd choose this one",
    heldTitle: "Your choice is saved. Nothing has been ordered.",
    heldDraft: "The set details still need brand confirmation. ", heldGo: "You can go to the official product page and decide. ",
    heldTotal: (n: number) => `Official activity-price total ${nt(n)}; stock, shipping and member, card or points offers are confirmed in the site cart.`,
    sizeLabel: "Please confirm your brief size from the official chart", sizeNone: "Not chosen",
    fxNote: (rate: number, date: string) => `US$ amounts are approximate, converted at NT$${rate} = US$1 (Bank of Taiwan spot rate, ${date}). Prices are charged in NT$ at checkout.`,
    shippingNote: "Ships from Taiwan. Free shipping over NT$3,000 in Asia, NT$5,000 to Europe and the Americas; 7–10 business days. Overseas orders can't be returned.",
    footer: "First, we understand what matters to you. Then we compare product evidence and explain the trade-offs. You make the final decision.",
    price: {
      eyebrow: "After the recommendation, the price", title: "So, what would this cost?",
      intro: "Calculated with the official public summer promotion. It isn't in the cart yet — member, credit-card and points offers may stack, and the cart decides what you pay.",
      oneList: "One set, list price", noDiscount: "Without the promotion", oneActivity: "One set, activity price",
      oneActivityNote: (rate: string) => `One set / ${rate} / official public offer`,
      threeSets: "If you bought three sets", avg: (n: number) => `${nt(n)} per set on average (activity price)`,
      moreThanOne: (n: number) => `${nt(n)} more than one set`,
      caption: "List price and official activity price for one set, three bras, and three sets",
      plan: "Option", list: "List price", activity: "Official activity price", vsOne: "Compared with one set", base: "Baseline", more: (n: number) => `+${nt(n)}`,
      rows: { one_set: "One set: 1 bra + 1 brief", three_bras: "Three bras", three_sets: "Three sets: 3 bras + 3 briefs" } as Record<string, string>,
      rate: { "原價": "list price", "九折": "10% off", "七折": "30% off", "五折": "50% off" } as Record<string, string>,
      outro: (n: number) => `Three sets can lower the average cost per set, but you'd spend ${nt(n)} more. The budget is a ceiling, not a target — spending less than planned is a good outcome. Whether to buy three is up to you.`,
      daily: (n: number) => `You mentioned this is for everyday rotation: during the offer, three sets average ${nt(n)} each, which could work as an everyday plan. The cart decides what you pay; the quantity stays as you confirmed, and we never add items for you.`,
    },
  },
  zh: {
    catalogAria: "NUDE 商品目錄", backToCatalog: "回商品目錄", langSwitch: "English", langSwitchAria: "Switch to English",
    h1: "先說生活，再選內衣。",
    lede: "先了解妳要怎麼穿，再看款式與整組預算。可以修改任何答案，最後由妳決定。",
    needsAria: "妳的需求", contextLabel: "這次想解決什麼？",
    placeholder: "例如：出差要穿白襯衫，背扣不好操作，想搭配一套。",
    privacy: "這段文字只留在這次瀏覽的裝置記憶體，不會傳給模型。後面的選項才是妳確認的需求。",
    confirmNeeds: "確認我的需求", fillExample: "填入示範條件",
    firstThings: "先確認重要的事", editAnswers: "修改條件",
    hintsNote: "妳的描述提供了提問線索。這裡不替妳推定限制，請選出妳確認的答案。",
    labels: { canReachBackClosure: "背扣好操作嗎？", needsNudeColourway: "需要裸色嗎？",
      requiresNoVisibleLines: "完全無痕是必要條件嗎？", priority: "這次更重視什麼？",
      matchingSetDesired: "需要搭配內褲嗎？", quantityIntent: "這次需要的數量", budgetMaxTwd: "整組預算上限" } as Record<string, string>,
    short: { canReachBackClosure: "背扣", needsNudeColourway: "裸色", requiresNoVisibleLines: "無痕", priority: "偏好", matchingSetDesired: "配套" } as Record<string, string>,
    choose: "請選擇", notProvided: "尚未提供",
    qtyOption: (n: number, set: boolean) => `${n} ${set ? "套（內衣＋內褲）" : "件內衣"}`,
    qtyChip: (n: number, set: boolean) => `${n} ${set ? "套" : "件內衣"}`,
    ceilingChip: (n: number) => `整組上限 NT$${n.toLocaleString("zh-TW")}`, noPreference: "沒有特別偏好",
    extraSummary: "其他需要留意的穿脫操作（選填）",
    budgetNote: "預算是整組上限，不是最低消費。需要幾件由妳決定，不會為了折扣自動加購。",
    submit: "確認，幫我看看",
    asideAria: "現在可以做什麼", asideTitle: "現在，我們先看這件事",
    asideIdle: "先確認真正影響妳選擇的條件，不需要把整份問卷填完。",
    asideLoading: "正在比較已符合條件的選項。商品資料與價格仍由程式核對。",
    asideAsk: "這個答案會影響眼前的選擇。",
    asideFailed: "這次模型判斷沒有完成。仍可看商品事實、計算組合，或修改條件。",
    asideDone: "有足夠資訊就交給妳選；不知道的地方會留下來，不替妳猜。",
    stylesTitle: "哪些款式值得看",
    stylesCount: (n: number) => `${n} 款可先比較，依已確認的條件與偏好呈現。`,
    stylesNone: "目前沒有已確認符合所有必要條件的款式。可以先確認下列問題，或修改條件。",
    jevNote: " JEV 提供的是取捨參考，不是穿著效果保證。",
    partialFail: "部分模型比較未完成，以下保留商品事實與程式計價。妳仍可選擇或修改條件。",
    photoNote: "官方商品照；照片顏色不代表所選色系。",
    needsCheck: "需要確認", fitsConfirmed: "符合已確認條件",
    perItem: "／件，記錄價格",
    distSummary: "查看判斷分布", distNote: "Prototype judgment：這是選項分布，不是穿著合適率。",
    receipt: (id: string, model?: string) => `判斷收據 ${id}${model ? ` · ${model}` : ""}`,
    jevPending: "JEV 判斷中；商品事實與價格仍由程式核對。",
    jevNone: "JEV 這次沒有提供判斷，未採用任何模型結果；此款依已確認條件列出。",
    viewProduct: "查看官方商品",
    whyExcluded: "為什麼有些款式沒列入？",
    seamlessNote: "裸色不代表薄白襯衫下無痕；目前沒有這項實測。庫存與到貨時間也尚未確認。",
    basketTitle: "怎麼組合，符合妳這次的需要",
    basketIntro: (n: number, set: boolean) => `以妳確認的 ${n} ${set ? "套" : "件內衣"} 計算，已套用官網公開的夏季採購折扣（一件9折、三件7折、五件5折，至 2026/10/16 08:00）。會員、信用卡、點數等優惠可能在結帳時再疊加，實付以官網購物車為準。`,
    basketDist: "查看組合判斷分布",
    basketDistNote: "Prototype judgment：比較已確認需求的取捨，不是省錢或合適程度的保證。",
    basketUndecided: "目前還無法判定哪組更符合偏好。",
    insufficient: "證據不足", candidate: "候選組合",
    noBasket: "目前這個數量，沒有同時通過條件與整組預算的組合。可以修改條件；我們不會自動減少數量或加入不合的款式。",
    draftSet: "配套草稿，待品牌核對", jevSuggests: "JEV 建議優先比較這組",
    ruleAgrees: "款式偏好與最低總額一致", lowest: "目前活動價合計最低", another: "另一個合格組合",
    activityWas: (pre: number) => `官網活動價，原價 NT$${pre.toLocaleString("zh-TW")}`, setTotal: "整組商品合計", shippingLater: "／運費另確認",
    vsLowest: (d: number) => d === 0 ? "比最低合計相同。" : `比最低合計多 NT$${d.toLocaleString("zh-TW")}。`,
    basis: "價格與活動依據",
    basisLine: (pre: number, count: number, tier: string, fin: number) => `原價合計 NT$${pre.toLocaleString("zh-TW")}。指定商品 ${count} 件，套用${tier}，官網活動價 NT$${fin.toLocaleString("zh-TW")}。`,
    basisSource: "依官網公開活動頁（記錄日期 2026-09-21），優惠至 2026/10/16 08:00 截止（台北時間），非即時查詢。會員、信用卡、點數等優惠需登入官網或於結帳時確認。",
    tier: { none: "原價（未達級距或活動已結束）", tier_1_90: "一件9折", tier_3_70: "三件7折", tier_5_50: "五件5折" } as Record<string, string>,
    viewed: "妳在展示間看過這件",
    kept: "已保留這組", keepDraft: "保留草稿，向品牌確認", chooseThis: "我想選這組",
    heldTitle: "已保留妳的選擇，尚未下單。",
    heldDraft: "配套資料仍需品牌確認。", heldGo: "可以前往官方商品頁自行決定。",
    heldTotal: (n: number) => `官網活動價合計 NT$${n.toLocaleString("zh-TW")}；庫存、運費與會員、信用卡、點數等結帳優惠以官網購物車為準。`,
    sizeLabel: "依官方對照，請自行確認內褲尺碼", sizeNone: "尚未選擇",
    fxNote: (_rate: number, _date: string) => "",
    shippingNote: "",
    footer: "先懂妳的需求，再比較商品內容，提供方案取捨。最後，由妳決定。",
    price: {
      eyebrow: "推薦後，先看金額", title: "好，這樣買要多少錢？",
      intro: "以官網公開的夏季採購折扣計算。還沒放進購物車結帳，會員、信用卡、點數等優惠可能再疊加，實付以購物車為準。",
      oneList: "一套原價", noDiscount: "不含活動折扣", oneActivity: "一套活動價",
      oneActivityNote: (rate: string) => `一套／${rate}／官網公開折扣`,
      threeSets: "如果改買三套", avg: (n: number) => `平均每套 NT$${n.toLocaleString("zh-TW")}（活動價）`,
      moreThanOne: (n: number) => `比一套多 NT$${n.toLocaleString("zh-TW")}`,
      caption: "一套、三件內衣、三套的原價與官網活動價",
      plan: "方案", list: "原價", activity: "官網活動價", vsOne: "與一套相比", base: "基準", more: (n: number) => `多 NT$${n.toLocaleString("zh-TW")}`,
      rows: { one_set: "一套：1 件內衣＋1 件內褲", three_bras: "三件內衣", three_sets: "三套：3 件內衣＋3 件內褲" } as Record<string, string>,
      rate: { "原價": "原價", "九折": "九折", "七折": "七折", "五折": "五折" } as Record<string, string>,
      outro: (n: number) => `三套可能讓單套平均成本下降，但會多花 NT$${n.toLocaleString("zh-TW")}。預算上限不是最低消費；花得比預期少是好結果。要不要買三套，由妳決定。`,
      daily: (n: number) => `妳提到這是日常換穿的需要：活動期間三套平均每套 NT$${n.toLocaleString("zh-TW")}，可作為日常換穿方案考慮。實付以購物車結帳為準；數量維持妳確認的，不會自動加購。`,
    },
  },
};
