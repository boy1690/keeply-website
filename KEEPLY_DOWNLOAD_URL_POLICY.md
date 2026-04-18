# 📜 Keeply Download URL Policy

> **Long-term guardrail** for anyone editing download CTAs on keeply.work
>
> Created: 2026-04-18 · Source: Keeply main repo spec 126 · Enforced by: [MIGRATION_BRIEF](./KEEPLY_DOWNLOAD_URL_MIGRATION_BRIEF.md)

---

## 🚫 Rule 1 — 絕不指 `boy1690/Keeply`

Keeply 源碼 repo (`boy1690/Keeply`) 是 **private**。

任何下載連結指向 `github.com/boy1690/Keeply/releases/...` 對無登入訪客 = **GitHub 404 + Sign-in 頁面**。這不是 404 文字，是 GitHub 把 private repo 遮蔽處理，看起來像「頁面不存在」——使用者會以為 keeply.work 連錯網址或是詐騙站。

**違反後果**：production bug，轉換率漏斗直接斷頭。

---

## ✅ Rule 2 — 下載連結必須指 `boy1690/keeply-releases`

Public mirror repo `boy1690/keeply-releases` 專門為發行而存在：
- 僅包含 README / LICENSE / CHANGELOG 三個 metadata 檔
- 每版發版的 4 個 assets（Windows .exe / .msi + macOS .dmg / .tar.gz）
- 無原始碼
- 無登入可直接下載

所有對外下載 URL 格式：
```
https://github.com/boy1690/keeply-releases/releases/latest          ← 下載最新版 landing
https://github.com/boy1690/keeply-releases/releases/tag/vX.Y.Z      ← 特定版本
https://github.com/boy1690/keeply-releases/releases/download/...    ← 直接 asset
```

---

## ⚠️ Rule 3 — 新增下載 CTA 必遵守本 policy

- 新 button / link / modal → 必用 `boy1690/keeply-releases`
- 新語言 locale → 從 `_dev/templates/index.html` 生成，確認模板本身已遵守 policy
- 新 JS 模組（類似 `download-modal.js`）→ 任何 RELEASE_URL constant 必用 public mirror
- Code review 時：grep `boy1690/Keeply/releases` 確認 PR 沒引入新違反項

---

## 🔍 快速自檢

發 PR 前跑這一行，應回 0 matches：

```bash
grep -rnE 'boy1690/Keeply/releases' . \
  | grep -v -E '\.playwright-mcp|/specs/|/idea/|/node_modules/|\.git/'
```

---

## 📚 背景與來源

| | |
|---|---|
| 問題何時出現 | v1.0.1 上線後 ~2 週（2026-04 初） |
| 何時發現 | 2026-04-18 執行 Keeply spec 122 (installer-trust-kit) 時，送 WDSI / winget-pkgs 連結 |
| 首次修復 | 2026-04-18 遷移（spec 126） |
| 架構決策文件（主 repo，private） | `specs/infra/122-installer-trust-kit/intent.md` D5 + `memory/project_release_mirror.md` |

**為什麼不把 Keeply source repo 直接開放成 public？** 閉源商業模式、保留源碼私有性（memory `project_closed_source_paddle.md`）。Mirror 是折衷方案。

---

## 🆘 狀況處理

### 「我不小心指到 `boy1690/Keeply`，已 deploy 了」
1. 立刻在 keeply-website repo 手動 find-replace
2. push → Pages deploy
3. 寫 PR comment 說明修正
4. 無痕視窗 double-check live 狀態
5. 記錄進下一個 release cycle learning

### 「新增語言 locale，需要新的 index.html」
1. 從 `_dev/templates/index.html` 複製（已遵守 policy）
2. 翻譯 data-i18n 對應的 JSON
3. 不要動 download-btn 的 href
4. PR 前自檢 grep

### 「我是外部貢獻者 / 設計師 / 新同事」
先讀這份 policy + 上方 brief。有任何疑問**不要猜**，在 issue 或 PR 留言問——寧可慢幾分鐘問，不要 production bug。

---

*Policy v1.0 · 2026-04-18 · Maintained by whoever owns keeply-website at the time*
