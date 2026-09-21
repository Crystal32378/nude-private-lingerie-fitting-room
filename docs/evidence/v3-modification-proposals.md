# v3 修訂建議清單 — **已複驗結案**

> **狀態：全部十二項已由福複驗（2026-09-20）：7 項採納、5 項修改後採納。**
> **裁定後的正式條文寫在 `BRIEFING-NUDE-JEV-ARCHITECTURE-v3.md` §十四，以該處為準。**
> 本文件保留為提案原稿，供對照「提出什麼 → 被改成什麼」。
>
> **⚠ 以下原稿中，A-3、B-4、B-5、C-1 四項與最終條文不同，其中 B-5 與 C-1 是實質錯誤。**
> 讀本文件時請同時看 §十四。

---

## A 組 · 來自八件 panty 採集（5 項）

### A-1 · §三 六件改八件，`PantyRecord` 擴充

```ts
interface PantyRecord {
  id, nameZh, nameEn, type, price, colors, material,
  surfaceNotes, productUrl, capturedAt, missingFields, confirmedByCrystal,

  // 新增
  memberPrice: number | null;          // per-item，非全站開關
  promotionEligible: boolean;          // 該商品頁是否掛促銷文字
  promotionEvidence: { text, capturedAt, sourceUrl } | null;
  colourSource: "site_stated" | "observed_from_product_image" | "crystal_confirmed";
  pairsWith: string[] | "unknown";
  pairsWithSource: "site_stated" | "crystal_brand_knowledge";
}
```

採集規則改寫：
> 依官網明示的「建議搭配」關係選件，優先涵蓋通過穿脫檢核的內衣。
> 不得依價格或外觀挑選。`pairsWith` 必須註明出處。

**理由：** 自然順序取前六件會錯過所有能配到九件語料的褲款。

---

### A-2 · §九 促銷位階與雙欄位

- `evidenceLabel`：`planned` → **`recorded`**（活動已上線：NUDE 夏季採購折扣）
- `termsVerified` **維持 `false`**（同款多件是否分別計件、能否與會員價並用、指定清單全貌未明）
- 新增雙欄位：

```ts
validityEnd:      "2026-10-15T23:59:59+08:00";  // 我們主張的，參與計算
observedSiteEnd:  "2026-10-16T08:00:00+08:00";  // 站上觀測，僅記錄
```

**理由：** 取較早一端，錯誤代價不對稱——承諾了沒給的錢，比少宣稱一次折扣貴得多。

---

### A-3 · §九 `promotionEligible` 為 per-item 且 fail closed

> 「指定商品」＝看該商品頁是否掛有促銷文字。
> discount engine 只對 `promotionEligible === true` 計件。**未查證一律視為 `false`。**

已查證 11 件全為 `true`（nude-01/08/09 ＋ 八件內褲）。其餘六件內衣未查，在示範案例中已被
deterministic gate 排除，不影響計算。

---

### A-4 · §九 預設定價，agent 可提醒會員價差

```ts
price: number;                 // 定價，進入 defaultTotal
memberPrice: number | null;    // 僅供提醒，不進 defaultTotal
```

- 預設顯示定價（未登入者看到的真實金額）
- 會員價登入結帳時才計算
- **agent 可主動提醒會員價差**——這是陳述事實，不受「問的理由必須就是行動的理由」限制，
  **但不得改變預設組合，也不得作為加購理由**

---

### A-5 · §九 級距跳躍試算以真實價格改寫

原文用假設價 NT$500，應改為官網指定的成套褲款真實價格：

| 組合 | 件數 | 級距 | 最終 | 每套單價 |
|---|---|---|---|---|
| 1 套（nude-09 ＋ 魔幻時尚無痕 580） | 2 | 九折 | 2,214 | 2,214 |
| 3 件內衣 | 3 | 七折 | 3,948 | — |
| 3 套 | 6 | 五折 | 3,690 | 1,230 |

平衡點 NT$752；成套褲款 NT$580 低於平衡點，**效應為真**。
六件比三件便宜 258，三套比一套多花 1,476 但每套單價降 44%。

**理由：** 級距升級規則不是防假想問題，是防真實誘因。AT-11、AT-14 份量提高。

---

## B 組 · 來自兩輪 YouCam 探路與 Gateway spike（5 項）

### B-1 · 新增一節：生成影像不得作為構造證據

兩輪探路的實證：

- `upper_body` 換內衣時，**未被要求改動的內褲也被改了**（素面 → 兩側蕾絲高衩）
- `nude-09` 被畫成**單肩斜帶**——參考圖沒有這個造型，**模型自己編的**
- 疊穿不成立：內衣在第二步**完全消失**

> **生成影像不得作為任何構造判斷的證據。** 它會動沒被要求動的部位，也會發明不存在的肩帶走向。
> 一張畫錯肩帶的圖若進了結果頁，就是 AT-8 定義的「無證據宣稱」，只是換成影像形式。

| 可以 | 不可以 |
|---|---|
| demo 與提案素材 | 白襯衫顯形的證據 |
| 搭配組合氛圍預覽（標示為生成影像） | 展示扣合方式、肩帶走向、接縫 |
| 內部候選 | 出現在「證據」區塊 |

**連帶更正：** 先前寫的「`lower_body` 與 `upper_body` 互不干擾，可分兩次生成再合成」是**錯的**。
模型重新生成整張圖，非目標部位是「大致保留」不是「原樣保留」。

---

### B-2 · 新增一節：內褲範圍收斂為價格與尺寸

Crystal 裁定：實體店沒有人試穿內褲，使用者的擔心只有尺寸。

| 原假設 | 修正後 |
|---|---|
| 需要內褲試穿預覽 | **不需要**（`lower_body` 可行但產品用不到） |
| 內褲 nude 色為 hard gate | **降為顯示用途** |
| 顏色抓不到會擋住 gate | **不再是阻擋項** |

內褲在架構中只做兩件事：
1. **價格**（`price`、`memberPrice`、`promotionEligible`）
2. **尺寸**——站方對照表 S 32-35吋／M 36-39吋／L 40-42吋 即為官方依據

```ts
pantySize: UserField<"S" | "M" | "L">;   // 由她從站方對照表確認
```

系統不推算、不建議、不從內衣尺碼換算。

**附帶效益：** 不生成內褲影像 = 不會發明內褲構造。少一個功能，少一個造假機會。

---

### B-3 · §六 不得依賴 `legend` 與 `rounding`

Gateway spike 實證：score 答案**沒有** `legend`，回應**沒有** `rounding`——
兩者文件都說可能存在。

> 層級描述由我們自己的 question 定義保存，不從回應讀取。

---

### B-4 · §八 confidence 讀取位置與缺席保護

spike 實證：confidence **同時**出現在答案物件內（`a.confidence`）與
`providerMetadata.typesafe.confidence`，兩處數值一致。boolean **兩處都沒有**（符合文件）。

> 讀 `result.providerMetadata?.typesafe?.confidence?.[questionId]`，
> 全程 `?.` 保護，缺席一律視為 `unknown`，不得當成 0 或 1。

---

### B-5 · §八 deterministic 商品事實優先於 JEV 判斷 ⚠

**這是本輪最重要的一項。**

spike 對 `nude-08` 的 `visibilityUnderThinWhiteShirt` 回 **2.79 / confidence 0.79**。
0.79 高於 §八的 0.70 門檻——**依現行政策會被採用並顯示給使用者。**

但 Crystal 2026-09-20 確認：**NUDE 所有裸色商品均不透色。**
2.79 的語意是「邊緣可辨識」偏「明顯透出」，**與品牌事實相反**。

> **新增規則：當某屬性可由商品欄位直接回答時，不得把該題送給 JEV。
> 若仍被送出，deterministic 事實覆蓋 JEV 判斷，並記錄為衝突。**

**配套建議：** 商品語料新增

```ts
opacity: "opaque" | "sheer" | "unknown";   // 來源：品牌知識，Crystal 確認
```

裸色款一律 `opaque`。該欄位存在時 `visibilityUnderThinWhiteShirt` 不送 JEV。

**為什麼這一項最重要：** 這是門檻政策第一次碰到真實案例，而它會**很有把握地答錯**。
confidence 量的是分佈集中度，不是正確性——高 confidence 的錯誤判斷是最危險的一種，
因為它會通過所有門檻。這也是 D2 校正工作的第一筆真實資料點。

---

## 批准方式

請逐項標記 ✅ 採納 ／ ❌ 不採納 ／ ✏️ 修改後採納。
未標記者視為未批准，我不會動 v3。

---

## C 組 · 來自 Crystal 2026-09-20 對話（2 項）

### C-1 · 被排除的商品應進入 `Not a fit`，附具體理由

**Crystal 提議：** 「可以放備選無鋼圈進入舒適選項，但給理由說不是前扣。」

v3 §五 Step 5 本來就定義了四類結果：`Best fit` / `Check with you` / `Not a fit` / `Availability unknown`。
目前實作構想只渲染前兩類，**`Not a fit` 沒有被用起來**。

建議：被 deterministic gate 排除的商品**仍然渲染**，放在 `Not a fit`，並寫出排除它的**具體欄位**。

示範案例的具體樣貌：

| 商品 | 分類 | 理由（引用欄位） |
|---|---|---|
| `nude-09` 魔幻時尚前扣 | **Best fit** | `closure: front`、裸膚、NT$1,880 |
| `nude-02` 超完美無鋼圈 | **Not a fit** | 最舒適的選項（`wire: wireless`、`padding: 均薄`），**但 `closure: back (２排３段)`** |
| `nude-01` 超完美無痕 | Not a fit | `closure: back (２排３段)` |
| `nude-08` 心機美背 | Not a fit | `closure: front` 但頸圈不可拆，需穿過頭部（Crystal 確認） |

文案示意：

> 這件最舒服——無鋼圈、均薄襯墊，整天穿不壓。**但它是背扣。**
> 如果妳可以先在身前扣好再轉到背後，它就可以考慮。

#### 為什麼這不違反「穿脫限制優先於價格與促銷」

- 它**沒有被推薦**，只是被**解釋**。分類是 `Not a fit`，不是 `Best fit`。
- 它**不得進入 basket**，`excludedIds` 的結構性隔離不變（§九、AT-3b）。
- 它把「為什麼只有 N 件」從一句話變成一張可核對的清單。

#### 但它直接連到最大的那個槓桿

`nude-02` 只差一個條件：`canRotateBandAroundTorso`。
那正是 v3 §四列為 `UserField`、且 S2 問題選擇演算法評分最高的那一題
（答案在 1 件與 7 件之間移動結果集）。

> **把 `Not a fit` 渲染出來，等於讓她自己看見「回答這一題會改變什麼」。**
> 這比系統單方面問她更好——她看得到代價與收穫。

**待裁示：** `Not a fit` 是否要限制數量？建議不限制（九件全渲染），
但預設摺疊，只展開排除理由最接近可逆的那一件。

---

### C-2 · p-07 `colourSource` 升為 `crystal_confirmed`

Crystal 2026-09-20 確認 `p-07 絕美雕花透膚褲` 確實沒有裸色。
該筆可進入 deterministic gate。其餘七件維持 `observed_from_product_image`，待逐件確認。
