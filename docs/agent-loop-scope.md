# Agent loop：本輪施工範圍

Crystal 已批准：Agent owns the relationship. JEV strengthens the judgment.
Code protects the facts. The person owns the decision.

- 沿用原有 gates、canonical corpus、計價、Hobby 邊界與 Gateway 通道。
- 先驗兩道 gate：確認過的 closed fields 投影；canonical evidence，未知欄位拒絕。
- 接兩個固定任務 `style_tradeoff` / `basket_tradeoff`；沒有真正未決取捨就不呼叫。
- 同一確認狀態只判一次，不因修改件數而重判相同款式；錯誤不自動重試。
- 組合只用已確認數量、官方配套及 TypeScript 金額；不自動湊折扣。
- 接可修改的確認卡、候選與組合畫面；0–3 張主結果，unknown 與失敗都可繼續。
- 未核定的八件褲款保留 pending review，折扣仍為條件式模擬，不升格商品事實。
- 驗證：本機反例、兩任務 mock contract、typecheck、build、實際畫面；不 push、不部署。

本文件取代先前 review 的「固定一個插入點／只接一道構造題」限制。
