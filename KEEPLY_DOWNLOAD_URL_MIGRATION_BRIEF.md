# 📨 Handoff Brief — 下載 URL 遷移到 keeply-releases public mirror

> **From**: Keeply main repo session (spec 126, 2026-04-18)
> **To**: keeply-website repo Claude agent（或任何後續接手的人/AI）
> **Status**: 待執行
> **Urgency**: 🔴 **P0 production bug** — 目前所有官網訪客下載按鈕都是壞的

---

## 🎯 TL;DR（30 秒版）

Keeply **源碼 repo `boy1690/Keeply` 是 private**，官網目前所有下載 CTA 指向它 → 無登入訪客點 = GitHub 404 頁面 + Sign-in 表單 → 使用者以為是詐騙站離開。

修復：把 repo 內所有 `boy1690/Keeply/releases` 字串**一律**改為 `boy1690/keeply-releases/releases`，push 後 GitHub Pages 自動 deploy。

受影響 ~44 處字串、跨 22 檔案。全部是**純文字替換**，無邏輯變更。

---

## 🧭 背景（Why this matters）

### 問題本質

| | |
|---|---|
| `boy1690/Keeply` | **Private** GitHub repo（源碼）——無登入者點 release 頁面 = 404 + Sign-in |
| `boy1690/keeply-releases` | **Public** GitHub repo（release 鏡像，spec 122 建立）——公開可下載 |

官網現在把下載按鈕指向 private repo → production bug，自 v1.0.1 發佈（2026-04 早期）起存在。

### 發現經過

- 2026-04-18 執行 spec 122 (installer-trust-kit) 時，要把 Keeply v1.0.2 送 WDSI + winget-pkgs
- WDSI 表單的「file URL」欄若填 private repo 連結，Microsoft analyst 點進去 404 → submission 可信度扣分
- 為此新建 `boy1690/keeply-releases` public mirror 並 push v1.0.2 assets 過去
- 發現**官網一直以來都指 private repo**——不只 WDSI/winget 的問題，所有一般使用者也踩同樣 404

### 參考文件（source of truth）

這些在 Keeply main repo（private），你可能沒 access，但引用作為背景：
- `INSTALLER_TRUST_SETUP.md` PART 2 B — 解釋 public mirror 架構為什麼存在
- `memory/project_release_mirror.md` — Keeply session 的永久 memory（此次遷移的決策脈絡）
- spec 122 / 126 on `boy1690/Keeply` (gitignored in that repo)

---

## 📋 精確範圍（What to change）

### 替換規則

**單一規則、全局套用**：

```
FROM:  github.com/boy1690/Keeply/releases
  TO:  github.com/boy1690/keeply-releases/releases
```

適用於所有 variant：
- `https://github.com/boy1690/Keeply/releases/latest` → `https://github.com/boy1690/keeply-releases/releases/latest`
- `https://github.com/boy1690/Keeply/releases/download/...` → `https://github.com/boy1690/keeply-releases/releases/download/...`
- 任何 `'github.com/boy1690/Keeply/releases'` 字串（JS string）

**不替換**的場景：
- 出現在 `/specs/` 或 `/idea/` 目錄的（docs/notes，不上 production）
- 出現在 `.playwright-mcp/` 目錄的（Playwright test 記錄）
- 註解（comments）內：雖技術上允許，但建議同步改以一致性；若 comment 明確是「歷史說明 Keeply source repo 位置」則保留

### 檔案清單（~44 matches, 22 files）

執行前在 keeply-website repo 根目錄跑：

```bash
grep -rnE 'boy1690/Keeply/releases' . | grep -v -E '\.playwright-mcp|/specs/|/idea/|/node_modules/|\.git/'
```

**預期會看到**（2026-04-18 盤點結果）：

```
./components.js:97                                 ← footer download link
./download-modal.js:8                              ← RELEASE_URL constant
./index.html:494,505                               ← root index（中文預設）
./_dev/templates/index.html:493,504                ← 母版模板（未來新增語言會從此生成）
./cs/index.html:470,479                            ← Čeština
./da/index.html:470,479                            ← Dansk
./de/index.html:470,479                            ← Deutsch
./en/index.html:470,479                            ← English
./es/index.html:470,479                            ← Español
./fi/index.html:470,479                            ← Suomi
./fr/index.html:470,479                            ← Français
./hu/index.html:470,479                            ← Magyar
./it/index.html:470,479                            ← Italiano
./ja/index.html:470,479                            ← 日本語
./ko/index.html:470,479                            ← 한국어
./nl/index.html:470,479                            ← Nederlands
./no/index.html:470,479                            ← Norsk
./pl/index.html:470,479                            ← Polski
./pt/index.html:470,479                            ← Português
./sv/index.html:470,479                            ← Svenska
./tr/index.html:470,479                            ← Türkçe
./zh-CN/index.html:470,479                         ← 简体中文
./zh-TW/index.html:470,479                         ← 繁體中文
```

> ⚠️ **行號可能已變動**。實際執行以 agent 自己 grep 的結果為準，上面清單只是起始 baseline。

### 特別注意：`_dev/templates/index.html`

這看起來是**母版模板**，其他語言版本從此生成。替換時**也必須改它**，否則下次從 template 生新語言會帶回舊 URL。若 repo 有自動生成 script（類似 `scripts/build-locales.sh`），要確認生成邏輯跑過後各語言版本 URL 一致。

---

## 🚀 執行步驟（How to execute）

### 建議 workflow

1. **Pre-flight**
   ```bash
   cd /d/tools/doing/keeply-website
   git status            # 確認 clean working tree
   git pull              # 同步到最新 master
   git checkout -b fix/download-url-migration
   ```

2. **全局 find-replace**（兩種方式任選）

   **選項 A：PowerShell / bash sed（快速）**
   ```bash
   # Linux/Mac:
   find . -type f \( -name "*.html" -o -name "*.js" \) \
     -not -path './.git/*' \
     -not -path './node_modules/*' \
     -not -path './.playwright-mcp/*' \
     -not -path './specs/*' \
     -not -path './idea/*' \
     -exec sed -i '' 's|boy1690/Keeply/releases|boy1690/keeply-releases/releases|g' {} +
   ```

   ```powershell
   # Windows PowerShell:
   Get-ChildItem -Recurse -Include *.html,*.js -Path . `
     | Where-Object { $_.FullName -notmatch '\\\.git\\|\\node_modules\\|\\\.playwright-mcp\\|\\specs\\|\\idea\\' } `
     | ForEach-Object {
         (Get-Content $_.FullName -Raw) `
           -replace 'boy1690/Keeply/releases', 'boy1690/keeply-releases/releases' `
           | Set-Content $_.FullName -NoNewline
       }
   ```

   **選項 B：手動檔案逐個改**（若怕 sed 誤傷，或想過 code review）

3. **驗證替換完整（regression guard）**
   ```bash
   # 應回傳 0 matches (排除 docs):
   grep -rnE 'boy1690/Keeply/releases' . \
     | grep -v -E '\.playwright-mcp|/specs/|/idea/|/node_modules/|\.git/'
   ```

   **0 matches = ✅ pass**。有 match 就手動補修。

4. **建議額外 grep**（確認新 URL 到位）：
   ```bash
   grep -rc 'boy1690/keeply-releases/releases' . \
     | grep -v ':0$' | wc -l
   ```
   應得到約 44+ (和原本替換數相符)。

5. **Local smoke test**
   - `python3 -m http.server 8000` 或同類起 local server
   - 瀏覽器打開 `http://localhost:8000`
   - 點下載按鈕，看 href 是否指 `keeply-releases`（chrome inspect 看 `<a>` tag）
   - 切幾個語言 `/en/`, `/ja/`, `/zh-TW/` 驗證
   - 實際點進去看能不能下載到檔案（無登入狀態）

6. **Commit + Push**
   ```bash
   git add -A
   git diff --cached --stat   # review 數字，應 ~22 files changed

   git commit -m "fix: migrate all download links to keeply-releases public mirror

   The boy1690/Keeply repo is private; linking to its /releases returns
   404 to unauthenticated visitors (i.e. all new users). Public download
   mirror boy1690/keeply-releases was created in spec 122 (Keeply main
   repo) precisely to solve this.

   Replaced across 22 files (~44 matches):
   - 20 index.html language variants
   - root index.html + _dev/templates/index.html母版
   - components.js footer + download-modal.js RELEASE_URL

   Refs: KEEPLY_DOWNLOAD_URL_POLICY.md for guardrails."

   git push origin fix/download-url-migration
   ```

7. **開 PR 或直接 merge 到 master**
   - GitHub Pages 的 deploy.yml 在 master push 後自動觸發
   - `actions/deploy-pages@v4` 把整個 repo push 成 Pages 內容
   - 幾分鐘內 `keeply.work` 就 live 新 URL

8. **Post-deploy 驗證**（非常重要）
   - **無痕視窗** 打開 `https://keeply.work`
   - 點下載按鈕 → 應直接跳 `github.com/boy1690/keeply-releases/releases/latest`
   - **不應** 看到任何 GitHub sign-in 頁面（那就是還沒修好）
   - 測幾個語言路徑：`keeply.work/en/`, `keeply.work/ja/`, `keeply.work/zh-TW/`

---

## 🛡️ 驗收標準（What counts as done）

1. [ ] `grep -rnE 'boy1690/Keeply/releases' .` (排除 docs/node_modules/.git/playwright) 回 **0 matches**
2. [ ] `_dev/templates/index.html` 也已更新（不可遺漏，否則新語言會帶舊 URL）
3. [ ] Local smoke test：root + 至少 2 個非英語 locale 下載按鈕 href 指向 `keeply-releases`
4. [ ] `git push` + GitHub Pages deploy 成功（Actions 綠）
5. [ ] 無痕視窗 `keeply.work` 下載按鈕真的能下載（不見 GitHub 404）
6. [ ] 建立或更新 `KEEPLY_DOWNLOAD_URL_POLICY.md`（同目錄另一檔）作為長期規則 guardrail
7. [ ] 在 Keeply main repo 留言/comment：spec 126 T3 驗收完成（讓 Keeply session 知道可以 close spec）

---

## ⚠️ 常見陷阱

- **sed 的分隔符衝突**：URL 含 `/`，所以 sed 用 `|` 當分隔（見上述命令）。若 replacement 內容變含 `|` 則要再換。
- **Windows 結行**：替換後可能 CRLF/LF 混淆。commit 前看 `git diff`，若都是 `^M` 類 whitespace 變更要 `git config core.autocrlf` 確認 behaviour。
- **HTTP caching**：deploy 後 Cloudflare/GitHub CDN 可能 cache 舊 HTML 幾分鐘。無痕驗證若看到舊 href，等 5-10 分鐘再重試。
- **漏掉 `_dev/templates/`**：agent 自動跑替換若 path exclusion 打錯，可能漏掉模板 → 下次生新語言 regression。手動 `ls _dev/templates/` 確認。
- **替換後 components.js 的 data-i18n 屬性**：若有多處使用 `data-i18n="footer.download"`，確認對應 i18n JSON 不需改（i18n 只含文字、不含 URL）。

---

## 🔗 相關資源

- **Public mirror repo**（目標 URL）：<https://github.com/boy1690/keeply-releases>
- **Private source repo**（**不要**再指這個）：`boy1690/Keeply`（private，你八成無 access）
- **Spec 126（這個任務的來源）**：在 Keeply main repo `specs/infra/126-website-download-url-fix/`（gitignored，無法遠端讀）
- **Long-term policy**：同目錄的 `KEEPLY_DOWNLOAD_URL_POLICY.md`

---

## ❓ 給執行 agent 的啟動腳本

如果你是一個 Claude agent 接手這份 brief，建議你的 first-message 對用戶說：

> 「我看到 `KEEPLY_DOWNLOAD_URL_MIGRATION_BRIEF.md`，準備執行下載 URL 從 `boy1690/Keeply` 遷移到 `boy1690/keeply-releases`。先跑 pre-flight grep 盤點當前狀態，驗收完成後 commit + push。需要你授權開始嗎？」

然後照 execution 步驟 1-8 做。

---

*Brief authored by Claude in Keeply main repo, spec 126, 2026-04-18 | 遇狀況在 PR 描述 reference 本 brief*
