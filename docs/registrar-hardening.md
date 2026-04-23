# Registrar Account Hardening Checklist — keeply.work (audit #16)

> 2026-04-23 | 5 分鐘任務
>
> 網域 `keeply.work` 的 registrar 帳號被盜 = 攻擊者可直接**偷走整個網域**（改 nameservers、改 WHOIS、轉移到其他 registrar）。2FA + registrar lock 是最小防線。

---

## 你要做的 4 件事

1. **啟用 2FA**（必做）——用 authenticator app，不要用 SMS
2. **啟用 registrar lock**（必做）——防止非授權 domain transfer
3. **啟用 auto-renewal**（推薦）——防止忘記續約 domain 過期被搶註
4. **啟用 WHOIS privacy**（推薦）——隱藏個資，減少垃圾郵件與社交工程

---

## 依 registrar 對照

### A — Namecheap

| 項目 | 路徑 |
|---|---|
| 2FA | Profile → Account Security → **Two-Factor Authentication** → Enable → 選 **Authenticator App**（Google Authenticator / Authy / 1Password 都可）→ 掃 QR → 輸一次 OTP → Save **backup codes 離線存下** |
| Registrar lock | Domain List → `keeply.work` → **Manage** → **Sharing & Transfer** → **Transfer lock: ON** |
| Auto-renew | Domain List → `keeply.work` → Manage → **Auto-Renew: ON** |
| WHOIS privacy | Domain List → `keeply.work` → Manage → **WhoisGuard / Domain Privacy: ON**（Namecheap 免費）|

### B — GoDaddy

| 項目 | 路徑 |
|---|---|
| 2FA | 右上角大頭貼 → **Account Settings** → **Login & PIN** → **2-step verification** → 選 **Authenticator App** → Setup |
| Registrar lock | My Products → `keeply.work` → **Domain Settings** → **Additional Settings** → **Lock: ON** |
| Auto-renew | My Products → `keeply.work` → **Auto-renew: ON**（預設通常開著）|
| WHOIS privacy | My Products → `keeply.work` → **Domain Privacy** → **Manage**（GoDaddy 通常要付費；若已是 Full Privacy 就 OK）|

### C — Cloudflare Registrar

| 項目 | 路徑 |
|---|---|
| 2FA | 右上角大頭貼 → **My Profile** → **Authentication** → **Two-Factor Authentication** → Add → 選 **Authenticator App** → 設定 + 存 backup codes |
| Registrar lock | 左側 **Registrar** → `keeply.work` → **Configuration** → **Transfer Lock: ON**（Cloudflare 預設就開） |
| Auto-renew | Registrar → `keeply.work` → **Auto Renew: ON** |
| WHOIS privacy | Cloudflare **預設免費**全開，不用另設 |

### D — Porkbun

| 項目 | 路徑 |
|---|---|
| 2FA | Account → **Account Security** → **Two-Factor Authentication** → 選 Authenticator App → Enable |
| Registrar lock | Domain Management → `keeply.work` → **Details** → **Domain Lock: ON** |
| Auto-renew | Domain Management → `keeply.work` → Details → **Auto-Renewal: ON** |
| WHOIS privacy | Porkbun **預設免費**全開，不用另設 |

### E — 其他 registrar

通用流程（術語可能略有不同）：

1. 帳號設定 / Security 分頁找 **Two-Factor** / **Multi-Factor** / **2-Step**
2. Domain 管理頁找 **Transfer Lock** / **Domain Lock** / **Registrar Lock**（**非**「DNSSEC Lock」）
3. 續約設定找 **Auto-Renew**
4. 隱私設定找 **WHOIS Privacy** / **Domain Privacy** / **Private Registration**

---

## 驗證完成

1. **2FA 測試**：登出 → 重新登入 → 應該被要求輸 OTP 碼（不是沒要你輸 = 沒生效）
2. **Registrar lock 驗證**：
   - Namecheap / GoDaddy：Domain 管理頁看到 lock icon 綠燈 / Status: Locked
   - Cloudflare：Registrar 頁面 Transfer Lock = ON
   - Porkbun：Domain Lock 狀態為 Locked
3. **公開 whois 查**：`https://who.is/whois/keeply.work` 看 Status 欄位應含 `clientTransferProhibited`（= registrar lock 生效）；Registrant 資訊應為隱私代管（不是你的真實姓名地址，除非你刻意不開隱私）

---

## ⚠️ Backup Codes 的極重要性

2FA enable 時 registrar 一定會給你 10 組**一次性 backup codes**。這些是你**手機遺失 / authenticator app 爆炸**時的唯一救生索——否則你要經過客服 identity verification 才能拿回帳號（可能花 1-2 週、需要護照照片）。

存在：
- 1Password / Bitwarden 密碼管理器裡
- 也印一份紙本存實體保險箱或抽屜（不要存電腦硬碟唯一副本 — 硬碟壞就完了）

---

## 一次性 checklist

```
[ ] Namecheap / GoDaddy / Cloudflare / Porkbun 或其他：你的 registrar 是 ________
[ ] 2FA enabled（authenticator app，不是 SMS）
[ ] 10 組 backup codes 存在 1Password + 實體副本
[ ] Registrar lock / Transfer lock = ON
[ ] Auto-renewal = ON
[ ] WHOIS privacy = ON（若免費則開；付費則評估）
[ ] 登出登入測試 2FA 真的生效
[ ] who.is 查 keeply.work 確認 clientTransferProhibited
```

---

## 常見陷阱

- **不要用 SMS 2FA**：SIM swap 攻擊可繞過，authenticator app 安全得多
- **不要在 2FA enable 後弄丟 backup codes**：帳號救援程序極痛
- **Cloudflare Registrar 已經 default 做了多數項**：若你的 domain 在這，只剩 2FA 要開
- **WHOIS privacy 不等於 domain transfer lock**：兩件事獨立，都要 ON

---

*Spec for audit item #16 — no full /web flow needed, pure ops checklist | 2026-04-23*
