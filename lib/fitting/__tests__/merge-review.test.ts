import { test } from "node:test";
import assert from "node:assert/strict";
import * as i18n from "../i18n.ts";
import { calculate, isCampaignLive, tierUpgradeOption, type BasketLine } from "../promotion.ts";
import { mentionsMovement } from "../questions.ts";
import { planNextAction } from "../decide.ts";
import { emptyFrame, type SituationFrame } from "../types.ts";

const c = <T,>(value: T) => ({ value, provenance: "confirmed" as const });
const line = (id: string): BasketLine => ({ id, name: id, price: 1000, qty: 1, promotionEligible: "yes" });

test("price-panel wording follows campaign start and exclusive end in both languages", () => {
  const copy = (i18n as typeof i18n & { pricePanelCopy: (lang: "en" | "zh", live: boolean) => typeof i18n.UI.en.price }).pricePanelCopy;
  assert.equal(typeof copy, "function");
  for (const at of ["2026-10-16T07:59:59+08:00", "2026-12-01T00:00:00+08:00"]) {
    const live = isCampaignLive(new Date(at));
    assert.equal(live, false);
    for (const lang of ["en", "zh"] as const) {
      const p = copy(lang, live);
      const shown = [p.intro, p.oneActivity, p.oneActivityNote("list price"), p.avg(1000), p.caption, p.activity, p.outro(2000), p.daily(1000)].join(" ");
      assert.doesNotMatch(shown, /活動價|公開折扣|以官網公開|during the offer|activity price|offer applied|Calculated with the official public Double/i);
    }
  }
  assert.match(copy("zh", true).intro, /雙11/);
});

test("English comparison translates all currently calculated tier labels", () => {
  for (const [count, expected] of [[2, "20% off"], [4, "40% off"], [6, "60% off"]] as const) {
    const calculation = calculate(Array.from({ length: count }, (_, i) => line(`nude-${i}`)), new Date("2026-10-25T00:00:00+08:00"));
    const zh = { tier_2_80: "八折", tier_4_60: "六折", tier_6_40: "四折", none: "原價" }[calculation.appliedTier];
    assert.equal(i18n.UI.en.price.rate[zh], expected);
  }
});

test("upgrades reach the next designated-item tier, skipping ineligible quantities", () => {
  const current = [line("a"), line("b"), { ...line("outside"), promotionEligible: "no" as const, qty: 3 }];
  const next = tierUpgradeOption(current, [line("c"), line("d")], new Date("2026-10-25T00:00:00+08:00"));
  assert.ok(next);
  assert.equal(next.addItems.length, 2);
  assert.equal(next.fromItems, 2);
  assert.equal(next.toItems, 4);
  assert.equal(next.toTotal, 5400);
  assert.equal(next.absoluteDelta, 800);
  assert.equal(next.preSelected, false);
});

test("waiting copy does not assert that other styles were never excluded", () => {
  assert.doesNotMatch(i18n.UI.en.basketWaiting, /Nothing has been ruled out/i);
  assert.doesNotMatch(i18n.UI.zh.basketWaiting, /沒有任何款式被排除/);
});

test("English movement hints match words rather than unrelated substrings", () => {
  for (const text of ["brunch", "transport", "inactive", "I want a bra for brunch and transport"]) assert.equal(mentionsMovement(text), false, text);
  for (const text of ["running", "sports", "gym workout", "yoga", "dance", "active", "想去健身房"]) assert.equal(mentionsMovement(text), true, text);
});

test("three discounted bras within a whole-set budget still reach comparison", () => {
  const frame: SituationFrame = { ...emptyFrame(), canReachBackClosure: c(true), canPassOverHead: c(true),
    needsNudeColourway: c(true), requiresNoVisibleLines: c(false), priority: c("balanced"),
    matchingSetDesired: c(false), quantityIntent: c(3), budgetMaxTwd: c(5000) };
  assert.equal(planNextAction(frame).kind, "judge");
  frame.budgetMaxTwd = c(1000);
  assert.equal(planNextAction(frame).kind, "recommend");
});
