# 驗收紀錄

驗收日期：2026-11-11（Asia/Taipei）

## 已驗證

- 24 項 Node 測試：證據功能、工作區轉換、同步決策、Supabase adapter、RLS SQL 與 HTML 結構全部通過。
- JavaScript 語法檢查：`app.js`、`core.mjs`、`cloud.mjs`、`cloud.bundle.mjs` 全部通過。
- `npm run build` 成功產生本機 Supabase bundle 與免安裝單檔版。
- GitHub Actions run `42985182143`：test 與 deploy jobs 均成功。
- GitHub Pages 回應 HTTP 200，頁面含研究指揮中心與 Supabase 設定欄位。
- 線上瀏覽器動態檢查：研究計畫 dialog 可開啟／取消；雲端面板可切換；未登入時上傳按鈕正確停用；console 無 error 或 warning。
- 320px viewport 檢查：雲端同步內容與三張設定卡仍可存取。

## 尚待真實帳號驗證

尚未提供研究專用 Supabase Project URL、publishable key 與登入 Email，因此未對真實專案執行魔法連結、RLS 寫入與跨裝置往返測試。程式、SQL 與 mock adapter 已通過測試；完成 README 的一次性設定後應再做真實同步驗收。

## 建議人工快驗

1. 在 Supabase SQL Editor 執行 `supabase/schema.sql`。
2. 設定 GitHub Pages redirect URL，貼入 Project URL 與 publishable key。
3. 用 Email 登入，確認空白雲端可接收本機研究工作區。
4. 在第二台電腦登入，確認可下載同一工作區。
5. 兩邊各自修改後確認出現版本選擇，不會靜默覆蓋。

