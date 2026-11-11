# 研究指揮中心＋Supabase 實作計畫

## 目標

把現有證據工具升級為可由 GitHub Pages 開啟、可在頁面直接管理研究文件，並以 Supabase 私人同步的研究指揮中心。

## 實作順序

1. 定義新版工作區資料契約、轉換與同步判斷純函式。
2. 建立研究指揮中心首頁與文件編輯流程。
3. 建立 Supabase schema、RLS 政策、瀏覽器 auth／讀寫 adapter。
4. 加入雲端設定、Email 登入、版本選擇與自動同步 UI。
5. 更新備份格式、可攜版、說明文件與 GitHub Pages 流程。
6. 執行單元、結構、瀏覽器與部署驗證。

## 風險與處理

- 資料覆蓋：首次同步永不自動覆蓋；明確要求選擇。
- Supabase 設定錯誤：保留本機資料並呈現錯誤。
- 公開 repository 洩漏研究內容：只提交泛用程式與 SQL，不提交私人種子資料。
- GitHub Pages 靜態限制：Supabase client 打包為瀏覽器 ESM，不需要自建伺服器。
- 舊版資料：匯入與 localStorage 自動轉換。

## 驗證

- `npm test`
- `npm run check`
- `npm run build`
- 在 320px、768px、桌面寬度檢查研究中心、文件 dialog 與雲端面板。
- GitHub Actions 成功，Pages HTTP 200。
