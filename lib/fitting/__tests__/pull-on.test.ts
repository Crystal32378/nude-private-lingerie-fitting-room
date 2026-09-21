import { test } from "node:test";
import assert from "node:assert/strict";
import { NUDE_PRODUCTS } from "../../products.ts";
import { emptyFrame, type SituationFrame } from "../types.ts";
import { gateBra } from "../gates.ts";
import { promotionEligibility } from "../promotion.ts";

const confirmed = <T,>(value: T) => ({ value, provenance: "confirmed" as const });
const bra = NUDE_PRODUCTS.find(p => p.id === "nude-10")!;

test("nude-10 is in the corpus with its own letter sizing and the official promotion", () => {
  assert.ok(bra);
  assert.deepEqual(bra.sizes, ["XS", "S", "M", "L"]);
  assert.equal(promotionEligibility("nude-10"), "yes");
});

test("a pull-on bra is not excluded for someone who cannot reach a back closure", () => {
  const f: SituationFrame = { ...emptyFrame(), canReachBackClosure: confirmed(false) };
  const v = gateBra(bra, f);
  assert.equal(v.passed, true);
  assert.ok(!v.blockers.some(b => b.field === "closure"));
});

test("going over the head is asked, never assumed", () => {
  const open = gateBra(bra, emptyFrame());
  assert.equal(open.passed, true);
  assert.equal(open.reversibleBy, "canPassOverHead");
  const no = gateBra(bra, { ...emptyFrame(), canPassOverHead: confirmed(false) });
  assert.equal(no.passed, false);
});

test("black only: excluded when she needs a nude colourway", () => {
  const v = gateBra(bra, { ...emptyFrame(), needsNudeColourway: confirmed(true) });
  assert.equal(v.passed, false);
});

test("nude-10 pairs with every black panty, by brand statement, without touching site pairings", async () => {
  const { PANTIES, pairsWithBra } = await import("../panties.ts");
  const partners = PANTIES.filter(p => pairsWithBra(p, "nude-10")).map(p => p.id);
  const black = PANTIES.filter(p => p.colours.includes("黑色")).map(p => p.id);
  assert.deepEqual(partners, black);
  assert.ok(!partners.includes("panty-05") && !partners.includes("panty-07"));
  assert.ok(PANTIES.every(p => !p.pairsWith.includes("nude-10")));
});
