# Gateway contract spike — 結果

**執行：** 2026-09-20 · **2 次呼叫**（第 1 次被 ZDR 方案限制擋下，第 2 次成功）
**認證：** `VERCEL_OIDC_TOKEN`（OIDC）。`AI_GATEWAY_API_KEY` 已由福移除。
**端點：** `POST https://ai-gateway.vercel.sh/v1/evaluate`，`model: typesafe-ai/jev`
**state：** `nude-08` 商品欄位＋官網規格表。**零個人資料。**
**腳本：** `/tmp/jev-spike/spike.mjs`（可丟棄，未進 repo）

---

## 一、先講擋路的那一個：ZDR 在 hobby 方案不可用

第 1 次呼叫帶了 `providerOptions.gateway.zeroDataRetention: true`，回 **403**：

> Zero Data Retention (ZDR) is only available for Pro and Enterprise plans. **Current plan: hobby.**

v3 §七的架構假設了 ZDR 可用。**這個假設不成立。**

### 為什麼這件事重要

架構把 JEV 呼叫分成兩族，隱私風險完全不同：

| 請求 | state 內容 | 沒有 ZDR 的後果 |
|---|---|---|
| **Request B**（商品判斷） | 只有商品欄位 | **沒有影響。** 商品資料本來就是公開的 |
| **Request A**（理解層） | **她的原話**，含穿脫困難描述 | ⚠ 她描述身體限制的句子會以一般保留政策送出 |

Request A 是 Layer 0 的核心——讀她的自然語言就是它的工作，繞不開。

### 三個選項，待裁示

1. **升級 Pro** — 取得 ZDR，架構不動。
2. **不用 ZDR，誠實揭露** — v3 §九隱私邊界改寫，明白寫出「妳輸入的文字會送到模型服務商，保留政策依其標準條款」。使用者有權在知情下決定。
3. **Request A 不走 Gateway** — 例如改由使用者以封閉選項作答（Layer 0 本來就只用 Choice／Boolean），
   讓自由文字完全不離開瀏覽器。**這會大幅改變 demo 的體感**（「用自己的話描述困擾」是整個提案的起點），
   但它是唯一不花錢也不降低隱私的解。

> 我的建議是 **1 或 2，不要 3**。選項 3 等於拿掉這個產品最重要的那一步。
> 若走 2，揭露文字必須出現在輸入框旁邊，不是藏在頁尾。

第 2 次呼叫拿掉 ZDR 後成功——**因為 state 只有商品欄位，零個人資料，所以這次呼叫沒有隱私代價。**

---

## 二、契約檢核（全部通過，三項與預期不同）

```
HTTP 200 · 1,608 ms · inputTokens 1154 / outputTokens 209
marketCost $0.000048468 · gatewayCost $0
```

| 檢核 | 結果 |
|---|---|
| question IDs 原樣回傳 | ✅ 八題全中 |
| boolean `probability` 必定存在、語意 P(true) | ✅ 四題皆在 [0,1] |
| boolean **無** confidence | ✅ 與文件一致 |
| choice 回傳 `choice` ＋ `probabilities` | ✅ |
| score 回傳 `score` ＋ `probabilities` | ✅ 值域 [0, levels−1] 正確 |
| `providerMetadata.typesafe.confidence` | ✅ 存在，依 question id 索引 |
| `providerMetadata.gateway.generationId` | ✅ |
| `providerMetadata.gateway.routing` | ✅ 含完整 attempt 明細與 `planningReasoning` |
| `providerOptions.gateway.only` 生效 | ✅ routing 寫明 "Provider set restricted to: typesafe-ai" |

### 與預期不同的三項

**1. `legend` 不存在。** 文件說 score 會回 `legend`（層級編號 → 描述），實際**沒有**。
   → 程式不得依賴 `legend`，層級描述由我們自己的 question 定義保存。

**2. 模型版本沒有暴露。** `model` 欄位回的是 `"typesafe-ai/jev"`，不是 `jev-1.13.0`。
   → **v3 `Judgment.modelVersion` 無法從 Gateway 填。** 改記 `generationId`（可回查 Vercel log）
   ＋我們自己鎖定的 model slug。這是 Gateway 相對 Direct API 的唯一實質損失，但可接受。

**3. confidence 同時出現在兩處。** 既在 score／choice 的答案物件內（`a.confidence`），
   也在 `providerMetadata.typesafe.confidence`。兩處數值一致。
   → 程式擇一讀取並加 `?.` 保護；建議讀 `providerMetadata`，因為那是文件指定的位置。

**4. `rounding` 不存在**（文件說 provider 可選擇性宣告）。→ 不得依賴。

---

## 三、U6 的第一次 JEV 判斷（prototype，未校正）

對 `nude-08` 問了四個穿脫操作 boolean ＋ 一個 entry method choice：

| question | 原始值 | v3 門檻對應 | 判定 |
|---|---|---|---|
| `requiresReachingBehindBack` | **0.02** | ≤ 0.15 | **否** — 不需背手 ✅ |
| `requiresOverheadArmRaise` | **0.55** | 0.15–0.85 dead band | **`unknown`** |
| `requiresFineMotorPinch` | 0.18 | dead band（剛過 0.15） | `unknown` |
| `permitsFrontFastenThenRotate` | 0.30 | dead band | `unknown` |
| `entryMethod` | `front_clasp_only` p=0.99, conf 0.98 | ≥ 0.70 | **前扣進入** |

### 這個結果為什麼值得記下來

JEV 對「從哪裡扣」非常確定（前扣 0.99），對「怎麼把它穿上身」**真的分不出來**（0.55）。
這兩件事不矛盾——**妳可以從前面扣，但頭仍然要穿過那個不可拆的頸圈。**
模型把「扣合位置」和「進入方式」分開處理了，這正是 v3 §三把單一 mobility 判斷
拆成四個操作 boolean 的理由。

> **0.55 落在 dead band 正中央 → `unknown` → `nude-08` 維持 `Check with you`。**
> 這是我設計的門檻政策第一次碰到真實的困難案例，**它給出了誠實的答案，而且沒有經過任何調校。**
> 但這仍是 prototype judgment，不是 validated recommendation——D2 的校正工作照做。

### 另外三個 score

| question | score | confidence | v3 門檻對應 |
|---|---|---|---|
| `visibilityUnderThinWhiteShirt` | 2.79 / 3 | **0.79** | ≥ 0.70 → 採用。**可能在薄白襯衫下顯形** |
| `pressurePointRisk` | 1.94 / 3 | **0.44** | < 0.45 → **`unknown`** |
| `bandClosureBulk` | 0.38 / 3 | 0.62 | 0.45–0.70 → 以區間呈現並加註 |

八題的分佈是：**2 項採用、4 項 `unknown`、1 項區間加註、1 項確定為否。**
這個保守程度看起來是對的——但仍待 D2 以人工標記校正。

---

## 四、成本

單次八題：`inputTokens 1154 / outputTokens 209`，`marketCost` **$0.000048**。
示範案例通過 gate 的商品 2–3 件，一次完整判斷約 **$0.0001**。**成本不是約束。**

---

## 五、建議的 v3 修訂（併入先前清單，待批准）

7. §七：ZDR 檢核改為「hobby 方案不可用」，並記錄三選項
8. §五：`Judgment.modelVersion` 改為 `generationId` ＋ 我們鎖定的 model slug
9. §六：新增「不得依賴 `legend` 與 `rounding`」
10. §八：confidence 讀 `providerMetadata.typesafe.confidence`，加 `?.` 保護
11. §九隱私邊界：依 ZDR 裁示改寫

---

## 未做

未接 UI、未部署、未保存任何個人資料、未 commit。腳本留在 `/tmp`。
