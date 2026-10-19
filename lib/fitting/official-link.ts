/**
 * JEV recommendation → official product page links, tagged so the official
 * site can tell the visit came from a JEV recommendation.
 *
 * Contract (agreed with Astra, 2026-10-19):
 * - Only the four fixed UTM parameters below. Never size, body data,
 *   recommendation probabilities, photo info, or any user identifier.
 * - utm_content = "product_" + the official site's stable Shopline product ID
 *   (the "Product ID" the official site's own tracker reports; also its
 *   schema.org sku). Not card order, not product name.
 * - Built with URL/searchParams.set() so any existing query or #fragment on the
 *   product URL survives.
 * - Only for links that leave JEV for the official site. In-app links stay bare.
 */

/** Official-site Shopline product IDs, read from each product page on 2026-10-19. */
export const OFFICIAL_PRODUCT_ID: Readonly<Record<string, string>> = {
  "nude-01": "62f4b7ed46a14a00318f29a4", // perfect-seamless-bra-1-2
  "nude-02": "5b3f2aca00fdde0a67000f97", // perfect-wireless-bra
  "nude-03": "5b40d27a59d5241977001851", // chiffon-balconette
  "nude-04": "5b40d33b595630193c000913", // luxurious-lace-bra
  "nude-05": "5f33a633e335670033d92008", // belle-epoque-sheer-bra
  "nude-06": "5b40d14e8d1db9035c0046e0", // luxurious-lace-bralette
  "nude-07": "5b3f2b1372fdc05134000db1", // lace-cami-bra
  "nude-08": "5b3f2d020e64fef882000d43", // racerback-bra
  "nude-09": "5b3f2d1072fdc050b3000cc0", // convertible-bra
  "nude-10": "5b90d7e2b94559000ea6ac3f", // nude-base-jumper-leisuree
};

export const JEV_UTM = {
  utm_source: "nude_jev",
  utm_medium: "referral",
  utm_campaign: "jev_recommendation",
} as const;

const OFFICIAL_HOST = "www.nude4underwear.com";

/**
 * Returns the product URL tagged for JEV attribution. If the URL is not on the
 * official site, or the product has no known official ID, it is returned
 * unchanged — an untagged link is better than a wrongly tagged one.
 */
export function jevProductLink(productId: string, productUrl: string): string {
  const officialId = OFFICIAL_PRODUCT_ID[productId];
  let url: URL;
  try {
    url = new URL(productUrl);
  } catch {
    return productUrl;
  }
  if (url.hostname !== OFFICIAL_HOST || !officialId) return productUrl;
  for (const [key, value] of Object.entries(JEV_UTM)) url.searchParams.set(key, value);
  url.searchParams.set("utm_content", `product_${officialId}`);
  return url.toString();
}
