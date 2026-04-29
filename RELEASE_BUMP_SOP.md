# 🔄 Keeply Website — Per-Release Bump SOP

> Long-term checklist for syncing keeply.work to a new Keeply main-repo release.
>
> Created: 2026-04-30 · Triggered by: Spec 187 closeout (Mac auto-update fix exposed that v1.0.8 missed website bump)
> Companion: [KEEPLY_DOWNLOAD_URL_POLICY.md](./KEEPLY_DOWNLOAD_URL_POLICY.md)

---

## TL;DR — 3 lines

```bash
# Edit one file, commit, push. CI auto-rebuilds 19 locales in ~3 min.
```

```diff
 // _dev/release-config.json
-  "version": "X.Y.Z-prev",
-  "versionTag": "vX.Y.Z-prev",
+  "version": "X.Y.Z-new",
+  "versionTag": "vX.Y.Z-new",
   "price": "599",
-  "checksums": { /* old SHA256s — CI will refetch */ },
+  "checksums": {},
```

```bash
git add _dev/release-config.json
git commit -m "chore(release): bump to vX.Y.Z"
git push origin master
# Wait ~3 min, verify https://keeply.work shows new version
```

---

## Why this SOP exists

Keeply 主 repo `RELEASE_CHECKLIST.md` 原本只有 6 步（CI / WDSI / winget / Partner Center / 憑證 / Phase 2）。**漏了「同步 keeply.work」**——v1.0.8 在 2026-04-29 ship 後，網站還停在 v1.0.7、下載按鈕全部失效一天，直到 spec 187 closeout 順手發現才補。

每個 release 都該跑這個 5 分鐘 catch-up，避免轉換率漏斗斷頭。

---

## Full SOP — Per-Release Steps

| # | Action | Where |
|---|--------|-------|
| 1 | 等 `release-mirror.yml` 在主 repo 跑完且 `keeply-releases` 有新 tag | <https://github.com/boy1690/keeply-releases/releases> |
| 2 | 開 keeply-website checkout，`git pull master` 確認最新 | this repo |
| 3 | 編輯 `_dev/release-config.json`：`version` + `versionTag` 改新版號 | this repo |
| 4 | 同時把 `checksums` 物件改成 `{}`（CI 會 fetch 新值，留舊值會塞錯雜湊到網頁） | this repo |
| 5 | `git add _dev/release-config.json && git commit -m "chore(release): bump to vX.Y.Z"` | this repo |
| 6 | `git push origin master` — 觸發 `.github/workflows/deploy.yml` | this repo |
| 7 | 等 ~3 min，無痕視窗開 <https://keeply.work> 確認下載按鈕指新版本 | live |

### Step 7 verification (one-liner)

```bash
curl -s https://keeply.work/ | grep -oE 'Keeply_[0-9.]+_[a-z0-9_-]+\.(exe|msi|dmg|tar\.gz)' | sort -u
# Expected: only the new vX.Y.Z; no leftover old version
```

如果還看到舊版號 → 檢查 deploy.yml run 是否成功、cache 是否需要硬刷新。

---

## What CI does automatically (you don't need to)

`.github/workflows/deploy.yml` (push: master 觸發)：

1. `npm ci` 裝依賴
2. `npm run build` →
   - `_dev/build-checksums.js`：去 `boy1690/keeply-releases/releases/v{version}` 抓 4 個 assets 算 SHA-256，寫回 `release-config.json` 的 `checksums`（你不需要手動填）
   - `_dev/build.js`：讀 `release-config.json` + 所有 `i18n/*.json`，從 `_dev/templates/index.html` 生成 19 個 locale 的 `index.html` + 4 個共用頁面
   - 注入 SoftwareApplication JSON-LD（含正確 version + 下載 URL + 雜湊）
   - 重算 SRI hashes
3. GitHub Pages deploy

ETA：第一次 build ~2-3 min，後續含 cache ~1-2 min。

---

## Macros / pitfalls

### ❌ 不要手動編輯 `checksums` 物件
`_dev/build-checksums.js` 從 GitHub Releases API 抓真實雜湊。手動填可能跟實檔不一致 → 用戶按「驗證下載」會看到雜湊錯誤、誤以為下載被竄改。**清空 `{}` 就好，CI 會填**。

### ❌ 不要手動編輯 `{locale}/index.html` 想說省 build
這些是 build 產物。下次 CI 跑會被覆蓋。要改就改 `_dev/templates/index.html` + i18n JSON。

### ❌ 不要忘記 push 完去 live 驗證
GitHub Pages cache 偶爾會慢個 1-2min。等 deploy workflow 顯示 success 後再驗。

### ✅ 多平台支援已存在
網站早就有 `download-btn-win` + `download-btn-mac` 兩個下載按鈕，不需要為 Mac/Win 新版另外加 section。改 `release-config.json` version 就會兩邊一起更新。

### ✅ `1.0.8-1` 形式的 hotfix tag 怎麼處理
看 hotfix 內容：
- 純 darwin asset 重簽（spec 187 mac_only mode）→ keeply-releases 沒新 tag，本網站**不需動**
- 重發整版（mac_only=false 的 dispatch / 新 tag push）→ keeply-releases 有新 tag，**bump release-config 到那個 tag**

判斷依據：去 https://github.com/boy1690/keeply-releases/releases 看有沒有新 tag entry，沒有就不動網站。

---

## Background — Mac auto-update 為什麼到 v1.0.8 才 work

主 repo Spec 187 (2026-04-30 closed) 修了從 v1.0.0 起一直壞的 macOS updater 簽章漂移：

- 原本 `Keeply_aarch64.app.tar.gz.sig` 內容跟實檔對不上（Apple notarize/staple 在 tauri-bundler 自動簽完後才動 binary）
- 同時順手修了 spec 174 D8 輪 signing key 時漏更新的 mirror verify pubkey

對網站的影響：v1.0.7 之前任何 Mac 用戶 install 後 auto-update 必失敗（雖然實際 0 個 Mac 用戶）；**v1.0.8 起 Mac auto-update 才真的 work**。網站本身不受影響——下載 .dmg/.app.tar.gz 流程不變。

---

## File locations referenced

- Centralized release version: [`_dev/release-config.json`](./_dev/release-config.json)
- Build orchestrator: [`_dev/build.js`](./_dev/build.js) + [`_dev/build-checksums.js`](./_dev/build-checksums.js)
- HTML template (single source for 19 locales): [`_dev/templates/index.html`](./_dev/templates/index.html)
- Download URL policy (always use mirror): [KEEPLY_DOWNLOAD_URL_POLICY.md](./KEEPLY_DOWNLOAD_URL_POLICY.md)
- Migration history (v1.0.1 fix): [KEEPLY_DOWNLOAD_URL_MIGRATION_BRIEF.md](./KEEPLY_DOWNLOAD_URL_MIGRATION_BRIEF.md)
- Deploy workflow: [.github/workflows/deploy.yml](./.github/workflows/deploy.yml)

---

*SOP v1.0 · 2026-04-30 · Maintained by whoever owns keeply-website at the time*
