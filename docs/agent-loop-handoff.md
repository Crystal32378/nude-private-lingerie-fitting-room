# NUDE × JEV：交 Crystal／福／Sol 驗收

分支：`feature/jev-fitting-room`，基底 `b61ad26`。全部保持未 commit；沒有 push、Preview 或 Production 部署。

Agent owns the relationship. JEV strengthens the judgment.
Code protects the facts. The person owns the decision.

## 本輪完成的產品範圍

- 新入口 `/fitting-room`，由原商品目錄的「幫我挑選」進入。
- 原話只在本機 React state；本機 hints 只決定提問，不寫入 hard constraint。
- 一張可修改的確認卡；後續依目前狀態選擇問人、判斷或呈現結果，沒有 stage counter。
- `style_tradeoff`：合格且在確認數量／整籃預算內的款式，同批 Choice；保留原始選項與比例，另以 status 表達是否採用。
- `basket_tradeoff`：只比較 TypeScript 算好的合法組合；只算最低總額時不呼叫，已明確偏好且同時最低價時也不再判一次。
- 組合範圍限同一內衣款式 × 確認數量，可加官方配套內褲；本輪沒有混款任意購物車搜尋。
- 修改件數若候選集合不變，沿用款式判斷；模型失敗或已完成的相同 request key 不自動重試。舊答案不能覆蓋新確認狀態。
- 0–3 張主結果；顯示上限不再改寫商品分類。排除品另收合。
- 人選方案才保留，不自動加購或送出訂單；選內褲時自行確認官方尺碼。

## Gate 與事實邊界

- API 只接受兩個固定 task 與 confirmed UserField 的有限列舉／boolean／有限數字選項。姓名、email、行程、原話、任意商品欄位、價格與 instructions 都不能由客戶端提供。
- 只有確認過的必要 closed context 被投影送往 Gateway；件數與金額是 server 依 canonical 商品及已確認數量重算的 basket facts。
- 商品 state 只由 canonical schema 投影；`seam_construction` 等未知欄位 fail closed。
- 新任務的 model、questions、providerOptions 也由固定 builder 建立；不能替換 prompt 或關掉 disallowPromptTraining。
- 所有新任務使用 `disallowPromptTraining: true`，不宣稱 ZDR。沒有 Direct fallback。
- 精細捏合、抬手限制若缺穿法證據，保留待確認，不讓模型推測成合格。
- 無痕必要條件缺實測，維持待確認。沒有舒適、人體工學或醫療保證。
- 商品價格、配套、件數、折扣與整籃上限全由 TypeScript 負責；模型輸出沒有改寫路徑。

## 已完成驗證

- 74/74 本機測試通過（原 53 項保留）；新增兩種 task、不可繞過的投影、Choice 語意、NaN／格式不合法、confidence 衝突、timeout、整籃預算、避免重複判斷。
- `tsc --noEmit --incremental false` 通過；Next production build 通過。
- 同源回歸：Next 內部 localhost URL 與瀏覽器 127.0.0.1 的差異不再誤擋；真正不同 origin 仍為 403。
- 真正 HTTP 入口：短句塞進 outerGarment → 400；不存在的 evidence 欄位 → 400；沒有判斷需要 → 200/skipped，未觸發模型。
- Chrome 本機 UI：0、1、2、3 張卡均逐一操作；修改套頭答案可從一款移到兩款。
- 手機 390×844：DOM 寬度 390，無水平溢出；實際讀圖檢查。
- Production build 的真實瀏覽器流程已走完 style_tradeoff 與 basket_tradeoff，實際展開分布並保留使用者選擇；修改原話會回到確認，重新確認相同選項會沿用本輪判斷。
- 無憑證模式：模型失敗後仍可看事實、計價並保留選擇。瀏覽器只觀察到 extension 自身的 No Listener 訊息，未觀察到此頁產品程式錯誤。

## 真實 Gateway contract 記錄

使用 synthetic 的 confirmed closed fields；沒有真人原話或照片。兩個 task 各一次，同一既有 OIDC／Gateway 認證路徑；未印出或改動憑證。

| 任務 | 時間 | input / output tokens | generationId |
|---|---|---|---|
| style_tradeoff | 2,376 ms | 2,809 / 328 | gen_01M2ZZFZYNGDV6JC4H6HVGT9R0 |
| basket_tradeoff | 640 ms | 2,805 / 129 | gen_01M2ZZG0ZJQB0F0CCXGRSKYFEZ |

上表兩次均完成解析。後續另有 1 次 HTTP 入口排查、2 次真實瀏覽器端到端驗證；本輪共 5 次成功 Gateway 呼叫，未動用 YouCam。款式 confidence 0.25–0.65，按既有 0.70 provisional 門檻不採用；組合選 insufficient_evidence（分布 0.78、confidence 0.73）。沒有為了展示效果降低門檻。原始 Choice／probabilities 與本地 abstention status 分開保存。

requested model 為 `typesafe-ai/jev`，routing 指向 `typesafe-ai`。上游精確版本 unknown；使用原生 fetch HTTP API，沒有新增 SDK 依賴。回應中的 disallow prompt training 路由紀錄不等於證明零留存。

官方契約：[Vercel Evaluation](https://vercel.com/docs/ai-gateway/modalities/evaluation)。本輪讀取官方 Markdown，保留同一 HTTP API，沒有重做 parity spike。

## 公開前仍須確認的資料

- 八件內褲逐列品牌核對尚未寫入 corpus；選件與 p-07 顏色確認不等於整列批准。本機只顯示「配套草稿，待品牌核對」，不讓未核定配套進 JEV 組合推薦。
- `termsVerified=false`，promotionEligible 仍 unknown；預設使用原價。活動不假裝 live，沒有已核定資格就不計折扣。
- 庫存、運費、到貨日尚未確認；顯示的是商品合計，不是假結帳金額。
- 所有模型判斷仍是 prototype；沒有校正完成或實測無痕的宣稱。

## Sol 的產品驗收（不擴架構）

1. 從情境、確認到款式／組合選擇能走完，能返回修改。
2. 必要才叫 JEV，原話不出網路；純計價／單一候選／無關偏好不呼叫。
3. 故意矛盾的模型答案不能改價格、顏色、扣法、數量或來源。
4. missing evidence、低 confidence、格式錯誤與 unknown 真正留為待確認。
5. 排除品不會因折扣回來；整組超標不能靠單品價格或模擬折扣通過。
6. 0、1、2、3 張結果都能呈現，不補卡、不改分類。
7. JEV 失敗仍能看事實、修改條件、計價、自己決定。
8. 第一次看的人能在 90 秒內理解並選擇。此項仍需 Sol／真人實測，不能拿工具操作速度當證據。

驗收過關且無 blocking bug 就交付；不再把增加架構或增加測試數量當驗收條件。
