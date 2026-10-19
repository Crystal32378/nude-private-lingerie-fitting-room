/**
 * Deterministic discount engine. No model ever touches arithmetic. v3 §九 / §14.2.
 *
 * Order is load-bearing:
 *   1. confirm what she wants (set? how many?)
 *   2. take everything that passed the gates
 *   3. find the lowest actual payment for THAT quantity
 *   4. check the campaign is still valid
 *
 * Ask-then-price computes the cheapest version of what she wants.
 * Price-then-ask computes how to make her buy more. The code looks nearly
 * identical; the results do not.
 */
import { NUDE_PRODUCTS } from "../products.ts";
import { PANTIES, pairsWithBra } from "./panties.ts";
import { runGates } from "./gates.ts";
import { type SituationFrame } from "./types.ts";

export const PROMO = {
  /** 【NUDE 雙11 X 黑五】兩件20%off，四件40%off，六件60%off. Read from the official
   *  promotion page's own configuration on 2026-10-19: start 2026-10-16 08:00, end
   *  2026-12-01 00:00 (Taipei), all customers, no membership, not first-purchase-only. */
  validityStart: "2026-10-16T08:00:00+08:00",
  /** Exclusive end instant, as configured on the site (end_at). Governs. */
  validityEnd: "2026-12-01T00:00:00+08:00",
  observedSiteEnd: "2026-12-01T00:00:00+08:00",
  evidenceLabel: "recorded" as const,
  evidenceTimestamp: "2026-10-19T16:40:00+08:00",
  /** Crystal (brand owner) pointed to this promotion as the live campaign on 2026-10-19.
   *  "Public" is not "checkout": member, card and points offers may still stack in the
   *  site cart, so the total is the public activity price, never a claimed payment. */
  termsVerified: true,
  sourceUrl: "https://www.nude4underwear.com/promotions/6aca57fe7fde3b29e9a16583",
  /** Corpus items in the site's 指定商品 whitelist (36 products, read 2026-10-19).
   *  nude-01 (超完美無痕內衣, 62f4b7ed46a14a00318f29a4) is NOT on it. */
  eligibleIds: ["nude-02", "nude-03", "nude-04", "nude-05", "nude-06", "nude-07", "nude-08", "nude-09", "nude-10",
    "panty-01", "panty-02", "panty-03", "panty-04", "panty-05", "panty-06", "panty-07", "panty-08"],
  tiers: [
    { id: "tier_6_40", minItems: 6, rate: 0.4 },
    { id: "tier_4_60", minItems: 4, rate: 0.6 },
    { id: "tier_2_80", minItems: 2, rate: 0.8 },
  ],
} as const;

export type TierId = "none" | "tier_2_80" | "tier_4_60" | "tier_6_40";

export interface BasketLine { id: string; name: string; price: number; promotionEligible: "yes" | "no" | "unknown"; qty: number }

export interface PromotionCalculation {
  preDiscountTotal: number;
  eligibleItemCount: number;
  appliedTier: TierId;
  finalTotal: number;
  savings: number;
  /** The only number allowed where the page says what she pays. */
  defaultTotal: number;
  /** True while terms are unverified or the campaign is planned. */
  isSimulation: boolean;
  validityEnd: string;
  observedSiteEnd: string;
  evidenceLabel: string;
  evidenceTimestamp: string;
  termsVerified: boolean;
  notes: string[];
}

export function tierFor(count: number): { id: TierId; rate: number } {
  for (const t of PROMO.tiers) if (count >= t.minItems) return { id: t.id, rate: t.rate };
  return { id: "none", rate: 1 };
}

/** Eligibility comes only from the official 指定商品 list; anything else stays unknown (fail closed). */
export function promotionEligibility(id: string): "yes" | "unknown" {
  return (PROMO.eligibleIds as readonly string[]).includes(id) ? "yes" : "unknown";
}

export function isCampaignLive(now: Date): boolean {
  // Live from the start instant (inclusive) to the end instant (exclusive).
  const t = now.getTime();
  return t >= new Date(PROMO.validityStart).getTime() && t < new Date(PROMO.validityEnd).getTime();
}

/**
 * @param lines items ALREADY through the gates. Nothing excluded may appear here;
 *              `excludedIds` never reaches this function by construction. AT-3b.
 */
export function calculate(lines: BasketLine[], now = new Date()): PromotionCalculation {
  const notes: string[] = [];
  const preDiscountTotal = lines.reduce((s, l) => s + l.price * l.qty, 0);

  const countable = lines.filter((l) => l.promotionEligible === "yes");
  const eligibleItemCount = countable.reduce((s, l) => s + l.qty, 0);
  const unresolved = lines.filter((l) => l.promotionEligible === "unknown");
  if (unresolved.length > 0) {
    notes.push(`${unresolved.length} 件的「指定商品」資格尚未核定，不計入件數（fail closed）`);
  }

  const live = isCampaignLive(now);
  if (!live) notes.push("不在活動期間，不套用任何級距");

  const tier = live ? tierFor(eligibleItemCount) : { id: "none" as TierId, rate: 1 };
  const discountable = countable.reduce((s, l) => s + l.price * l.qty, 0);
  const finalTotal = preDiscountTotal - discountable + Math.round(discountable * tier.rate);

  // Terms unverified => the discounted figure is a simulation, never the price.
  const isSimulation = !PROMO.termsVerified;
  if (isSimulation) notes.push("條件式活動模擬：活動條款尚未核對，折後金額不得視為結帳實付價");
  else notes.push("官網公開活動價；會員、信用卡、點數等優惠可能在結帳時再疊加，實付以購物車為準");

  return {
    preDiscountTotal, eligibleItemCount, appliedTier: tier.id, finalTotal,
    savings: preDiscountTotal - finalTotal,
    defaultTotal: isSimulation ? preDiscountTotal : finalTotal,
    isSimulation,
    validityEnd: PROMO.validityEnd, observedSiteEnd: PROMO.observedSiteEnd,
    evidenceLabel: PROMO.evidenceLabel, evidenceTimestamp: PROMO.evidenceTimestamp,
    termsVerified: PROMO.termsVerified, notes,
  };
}

export interface TierUpgrade {
  addItems: BasketLine[];
  fromItems: number; toItems: number;
  fromTotal: number; toTotal: number;
  /** Absolute change in what leaves her account. Negative means cheaper. */
  absoluteDelta: number;
  preSelected: false;
}

/**
 * Offered, never applied. Shows the absolute spend change, not just the rate —
 * a smaller percentage on a bigger basket is still more money. v3 §九 / AT-11.
 */
export function tierUpgradeOption(
  current: BasketLine[], available: BasketLine[], now = new Date(),
): TierUpgrade | null {
  if (!isCampaignLive(now)) return null;
  const base = calculate(current, now);
  for (const target of [3, 5]) {
    const have = current.reduce((s, l) => s + l.qty, 0);
    if (have >= target) continue;
    const need = target - have;
    const add = available.slice(0, need);
    if (add.length < need) continue;
    const next = calculate([...current, ...add], now);
    return {
      addItems: add, fromItems: have, toItems: target,
      fromTotal: base.defaultTotal, toTotal: next.defaultTotal,
      absoluteDelta: next.defaultTotal - base.defaultTotal,
      preSelected: false,
    };
  }
  return null;
}

// ---------------------------------------------------------------- budget

export interface SetBudgetCheck {
  /** What she actually pays for the whole set. */
  defaultTotal: number;
  budgetMaxTwd: number | null;
  /** True only when the WHOLE set is within the ceiling. */
  withinBudget: boolean;
  overBy: number;
  note: string | null;
}

/**
 * The budget she stated is for the complete set, not per item. Three pieces that
 * are each affordable can still overshoot together, so the check runs on
 * `defaultTotal` — the number that leaves her account — never on unit prices.
 * v3 §九.
 */
export function checkSetBudget(calc: PromotionCalculation, budgetMaxTwd: number | null): SetBudgetCheck {
  if (budgetMaxTwd === null) {
    return { defaultTotal: calc.defaultTotal, budgetMaxTwd: null, withinBudget: true, overBy: 0, note: null };
  }
  const overBy = Math.max(0, calc.defaultTotal - budgetMaxTwd);
  const withinBudget = overBy === 0;
  return {
    defaultTotal: calc.defaultTotal, budgetMaxTwd, withinBudget, overBy,
    note: withinBudget
      ? null
      : `整組 NT$${calc.defaultTotal} 超過妳設的上限 NT$${budgetMaxTwd}，超出 NT$${overBy}`,
  };
}

export interface BasketOption {
  id: string;
  braId: string;
  pantyId: string | null;
  lines: BasketLine[];
  calculation: PromotionCalculation;
  budget: SetBudgetCheck;
  needsReview: boolean;
  unknowns: string[];
}

export interface BudgetScenario {
  id: "one_set" | "three_bras" | "three_sets";
  label: string;
  originalTotal: number;
  conditionalSimulation: number;
  deltaFromOneSet: number;
  rateLabel: string;
}

export interface BudgetComparison {
  braId: string;
  pantyId: string;
  oneSet: BudgetScenario;
  threeBras: BudgetScenario;
  threeSets: BudgetScenario;
  /** threeSets activity price / 3. Public activity price, never a checkout payment. */
  threeSetsConditionalAveragePerSet: number;
  termsVerified: boolean;
  validityEnd: string;
}

/**
 * A transparent comparison for the moment after a one-set recommendation.
 * It never changes the basket or its quantity. `conditionalSimulation` is the
 * public activity price from calculate(); checkout may stack further offers.
 */
export function buildBudgetComparison(basket: BasketOption, now = new Date()): BudgetComparison | null {
  if (!basket.pantyId || basket.lines.length !== 2 || basket.lines.some(line => line.qty !== 1)) return null;
  const bra = basket.lines.find(line => line.id === basket.braId);
  const panty = basket.lines.find(line => line.id === basket.pantyId);
  if (!bra || !panty) return null;

  // Same engine as the baskets: eligibility, campaign end and tiers all apply.
  const RATE_LABEL: Record<TierId, string> = { none: "原價", tier_2_80: "八折", tier_4_60: "六折", tier_6_40: "四折" };
  const scenario = (id: BudgetScenario["id"], label: string, lines: BasketLine[]) => {
    const c = calculate(lines, now);
    return { id, label, originalTotal: c.preDiscountTotal, conditionalSimulation: c.finalTotal, rateLabel: RATE_LABEL[c.appliedTier] };
  };
  const one = scenario("one_set", "一套：1 件內衣＋1 件內褲", [bra, panty]);
  const threeBras = scenario("three_bras", "三件內衣", [{ ...bra, qty: 3 }]);
  const threeSets = scenario("three_sets", "三套：3 件內衣＋3 件內褲", [{ ...bra, qty: 3 }, { ...panty, qty: 3 }]);

  return {
    braId: basket.braId,
    pantyId: basket.pantyId,
    oneSet: { ...one, deltaFromOneSet: 0 },
    threeBras: { ...threeBras, deltaFromOneSet: threeBras.conditionalSimulation - one.conditionalSimulation },
    threeSets: { ...threeSets, deltaFromOneSet: threeSets.conditionalSimulation - one.conditionalSimulation },
    threeSetsConditionalAveragePerSet: Math.round(threeSets.conditionalSimulation / 3),
    termsVerified: PROMO.termsVerified,
    validityEnd: PROMO.validityEnd,
  };
}

/** A small, explicit set of same-style baskets. No added units, inferred sizes,
 * member price, or excluded items. Explore the full eligible corpus before cap. */
export function buildBasketOptions(frame: SituationFrame, now = new Date()): BasketOption[] {
  return basketsFor(frame, runGates(frame).eligibleBraIds, now);
}

/** Bras (eligible or still held open by a question) that fit the confirmed
 * whole-set ceiling. Used only to decide what JEV may compare; never shown as
 * a purchasable basket, so an open style cannot be kept before she answers. */
export function affordableBraIds(frame: SituationFrame, braIds: string[], now = new Date()): Set<string> | null {
  const { quantityIntent: q, matchingSetDesired: m, budgetMaxTwd: b } = frame;
  if (q.value === null || m.value === null || b.value === null) return null;
  return new Set(basketsFor(frame, braIds, now).map(o => o.braId));
}

function basketsFor(frame: SituationFrame, braIds: string[], now: Date): BasketOption[] {
  const { quantityIntent: quantity, matchingSetDesired: matching, budgetMaxTwd: budget } = frame;
  if (quantity.provenance !== "confirmed" || ![1, 2, 3].includes(quantity.value ?? 0)
    || matching.provenance !== "confirmed" || typeof matching.value !== "boolean"
    || budget.provenance !== "confirmed" || !Number.isFinite(budget.value) || (budget.value ?? 0) <= 0) return [];
  const qty = quantity.value!;
  const gates = runGates(frame);
  const options: BasketOption[] = [];
  for (const braId of braIds) {
    const bra = NUDE_PRODUCTS.find(p => p.id === braId)!;
    const partners = matching.value
      ? PANTIES.filter(p => pairsWithBra(p, braId) && gates.eligiblePantyIds.includes(p.id)) : [null];
    for (const panty of partners) {
      const lines: BasketLine[] = [{ id: bra.id, name: bra.nameZh, price: bra.price, qty, promotionEligible: promotionEligibility(bra.id) }];
      const unknowns: string[] = [];
      if (panty) {
        lines.push({ id: panty.id, name: panty.nameZh, price: panty.price, qty, promotionEligible: promotionEligibility(panty.id) });
        if (!panty.confirmedByCrystal) unknowns.push("褲款資料尚待品牌逐列核對");
        if (frame.needsNudeColourway.value === true && !panty.colourConfirmedAt) unknowns.push("褲款裸色仍待品牌確認");
      }
      const calculation = calculate(lines, now);
      const budgetCheck = checkSetBudget(calculation, budget.value);
      // Keep over-budget baskets out of recommendation and out of JEV inputs.
      if (!budgetCheck.withinBudget) continue;
      options.push({ id: `basket_${bra.id}_${panty?.id ?? "none"}_${qty}`, braId, pantyId: panty?.id ?? null,
        lines, calculation, budget: budgetCheck, needsReview: unknowns.length > 0, unknowns });
    }
  }
  return options.sort((a, b) => a.calculation.defaultTotal - b.calculation.defaultTotal || a.id.localeCompare(b.id));
}
