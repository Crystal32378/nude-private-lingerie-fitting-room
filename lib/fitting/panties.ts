/**
 * Eight panty records, selected by the site's own 建議搭配 relations.
 * Collected 2026-09-20. docs/evidence/panty-corpus-2026-09-20.md
 *
 * confirmedByCrystal is false for all but p-07's colour. Nothing here may reach a
 * public surface until each line is ticked off. v3 §三.
 */
import type { EvidenceSource, PantySize } from "./types.ts";

export interface PantyRecord {
  id: string;
  nameZh: string;
  /** English display name, aligned with the paired bra's nameEn. Draft pending brand approval. */
  nameEn: string;
  handle: string;
  type: string;
  price: number;
  /** per-item, not a site-wide switch. Reminder only, never in defaultTotal. v3 §14.1 A-4 */
  memberPrice: number | null;
  memberPriceObservedAt: string | null;
  material: string;
  surfaceNotes: string;
  sizes: PantySize[];
  /** Colours we could read. NOT a complete colour table. */
  colours: string[];
  hasNudeColourway: boolean | "unknown";
  colourSource: EvidenceSource;
  colourConfirmedAt: string | null;
  colourConfirmedBy: string | null;
  /** Bras this page itself names under 建議搭配. */
  pairsWith: string[];
  pairsWithSource: EvidenceSource;
  /** The page showed the promotion banner. Observable. */
  promotionDisplayed: boolean;
  promotionDisplayedEvidence: { text: string; capturedAt: string; sourceUrl: string } | null;
  /** Whether it is actually in the 指定商品 list. Unknowable from the page. v3 §14.2 */
  promotionEligible: "yes" | "no" | "unknown";
  missingFields: string[];
  confirmedByCrystal: boolean;
}

const PROMO_TEXT = "至2026-10-16T00:00:00.000+00:00截止 指定商品，【NUDE 夏季採購折扣】一件9折，三件7折，五件5折。";
const CAPTURED = "2026-09-20T00:00:00+08:00";
const SIZES: PantySize[] = ["S", "M", "L"];

const base = (handle: string) => ({
  handle,
  sizes: SIZES,
  colourSource: "observed_from_product_image" as EvidenceSource,
  colourConfirmedAt: null,
  colourConfirmedBy: null,
  pairsWithSource: "site_stated" as EvidenceSource,
  promotionDisplayed: true,
  promotionDisplayedEvidence: {
    text: PROMO_TEXT, capturedAt: CAPTURED,
    sourceUrl: `https://www.nude4underwear.com/products/${handle}`,
  },
  // Unknown until Crystal supplies the 指定商品 list or the terms. Fail closed.
  promotionEligible: "unknown" as const,
  confirmedByCrystal: false,
});

export const PANTIES: PantyRecord[] = [
  {
    ...base("basic-seamless-panty"), id: "panty-01", nameZh: "NUDE超完美無痕內褲", nameEn: "Perfect Seamless Brief",
    type: "經典款式（腰線未標）", price: 580, memberPrice: null, memberPriceObservedAt: null,
    material: "60%聚酯纖維、15%尼龍、15%棉、10%彈性纖維",
    surfaceNotes: "名稱含「無痕」；鍛紋織工藝；Silk Skin 超柔纖維；頁面未描述接縫",
    colours: ["裸色", "黑色"], hasNudeColourway: true,
    pairsWith: ["nude-01"], missingFields: ["colourNames", "stockStatus", "riseCategory"],
  },
  {
    ...base("fashion-seamless-panty"), id: "panty-02", nameZh: "NUDE魔幻時尚無痕內褲", nameEn: "Convertible Seamless Brief",
    type: "腰線未標", price: 580, memberPrice: null, memberPriceObservedAt: null,
    material: "92%尼龍8%彈性纖維",
    surfaceNotes: "無痕；spandex 超彈力纖維；未提蕾絲或車縫",
    colours: ["裸色", "黑色"], hasNudeColourway: true,
    pairsWith: ["nude-09", "nude-01"], missingFields: ["colourNames", "stockStatus", "riseCategory"],
  },
  {
    ...base("fashion-mesh-panty"), id: "panty-03", nameZh: "NUDE心機透視內褲", nameEn: "Sheer Mesh Brief",
    type: "三角／性感／平口／華麗多版型", price: 780, memberPrice: 730, memberPriceObservedAt: CAPTURED,
    material: "92%尼龍8%彈性纖維",
    surfaceNotes: "施華洛世奇水晶；微妙菱格紋；蕾絲裝飾；車工扎實；無無痕宣稱",
    colours: ["裸色", "黑色"], hasNudeColourway: true,
    pairsWith: ["nude-08"], missingFields: ["colourNames", "stockStatus"],
  },
  {
    ...base("lace-bikini"), id: "panty-04", nameZh: "NUDE天使蕾絲內褲", nameEn: "Lace Bikini Brief",
    type: "高衩；腰線未標", price: 780, memberPrice: 730, memberPriceObservedAt: CAPTURED,
    material: "90%尼龍、10%彈性纖維",
    surfaceNotes: "正面雙翼蕾絲；高衩；緞面飾邊",
    colours: ["裸色", "黑色"], hasNudeColourway: true,
    pairsWith: ["nude-07"], missingFields: ["colourNames", "stockStatus", "riseCategory"],
  },
  {
    ...base("chiffon-lace-panty"), id: "panty-05", nameZh: "NUDE雪紡蕾絲透視內褲", nameEn: "Chiffon Lace Brief",
    type: "高衩透視；雙細帶側邊", price: 980, memberPrice: 930, memberPriceObservedAt: CAPTURED,
    material: "100% 彈性纖維（棉質褲底）",
    surfaceNotes: "15 層百摺雪紡；蕾絲拼接；透視布料；緞面飾邊",
    colours: ["白色", "裸色"], hasNudeColourway: true,
    pairsWith: ["nude-03"], missingFields: ["colourNames", "stockStatus"],
  },
  {
    ...base("nude-plus-ultimate-bikini-panty"), id: "panty-06", nameZh: "NUDE極緻美型內褲", nameEn: "Ultimate Bikini Brief",
    type: "中腰、高衩", price: 980, memberPrice: 930, memberPriceObservedAt: CAPTURED,
    material: "82%尼龍18%彈性纖維",
    surfaceNotes: "中腰彈力褲頭；萊卡與超細纖維；背面透視；棉質底褲",
    colours: ["裸色", "黑色"], hasNudeColourway: true,
    pairsWith: [], missingFields: ["colourNames", "stockStatus", "pairsWithInCorpus"],
  },
  {
    ...base("floral-sheer-panty"), id: "panty-07", nameZh: "NUDE絕美雕花透膚褲", nameEn: "Floral Sheer Brief",
    type: "透視網紗（夢幻款式）", price: 980, memberPrice: 930, memberPriceObservedAt: CAPTURED,
    material: "82%尼龍18%彈性纖維",
    surfaceNotes: "三層繁複刺繡；華麗透視；棉質褲底",
    colours: ["白色", "寶藍"], hasNudeColourway: false,
    colourSource: "crystal_brand_knowledge",
    colourConfirmedAt: "2026-09-20", colourConfirmedBy: "Crystal",
    pairsWith: [], missingFields: ["stockStatus", "pairsWithInCorpus"],
  },
  {
    ...base("bodyslim-highwaist-panty"), id: "panty-08", nameZh: "NUDE超激塑高腰纖體褲", nameEn: "Bodyslim High-Waist Brief",
    type: "高腰塑身", price: 1280, memberPrice: null, memberPriceObservedAt: null,
    material: "71%尼龍、29%彈性纖維",
    // Efficacy copy on the page is stripped. It may not reach any rendering path. v3 §14.1 / AT-8
    surfaceNotes: "CARVICO REVOLUTIONAL™ SLIM 布料；頁面稱「平滑無痕」；未描述接縫",
    colours: ["裸色", "黑色"], hasNudeColourway: true,
    pairsWith: [], missingFields: ["colourNames", "stockStatus", "pairsWithInCorpus"],
  },
];

export const getPanty = (id: string) => PANTIES.find((p) => p.id === id);

/** Official size chart, verbatim from the site. The user picks. Never inferred. v3 §14.1 B-2 */
export const PANTY_SIZE_CHART: Record<PantySize, string> = {
  S: "32-35 吋", M: "36-39 吋", L: "40-42 吋",
};
