# 研究指揮中心

這是一個本機優先、可選擇 Supabase 私人同步的學術研究平台。它把研究計畫、研究文件、證據與文獻關係放在同一個可點選的工作台：

> 探索文獻 → 保存全文 → 擷取原文 → 人工查證 → 建立關係 → 寫作引用 → 回查稽核

它最重要的規則是：**原文、AI 解釋與研究者推論必須分開保存；每個準備寫進論文的說法都能回到原文、頁碼與來源。**

## 已完成

- 研究指揮中心：研究名稱、核心問題、目前階段、下一步與完整度摘要。
- 可直接點開與編輯的研究文件：研究計畫、研究護照、搜尋策略、文獻矩陣與分析計畫。
- 證據卡與證據台帳：主張、原文、解釋、頁碼、來源、狀態、限制。
- 證據編號：`YYYYMMDD-Qnn-Ennn`。
- 全庫文字搜尋、狀態篩選與核心文獻篩選。
- 文獻地圖：核心文獻、已取得文獻、推薦／未讀文獻與引用關係。
- 複製可回查的寫作文字。
- JSON 完整工作區備份／還原、CSV 台帳、Markdown／Obsidian 筆記匯出。
- 可選擇連接自己的 Supabase，以 Email 魔法連結登入並跨電腦同步。
- 未設定 Supabase 時不登入、不上傳；資料只放在瀏覽器 `localStorage`。

## 線上開啟

[開啟 GitHub Pages 研究指揮中心](https://wttntpc.github.io/research-evidence-workbench/)

## 最簡單：直接雙擊開啟

不需要 Python、不需要 MCP，也不用輸入網址。直接雙擊：

```text
研究證據工作台-直接開啟.html
```

這是完整的單檔可攜版；CSS 與 JavaScript 已經放在同一個 HTML 裡。資料仍只保存在目前瀏覽器中。

也可以雙擊 `啟動研究證據工作台.cmd`，它會自動啟動本機伺服器並開啟瀏覽器；關閉標題為「研究證據工作台伺服器」的命令視窗即可停止。

## 開發模式啟動

在此資料夾開啟 PowerShell：

```powershell
python -m http.server 4176 --bind 127.0.0.1
```

再開啟：

```text
http://127.0.0.1:4176/
```

一般的 `index.html` 使用 JavaScript module，因此不能直接雙擊；請使用上方的可攜版 HTML。

## 最短使用流程

1. 開啟「研究中心」，按「設定研究計畫」，填研究名稱、核心問題、階段與下一步。
2. 首頁會建立五份常用文件；直接點卡片開啟與編輯。
3. 在 Google Scholar／Elicit／Consensus 找候選文獻，書目與 PDF 放進 Zotero。
4. 按「新增證據」，保存真正支持或反駁主張的原文、頁碼與來源。
5. 把翻譯或 AI 說明放在「解釋（非原文）」欄，核對原文後再改查證狀態。
6. 寫作時用證據編號回查；正式引文仍由 Zotero 插入。
7. 啟用 Supabase 跨電腦同步，並定期下載 JSON 離線備份。

## Supabase 跨電腦同步

請使用獨立的 Supabase 專案，不要沿用課程雷達資料庫。完整圖文以介面提示為準，設定順序如下：

1. 在 Supabase 建立一個新 project。
2. 開啟 SQL Editor，把 [`supabase/schema.sql`](supabase/schema.sql) 全部貼上並執行一次。
3. 在 Authentication → URL Configuration，把 Site URL 與允許的 redirect URL 加入：
   `https://wttntpc.github.io/research-evidence-workbench/`
4. 到 Project Settings／Connect 複製 Project URL 與 **publishable key**（舊專案可用 anon key）。
5. 回到工作台「雲端同步」，貼入兩項設定並按「儲存並測試連線」。
6. 輸入 Email，按「寄送登入連結」，到信箱點連結回到工作台。
7. 第一次同步若兩邊都有資料，先下載 JSON，再明確選擇「使用雲端資料」或「以本機資料覆蓋雲端」。

連線成功後，後續變更會延遲約一秒自動同步。Supabase 設定只存在目前瀏覽器；換電腦時需再次貼入 Project URL 與 publishable key，再用相同 Email 登入。

### 安全原則

- 瀏覽器只能使用 publishable／anon key；絕對不要填入 secret 或 service-role key。
- `research_workspaces` 已啟用 RLS，四種操作都限制為 `(select auth.uid()) = user_id`。
- GitHub repository 只放程式碼與資料表結構，不放研究內容。
- Supabase 離線或暫停時，本機資料仍保留；恢復後可重新同步。
- JSON 備份仍是必要的第二層保護。

## 文獻地圖規則

- 每篇文獻設定一個穩定且簡短的「文獻鍵值」，例如 `wu-2025-balance`。
- 在「引用的文獻鍵值」填入本篇引用的文獻，用逗號分隔。
- 金色節點是核心文獻；紫色虛線是推薦或尚未取得全文的文獻。
- 同一文獻的多筆證據會合併成一個節點，節點中央顯示證據筆數。

## 工具分工

| 階段 | 工具 | 原則 |
|---|---|---|
| 找文獻 | Google Scholar、Elicit、Consensus | 只產生候選清單，不直接當證據 |
| 管理全文 | Zotero | PDF、書目、DOI 相互對得上 |
| 理解內容 | SciSpace、翻譯、NotebookLM | 文字放解釋欄，不能覆蓋原文 |
| 建立脈絡 | Obsidian、OpenAlex | 區分已取得與推薦／未讀 |
| 正式寫作 | Word ＋ Zotero | 證據編號回查，Zotero 管正式引用 |

## 內附研究工作流 Skill

儲存庫的 `skills/exercise-emotion-cognition-workflow` 是一個已驗證的 Codex Skill，用來維持「運動—情緒—認知」研究從研究問題、文獻搜尋、全文比較、證據卡、分析計畫到寫作稽核的連續性。

換電腦後，可將整個 Skill 資料夾複製到：

```text
%USERPROFILE%\.codex\skills\exercise-emotion-cognition-workflow
```

重新開啟 Codex 後，可使用 `$exercise-emotion-cognition-workflow` 呼叫。

## 後續建議

1. 本機 PDF 全文索引、OCR、逐頁原文定位與反白截圖。
2. Zotero 本機 API：自動帶入書目與開啟對應 PDF。
3. Obsidian Vault 寫入：每篇文獻與每項主張各自成原子筆記。
4. OpenAlex 引用圖：自動提出漏網文獻，但由研究者確認。
5. Word 外掛：選取句子、輸入證據編號、插入回查註解。

## 開發與驗證

```powershell
npm install
npm run build
npm test
npm run check
```

詳細範圍見 [SPEC.md](SPEC.md)。公開儲存庫不包含任何個人研究計畫、證據資料或瀏覽器 `localStorage` 內容。

