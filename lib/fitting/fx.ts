/**
 * A reference USD figure for the English fitting room. Never a price: the site
 * charges in NT$, so this only helps a visitor abroad read the number.
 * Source: Bank of Taiwan board rate, spot buy 31.685 / spot sell 31.835,
 * posted 2026/09/21 22:00 (Taipei). We use the spot midpoint.
 * Update the rate and date together; the footnote shows both.
 */
export const FX = {
  twdPerUsd: 31.76,
  observedOn: "Sep 21, 2026",
  source: "https://rate.bot.com.tw/xrt?Lang=zh-TW",
} as const;

/** Whole US dollars, rounded; "≈" because it is a reference, not a charge. */
export function approxUsd(twd: number): string {
  return `≈ US$${Math.round(twd / FX.twdPerUsd).toLocaleString("en-US")}`;
}
