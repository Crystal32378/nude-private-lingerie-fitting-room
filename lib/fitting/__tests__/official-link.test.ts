import { test } from "node:test";
import assert from "node:assert/strict";
import { jevProductLink, OFFICIAL_PRODUCT_ID } from "../official-link.ts";

const BASE = "https://www.nude4underwear.com/products/perfect-wireless-bra";

test("adds exactly the four agreed UTM parameters", () => {
  const url = new URL(jevProductLink("nude-02", BASE));
  assert.equal(url.searchParams.get("utm_source"), "nude_jev");
  assert.equal(url.searchParams.get("utm_medium"), "referral");
  assert.equal(url.searchParams.get("utm_campaign"), "jev_recommendation");
  assert.equal(url.searchParams.get("utm_content"), "product_5b3f2aca00fdde0a67000f97");
  assert.deepEqual([...url.searchParams.keys()].sort(), ["utm_campaign", "utm_content", "utm_medium", "utm_source"]);
  assert.equal(url.pathname, "/products/perfect-wireless-bra");
});

test("keeps existing query and fragment", () => {
  const url = new URL(jevProductLink("nude-02", `${BASE}?variant=black#detail`));
  assert.equal(url.searchParams.get("variant"), "black");
  assert.equal(url.hash, "#detail");
  assert.equal(url.searchParams.get("utm_source"), "nude_jev");
});

test("unknown product or non-official host stays untouched", () => {
  assert.equal(jevProductLink("not-a-product", BASE), BASE);
  assert.equal(jevProductLink("nude-02", "https://example.com/p"), "https://example.com/p");
  assert.equal(jevProductLink("nude-02", "not a url"), "not a url");
});

test("every official ID is a 24-character Shopline ID and IDs are unique", () => {
  const ids = Object.values(OFFICIAL_PRODUCT_ID);
  for (const id of ids) assert.match(id, /^[0-9a-f]{24}$/);
  assert.equal(new Set(ids).size, ids.length);
});

test("every catalogue product has an official ID", async () => {
  const { NUDE_PRODUCTS } = await import("../../products.ts");
  assert.equal(NUDE_PRODUCTS.length, Object.keys(OFFICIAL_PRODUCT_ID).length);
  for (const p of NUDE_PRODUCTS) assert.ok(OFFICIAL_PRODUCT_ID[p.id], `missing ID for ${p.id}`);
});
