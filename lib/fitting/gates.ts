/**
 * Deterministic gates. No model involved. v3 §三 / §五.
 *
 * These run BEFORE any JEV call, so an excluded product never costs a token.
 * Only `stated` or `confirmed` frame fields may exclude anything.
 */
import { NUDE_PRODUCTS, type Product } from "../products.ts";
import { PANTIES, type PantyRecord } from "./panties.ts";
import { binds, type SituationFrame } from "./types.ts";

export interface GateVerdict {
  productId: string;
  passed: boolean;
  /** Each blocker names the product field it came from. No unsourced claims. */
  blockers: { field: string; text: string }[];
  /** True when a single further answer could unblock it — drives the follow-up question. */
  reversibleBy?: keyof SituationFrame;
  unknowns?: string[];
}

const isFrontClosure = (p: Product) => p.closure.startsWith("front");
const hasNude = (p: Product) => p.colors.some((c) => /裸|膚/.test(c));

/**
 * nude-08 is front-closing but its neck loop is non-detachable, so the head must
 * pass through it — a product fact Crystal confirmed from the product image on
 * 2026-09-20. Whether that rules it out is the USER's to answer, so this returns
 * a question, never an exclusion. v3 §五 / §14.3.
 */
const REQUIRES_PASS_OVER_HEAD = new Set(["nude-08"]);

export function gateBra(p: Product, f: SituationFrame): GateVerdict {
  const blockers: GateVerdict["blockers"] = [];
  const unknowns: string[] = [];
  let reversibleBy: GateVerdict["reversibleBy"];

  if (binds(f.needsNudeColourway) && f.needsNudeColourway.value === true && !hasNude(p)) {
    blockers.push({ field: "colors", text: `沒有裸色（${p.colors.join("、")}）` });
  }

  if (binds(f.canReachBackClosure) && f.canReachBackClosure.value === false && !isFrontClosure(p)) {
    const canRotate = binds(f.canRotateBandAroundTorso) && f.canRotateBandAroundTorso.value === true;
    if (!canRotate) {
      blockers.push({ field: "closure", text: `背扣（${p.closure}）` });
      // One more answer could bring it back. This is the highest-leverage question.
      if (!binds(f.canRotateBandAroundTorso)) reversibleBy = "canRotateBandAroundTorso";
    }
  }

  if (REQUIRES_PASS_OVER_HEAD.has(p.id)) {
    if (binds(f.canPassOverHead) && f.canPassOverHead.value === false) {
      blockers.push({ field: "straps", text: `繞頸不可拆，需從頭套下（${p.straps}）` });
    } else if (!binds(f.canPassOverHead)) {
      // Not a blocker. An open question. nude-08 stays Check with you.
      reversibleBy = "canPassOverHead";
    }
  }

  // No current measurement proves this requirement. It is neither a model task
  // nor an exclusion: she can keep it as a requirement and review the evidence.
  if (binds(f.requiresNoVisibleLines) && f.requiresNoVisibleLines.value === true && !reversibleBy) {
    reversibleBy = "requiresNoVisibleLines";
  }
  if (f.canReachBackClosure.provenance === "confirmed" && f.canReachBackClosure.value === null) {
    unknowns.push("背扣操作能力尚未確認，不能宣稱穿脫條件已通過");
  }
  if (binds(f.canRaiseArmsOverhead) && f.canRaiseArmsOverhead.value === false) {
    unknowns.push("缺少穿法實測，尚無法確認是否能完全避免抬手過頭");
  }
  if (binds(f.canPerformFineMotorPinch) && f.canPerformFineMotorPinch.value === false) {
    unknowns.push("扣件操作細節不足，尚無法確認是否能避免精細捏合");
  }

  if (binds(f.budgetMaxTwd) && f.budgetMaxTwd.value !== null && p.price > f.budgetMaxTwd.value) {
    blockers.push({ field: "price", text: `NT$${p.price} 超過預算上限` });
  }

  return { productId: p.id, passed: blockers.length === 0, blockers, reversibleBy, unknowns };
}

export function gatePanty(p: PantyRecord, f: SituationFrame): GateVerdict {
  const blockers: GateVerdict["blockers"] = [];
  if (binds(f.needsNudeColourway) && f.needsNudeColourway.value === true) {
    if (p.hasNudeColourway === false) {
      blockers.push({ field: "colours", text: `沒有裸色（${p.colours.join("、")}）` });
    }
    // "unknown" does not exclude: an image-read colour list is not a colour table.
  }
  if (binds(f.budgetMaxTwd) && f.budgetMaxTwd.value !== null && p.price > f.budgetMaxTwd.value) {
    blockers.push({ field: "price", text: `NT$${p.price} 超過預算上限` });
  }
  return { productId: p.id, passed: blockers.length === 0, blockers };
}

export interface GateRun {
  bras: GateVerdict[];
  panties: GateVerdict[];
  eligibleBraIds: string[];
  excludedBraIds: string[];
  eligiblePantyIds: string[];
  /** Products held open by a question rather than excluded. */
  openBraIds: string[];
}

export function runGates(f: SituationFrame): GateRun {
  const bras = NUDE_PRODUCTS.map((p) => gateBra(p, f));
  const panties = PANTIES.map((p) => gatePanty(p, f));
  return {
    bras, panties,
    eligibleBraIds: bras.filter((g) => g.passed && !g.reversibleBy && !g.unknowns?.length).map((g) => g.productId),
    openBraIds: bras.filter((g) => g.passed && (g.reversibleBy || g.unknowns?.length)).map((g) => g.productId),
    excludedBraIds: bras.filter((g) => !g.passed).map((g) => g.productId),
    eligiblePantyIds: panties.filter((g) => g.passed).map((g) => g.productId),
  };
}

/**
 * Which single unanswered question would change the result set most?
 * Deterministic, not model-chosen. v3 §七.
 */
export function highestLeverageQuestion(f: SituationFrame): keyof SituationFrame | null {
  const base = runGates(f).eligibleBraIds.length;
  const candidates: (keyof SituationFrame)[] = ["canRotateBandAroundTorso", "canPassOverHead"];
  let best: { field: keyof SituationFrame; delta: number } | null = null;
  for (const field of candidates) {
    if (binds(f[field] as any) || f[field].provenance === "confirmed") continue;
    let delta = 0;
    for (const v of [true, false]) {
      const probe = { ...f, [field]: { value: v, provenance: "confirmed" as const } };
      delta = Math.max(delta, Math.abs(runGates(probe as SituationFrame).eligibleBraIds.length - base));
    }
    if (delta > 0 && (!best || delta > best.delta)) best = { field, delta };
  }
  return best?.field ?? null;
}
