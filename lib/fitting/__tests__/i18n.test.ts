import { test } from "node:test";
import assert from "node:assert/strict";
import { askText, CHOICE_LABEL, choiceText, noteText, reasonText, UI } from "../i18n.ts";
import { byField, byId, hintsFromUtterance, mentionsDailyRotation } from "../questions.ts";
import { decide } from "../decide.ts";
import { buildBasketOptions } from "../promotion.ts";
import { emptyFrame, type SituationFrame } from "../types.ts";

const CJK = /[㐀-鿿]/;
const c = <T>(value: T) => ({ value, provenance: "confirmed" as const });
const tokyo: SituationFrame = { ...emptyFrame(), canReachBackClosure: c(false), canRotateBandAroundTorso: c(true),
  canPassOverHead: c(true), needsNudeColourway: c(true), requiresNoVisibleLines: c(false), priority: c("balanced"),
  matchingSetDesired: c(true), quantityIntent: c(1), budgetMaxTwd: c(3000) };

function keysDeep(o: object, prefix = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) => v && typeof v === "object" ? keysDeep(v, `${prefix}${k}.`) : [`${prefix}${k}`]).sort();
}

test("English and 中文 expose exactly the same UI keys", () => {
  assert.deepEqual(keysDeep(UI.en), keysDeep(UI.zh));
});

test("every JEV option code has a readable label in both languages; no internal code leaks", () => {
  for (const code of ["prefer", "consider", "lower_priority", "insufficient_evidence"]) {
    for (const lang of ["en", "zh"] as const) {
      assert.ok(CHOICE_LABEL[lang][code], `${lang}.${code}`);
      assert.ok(!CHOICE_LABEL[lang][code].includes("_"));
    }
  }
});

test("the form and follow-up questions are fully English, including every choice", () => {
  const fields = ["canReachBackClosure", "needsNudeColourway", "requiresNoVisibleLines", "priority", "matchingSetDesired",
    "budgetMaxTwd", "canRaiseArmsOverhead", "canPerformFineMotorPinch", "canRotateBandAroundTorso", "canPassOverHead", "basketPriority"] as const;
  for (const field of fields) {
    const q = byField(field)!;
    assert.ok(!CJK.test(askText(q, "en")), q.id);
    for (const choice of q.choices) assert.ok(!CJK.test(choiceText(q, choice.value, choice.label, "en")), `${q.id} ${choice.label}`);
  }
  assert.ok(!CJK.test(choiceText(byField("priority"), "not_stated", "沒有特別偏好", "en")));
  assert.equal(choiceText(byField("priority"), "comfort", "舒適", "zh"), "舒適", "中文 stays the original string");
});

test("Tokyo case: explanations are English, brand values are kept, and results are identical in both languages", () => {
  const items = decide(tokyo).items;
  for (const item of items) {
    for (const r of item.reasons) {
      const en = reasonText(r, "en");
      assert.ok(!CJK.test(en.replace(/\(.*\)/, "")), `${item.productId}: ${en}`);
      assert.equal(reasonText(r, "zh"), r.text);
    }
    for (const note of item.uncertain) assert.ok(!CJK.test(noteText(note, "en")), note);
    if (item.openQuestion) assert.ok(!CJK.test(askText(byId(item.openQuestion.id), "en")));
  }
  for (const basket of buildBasketOptions(tokyo)) for (const u of basket.unknowns) assert.ok(!CJK.test(noteText(u, "en")), u);
  // Presentation never feeds back into logic: the same frame yields the same data.
  assert.deepEqual(decide(tokyo), decide(tokyo));
});

test("English offer copy keeps NT$ and the official Taipei cut-off", () => {
  const intro = UI.en.basketIntro(1, true);
  assert.ok(intro.includes("Offer ends Oct 16, 2026 at 8:00 AM (Taipei time)"));
  assert.ok(UI.en.basisSource.includes("Offer ends Oct 16, 2026 at 8:00 AM (Taipei time)"));
  assert.ok(UI.en.price.avg(1230).startsWith("NT$1,230"));
  assert.equal(UI.en.footer, "First, we understand what matters to you. Then we compare product evidence and explain the trade-offs. You make the final decision.");
});

test("English text also triggers the same local hints; 'rotate' alone is not a daily-rotation claim", () => {
  assert.ok(hintsFromUtterance("Business trip to Tokyo in a white shirt, back clasp is hard").includes("q_back"));
  assert.equal(mentionsDailyRotation("I want something for everyday rotation"), true);
  assert.equal(mentionsDailyRotation("I can rotate the band to the back"), false);
});
