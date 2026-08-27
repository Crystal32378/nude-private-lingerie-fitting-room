/**
 * A garment reference image whose colourway is known, so `nude.try_on` can
 * render that colourway on request instead of only the default reference.
 */
export interface GarmentAsset {
  /** Colourway label, matching an entry in the product's `colors`. */
  colour: string;
  image: string;
}

export interface Product {
  id: string;
  nameZh: string;
  nameEn: string;
  productUrl: string;
  category: string;
  sku?: string;
  price: number;
  priceLabel: string;
  displayImage: string;
  vtoImage: string;
  /**
   * Reference images whose colourway is confirmed. `vtoImage` stays the
   * default and its colourway is deliberately NOT asserted — it was never
   * labelled. Only colours listed here can actually be rendered.
   */
  vtoAssets?: GarmentAsset[];
  colors: string[];
  sizes: string[];
  material: string;
  description: string;
  wire: string;
  cup: string;
  padding: string;
  straps: string;
  closure: string;
  structureNotes: string;
  youcamCategory: "upper_body";
}

export const NUDE_PRODUCTS: Product[] = [
  {
    id: "nude-01",
    nameZh: "NUDE 超完美無痕內衣",
    nameEn: "Perfect Seamless",
    productUrl: "https://www.nude4underwear.com/products/perfect-seamless-bra-1-2",
    category: "bra (seamless molded)",
    sku: "BE01",
    price: 1880,
    priceLabel: "NT$1,880",
    displayImage:
      "https://img.shoplineapp.com/media/image_clips/5b3f432f0e64fef8c7000f14/original.jpg?1530872622",
    vtoImage:
      "https://img.shoplineapp.com/media/image_clips/5b45bcdd9a76f019bb00103e/original.jpg?1531296988",
    colors: ["黑色", "裸膚"],
    sizes: ["70 B", "70 C", "70 D", "75 B", "75 C", "75 D", "80 C", "80 D", "85C", "85D"],
    material: "60%凝聚纖維、15%尼龍、15%棉、10%彈性纖維",
    description:
      "ＮＵＤＥ明星商品，實穿易搭也舒適，一整天穿著沒有壓力也不會有勒痕或泛紅的現象，有超高的回購率。",
    wire: "underwire (soft wire)",
    cup: "3/4 罩杯 / 一杯罩杯",
    padding: "fixed / integrated / thickness: 下厚 8 毫米",
    straps: "non-detachable / dual-strap",
    closure: "back (２排３段)",
    structureNotes:
      "Seamless one-piece molded cup with underwire. BC cups have integrated 8mm lower padding, D cup has no padding. Tests VTO on a smooth-contour 3/4 cup with no visible seams.",
    youcamCategory: "upper_body",
    vtoAssets: [{ colour: "裸膚", image: "/garments/nude-01-nude.jpg" }],
  },
  {
    id: "nude-02",
    nameZh: "NUDE 超完美無鋼圈內衣",
    nameEn: "Perfect Wireless",
    productUrl: "https://www.nude4underwear.com/products/perfect-wireless-bra",
    category: "bra (wireless)",
    sku: "BE02",
    price: 1880,
    priceLabel: "NT$1,880",
    displayImage:
      "https://img.shoplineapp.com/media/image_clips/613abf9e55001900112f7c41/original.JPG?1631240093",
    vtoImage:
      "https://img.shoplineapp.com/media/image_clips/5b5058be9a76f019be000d43/original.jpg?1531992253",
    colors: ["黑色", "裸膚"],
    sizes: ["70 B", "70 C", "70 D", "75 B", "75 C", "75 D", "80 B", "80 C"],
    material: "84%聚酯纖維 9%彈性纖維 7%尼龍",
    description:
      "無鋼圈舒適再升級；軟杯墊輕柔不變形，一件滿足集中效果、無壓感受。穿著一整日依然透氣舒適，脫下後無束縛痕跡，觸感光滑柔細，感受百分百的合體貼身日常。",
    wire: "wireless",
    cup: "記憶軟綿罩杯 / 3/4 罩杯 / 淺罩杯",
    padding: "fixed / integrated / thickness: 均薄 mm",
    straps: "non-detachable / dual-strap",
    closure: "back (２排３段)",
    structureNotes:
      "Wireless 3/4 cup with memory-foam integrated padding and jacquard weave fabric. Tests VTO on a soft-cup no-wire silhouette with shallow cup depth.",
    youcamCategory: "upper_body",
    vtoAssets: [{ colour: "裸膚", image: "/garments/nude-02-nude.jpg" }],
  },
  {
    id: "nude-03",
    nameZh: "NUDE 純真雪紡貝蕾內衣",
    nameEn: "Chiffon Balconette",
    productUrl: "https://www.nude4underwear.com/products/chiffon-balconette",
    category: "bra (balconette)",
    sku: "R02",
    price: 2980,
    priceLabel: "NT$2,980",
    displayImage:
      "https://img.shoplineapp.com/media/image_clips/5b45a62b00fddecb77003d08/original.jpg?1531291178",
    vtoImage:
      "https://img.shoplineapp.com/media/image_clips/5b41e6ce72fdc0e125005cf5/original.jpg?1531045580",
    colors: ["純真白", "裸粉膚", "薄霧黑"],
    sizes: ["70 B", "70 C", "70 D", "75 B", "75 C", "75 D", "80 C", "80 D", "85C"],
    material: "39%聚酯纖維、31%棉、25%尼龍、5%彈性纖維",
    description:
      "獨家貝蕾杯，½半罩輕鬆搭配各式衣著，可拆式肩帶依場合任意變換，衣櫃必備款式。",
    wire: "underwire (soft wire)",
    cup: "三段立體剪裁罩杯 / 1/2 罩杯 / 一般罩杯",
    padding: "removable pads / pocket with pads / thickness: 上方左右加厚8mm",
    straps: "detachable / convertible / dual-strap / can be worn strapless",
    closure: "back (２排３段)",
    structureNotes:
      "1/2 cup balconette with soft underwire, convertible/detachable straps (can be worn strapless), removable heart-shaped push-up pads with 8mm upper-side thickening. Tests VTO on a low-cut neckline silhouette.",
    youcamCategory: "upper_body",
    vtoAssets: [{ colour: "裸粉膚", image: "/garments/nude-03-nude.jpg" }],
  },
  {
    id: "nude-04",
    nameZh: "NUDE 浪漫四蕾絲內衣",
    nameEn: "Lace Push-up",
    productUrl: "https://www.nude4underwear.com/products/luxurious-lace-bra",
    category: "bra (lace push-up)",
    sku: "R01",
    price: 2380,
    priceLabel: "NT$2,380",
    displayImage:
      "https://img.shoplineapp.com/media/image_clips/5b502ac259d524f71f0003e2/original.jpg?1531980481",
    vtoImage:
      "https://img.shoplineapp.com/media/image_clips/5b502ac30e64feac83000576/original.jpg?1531980481",
    colors: ["神秘黑"],
    sizes: ["70 B", "70 C", "70 D", "75 B", "75 C", "75 D", "80 B", "80 C", "80 D"],
    material: "93%尼龍 7%彈性纖維",
    description: "360度全視角美型內衣足以吸引所有眼光凝視。",
    wire: "underwire (soft wire)",
    cup: "集中推高罩杯 / 3/4 罩杯 / 一般罩杯",
    padding: "fixed / integrated / thickness: 下厚8mm",
    straps: "non-detachable / dual-strap",
    closure: "back (２排３段)",
    structureNotes:
      "3/4 cup lace push-up bra with soft underwire, integrated BCD padding with 8mm lower thickness. Tests VTO on a textured all-over lace surface with push-up cleavage effect.",
    youcamCategory: "upper_body",
  },
  {
    id: "nude-05",
    nameZh: "NUDE 華麗年代法式薄蕾",
    nameEn: "Bella Epoque Sheer Bra",
    productUrl: "https://www.nude4underwear.com/products/belle-epoque-sheer-bra",
    category: "bra (sheer lace)",
    price: 2980,
    priceLabel: "NT$2,980",
    displayImage:
      "https://img.shoplineapp.com/media/image_clips/5f61d35885c10200396709a4/original.jpg?1600246615",
    vtoImage:
      "https://img.shoplineapp.com/media/image_clips/5f8fee70f05156003ea3d9f0/original.jpg?1603268208",
    colors: ["晨霧灰", "玫瑰粉", "夜幕黑"],
    sizes: [
      "70B", "70C", "70D", "70E", "70F",
      "75B", "75C", "75D", "75E", "75F",
      "80B", "80C", "80D", "80E",
      "85B", "85C", "85D",
    ],
    material: "82%尼龍、18%彈性纖維",
    description: "全新PLUS系列，提供給研究舒適感與時尚美型的精緻女性。",
    wire: "underwire (soft wire)",
    cup: "全罩杯 / 深罩杯",
    padding: "none",
    straps: "non-detachable / dual-strap",
    closure: "back (２排３段)",
    structureNotes:
      "Full cup sheer lace bra with soft underwire, no pockets and no padding. Tests VTO on a fully transparent / semitransparent garment where skin shows through — the hardest case for realistic overlay rendering.",
    youcamCategory: "upper_body",
  },
  {
    id: "nude-06",
    nameZh: "NUDE 翩愛戀人波蕾內衣",
    nameEn: "Beloved Bralette",
    productUrl: "https://www.nude4underwear.com/products/luxurious-lace-bralette",
    category: "bralette",
    sku: "R03",
    price: 2380,
    priceLabel: "NT$2,380",
    displayImage:
      "https://img.shoplineapp.com/media/image_clips/5b40d1c59a76f018ff001b69/original.jpg?1530974660",
    vtoImage:
      "https://img.shoplineapp.com/media/image_clips/5b502be972fdc09550000528/original.jpg?1531980776",
    colors: ["黑", "膚"],
    sizes: ["70 B", "70 C", "70 D", "75 B", "75 C", "75 D", "80 C", "80 D"],
    material: "94%尼龍 6%彈性纖維",
    description:
      "全蕾絲無鋼圈波蕾，超薄軟杯墊輕柔貼膚易收納，單排扣一字型彈力肩帶平滑柔軟，極致舒適服貼度百分百。",
    wire: "wireless",
    cup: "兩段立體剪裁三角罩杯 / 3/4 罩杯 / 一般罩杯",
    padding: "none",
    straps: "non-detachable / dual-strap",
    closure: "back (單排３段)",
    structureNotes:
      "Wireless 3/4 cup triangle bralette with two-panel 3D cut, no padding, single-row 3-position back closure. Tests VTO on an unstructured soft-cup bralette with minimal support architecture.",
    youcamCategory: "upper_body",
    vtoAssets: [{ colour: "膚", image: "/garments/nude-06-nude.jpg" }],
  },
  {
    id: "nude-07",
    nameZh: "NUDE 天使蕾絲抹胸內衣",
    nameEn: "Lace Bandeau",
    productUrl: "https://www.nude4underwear.com/products/lace-cami-bra",
    category: "bra (bandeau / strapless)",
    sku: "BE03",
    price: 2180,
    priceLabel: "NT$2,180",
    displayImage:
      "https://img.shoplineapp.com/media/image_clips/5b5361030e64fef158002e34/original.jpg?1532190977",
    vtoImage:
      "https://img.shoplineapp.com/media/image_clips/5b5057ce72fdc09540000bed/original.jpg?1531992012",
    colors: ["黑色", "裸膚"],
    sizes: ["70 B", "70 C", "70 D", "75 B", "75 C", "75 D", "80 C", "80 D", "85C"],
    material: "90%尼龍 10%彈性纖維",
    description:
      "大片蕾絲覆蓋胸前，創造若隱若現的溝影。復古雙層蕾絲滾邊肩帶，讓妳大方外露也很高雅。",
    wire: "underwire (soft wire)",
    cup: "三片拼貼杯型 / 1/2 罩杯 / 一杯罩杯",
    padding: "removable pads / pocket with pads / thickness: 一般",
    straps: "detachable / convertible / dual-strap",
    closure: "back (２排３段)",
    structureNotes:
      "1/2 cup strapless bandeau with soft underwire, detachable dual straps, three-panel spliced cup with removable pads. Tests VTO on a tube/bandeau silhouette with no shoulder straps.",
    youcamCategory: "upper_body",
    vtoAssets: [{ colour: "裸膚", image: "/garments/nude-07-nude.jpg" }],
  },
  {
    id: "nude-08",
    nameZh: "NUDE 心機美背內衣",
    nameEn: "Front-click RacerBack",
    productUrl: "https://www.nude4underwear.com/products/racerback-bra",
    category: "bra (racerback / front-closure)",
    sku: "F03",
    price: 2180,
    priceLabel: "NT$2,180",
    displayImage:
      "https://img.shoplineapp.com/media/image_clips/5b50560a0e64feac62000d6d/original.jpg?1531991561",
    vtoImage:
      "https://img.shoplineapp.com/media/image_clips/5b40ad699a76f019670010d5/original.jpg?1530965352",
    colors: ["黑色", "裸膚"],
    sizes: ["70 B", "70 C", "70 D", "75 B", "75 C", "75 D", "80 C", "80 D", "85C"],
    material: "48%尼龍 47%棉 5%聚酯纖維",
    description:
      "後背雙弧蕾絲設計能夠修飾頸肩曲線，讓背影魅力再升級。前扣無痕罩杯讓胸型更集中，打造深V性感對你悄悄放電。",
    wire: "underwire (soft wire)",
    cup: "兩段立體車縫 / 3/4 罩杯 / 一般罩杯",
    padding: "removable pads / pocket with pads / thickness: 下厚8mm",
    straps: "non-detachable / halter",
    closure: "front (no back closure)",
    structureNotes:
      "Halter-style racerback with soft underwire, front deep-V closure (no back closure), 3/4 cup with removable pads and 8mm lower padding. Tests VTO on a crisscross halter strap and front-closure geometry.",
    youcamCategory: "upper_body",
    vtoAssets: [{ colour: "裸膚", image: "/garments/nude-08-nude.jpg" }],
  },
  {
    id: "nude-09",
    nameZh: "NUDE 魔幻時尚前扣內衣",
    nameEn: "Strapless Convertible",
    productUrl: "https://www.nude4underwear.com/products/convertible-bra",
    category: "bra (convertible / front-closure / strapless)",
    sku: "F02",
    price: 1880,
    priceLabel: "NT$1,880",
    displayImage:
      "https://img.shoplineapp.com/media/image_clips/5b68473d0e64fe628500b218/original.jpg?1533560635",
    vtoImage:
      "https://img.shoplineapp.com/media/image_clips/5b5056f38d1db94c49000beb/original.jpg?1531991794",
    colors: ["黑色", "裸膚"],
    sizes: ["70 B", "70 C", "70 D", "75 B", "75 C", "75 D", "80 C", "80 D", "85C"],
    material: "60%尼龍 15%聚酯纖維 10%棉 10%聚胺酯綿墊 5%彈性纖維",
    description:
      "一件內衣六種穿法，駕馭時尚的各種可能。一體成型的上薄下厚特殊襯墊，不易滑動不過度擠度擠壓胸部，軟鋼圈支撐胸型完美貼合每一吋肌膚，怎麼活動都不怕！",
    wire: "underwire (soft wire)",
    cup: "兩段立體車縫 / 5/8 罩杯 / 集中推高罩杯",
    padding: "fixed / integrated / thickness: 下厚8mm",
    straps: "detachable / convertible / dual-strap / can be worn strapless",
    closure: "front (no back closure)",
    structureNotes:
      "6-way convertible bra with soft underwire, front deep-V closure (no back closure), 5/8 cup with integrated BCD padding and 8mm lower thickness, detachable straps for strapless/halter/crisscross wear. Tests VTO on multi-config strap routing and ultra-low 5/8 cup coverage.",
    youcamCategory: "upper_body",
    vtoAssets: [{ colour: "裸膚", image: "/garments/nude-09-nude.jpg" }],
  },
];

export const PRODUCT_COUNT = NUDE_PRODUCTS.length;

export function getProductById(id: string): Product | undefined {
  return NUDE_PRODUCTS.find((p) => p.id === id);
}

/**
 * Resolve which garment image a try-on should send, and which colourway that
 * is. Passing no colour keeps the historical behaviour: the default reference,
 * whose colourway is unknown.
 */
export function resolveGarment(
  product: Product,
  colour?: string | null
): { image: string; colour: string | null } | { error: "COLOUR_NOT_RENDERABLE"; renderable: string[] } {
  const assets = product.vtoAssets ?? [];
  if (!colour) return { image: product.vtoImage, colour: null };
  const hit = assets.find((a) => a.colour === colour);
  if (!hit) return { error: "COLOUR_NOT_RENDERABLE", renderable: assets.map((a) => a.colour) };
  return { image: hit.image, colour: hit.colour };
}

/** Colourways this piece can actually be rendered in. */
export function renderableColours(product: Product): string[] {
  return (product.vtoAssets ?? []).map((a) => a.colour);
}
