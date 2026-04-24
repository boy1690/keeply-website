# Email Security Setup Runbook — keeply.work (SPF / DKIM / DMARC)

> Spec 026 / audit #9 | 2026-04-23
>
> 把 `@keeply.work` 的 email 加上「數位簽章 + 寄件人白名單 + 偽冒拒收策略」，讓 Gmail / Outlook / Apple iCloud / Yahoo 等收件人能驗證信件是官方的；任何偽冒 `hello@keeply.work` 的釣魚信被收件方自動丟棄。
>
> **預估時間**：初次設定 30-45 分鐘；2-4 週觀察期；最終 `p=reject` 升級 5 分鐘。**不可一次做完**。

---

## ⚠️ 讀完再開始

| 風險 | 如何控制 |
|---|---|
| **SPF 寫錯 → 合法信被其他郵箱 reject** | Phase 1 用 `dmarcian SPF Surveyor` 先模擬、確認通過才貼 DNS |
| **DKIM selector 錯 → outbound 無簽章** | Phase 2 必須到 Zoho admin 複製**正確**的 selector + key，不能手打 |
| **DMARC `p=reject` 太急進 → Paddle 收據被 reject、客戶付完錢沒收據** | Phase 3 **必須先 `p=none` 監 2 週**，解讀 aggregate reports 再升級；**不可跳過** |
| **SPF 10 lookup 上限爆表** | Phase 1 檢查 lookup count；超標要用 SPF flattening |
| **DNS 改完要等傳播** | TXT 記錄 TTL 通常 1-4 小時；改後 2 小時內不急著測 |

**本 runbook 假設**：
- 你的 `@keeply.work` email 用 **Zoho Mail**（依 `/law/products/keeply/art-30-processing-records.md` 的 processor P-05）
- DNS 現在可能在 **registrar**（Namecheap / GoDaddy / Porkbun / Cloudflare Registrar）**或** **Cloudflare**（若 spec 022 已完成遷移）

**若 email provider 不是 Zoho**：Google Workspace / Proton / iCloud+ Custom Domain / Fastmail 等流程類似但 selector 取法、SPF include 值不同。告訴我換哪家我補一段。

---

## Phase 0 — 盤點誰從 `@keeply.work` 寄信（10 分鐘）

在加 SPF 之前必須知道**所有**會以 `@keeply.work` 為 sender 的服務，漏一個就會被 DMARC reject。

### 0.1 已知的 3 個 sender

經 Keeply app repo + website repo 盤點，`@keeply.work` 目前**有 3 個** sender：

| # | Sender address | Provider | 觸發情境 | 可見證據 |
|---|---|---|---|---|
| 1 | `hello@keeply.work` | **Zoho Mail** | 手動回客戶、support、refund | Zoho webmail、`/law` art-30 P-05 |
| 2 | `wei@keeply.work` | **Zoho Mail** | 法務 / DPO 聯絡（`/law` 指定）| 同上 |
| 3 | `noreply@keeply.work` | **Resend** | **Paddle webhook 付款成功後，cf-worker 自動 POST Resend API 送 license key email 給客戶** | `D:/tools/doing/Keeply/cf-worker/src/email.ts` |

**每一個都必須**在 SPF 授權 + DKIM 簽章 align，否則 DMARC 升 `p=reject` 後會擋到自家信。

**情境** 3（Resend）特別關鍵——這是 Founding Member 付 $599 後收到授權碼的唯一管道。一旦漏設，使用者付完錢收不到授權 = P0 incident + 退款潮。

### 0.2 Paddle 自己的收據 email（逐一確認）

- [ ] **Paddle 交易 email**：Paddle 會在付款成功後**也**寄一封自己的 receipt email 給客戶。這封的 `From:` 是 `@paddle.com`（預設）還是 `billing@keeply.work`（啟用 custom sender 才會）？
  - 登入 Paddle dashboard → Settings → Emails → Sender address
  - 若顯示 `From: @keeply.work`，**必加** Paddle 的 SPF include value（到 Paddle dashboard 或 `help.paddle.com` 查當下正確值）
  - 若顯示 `From: noreply@paddle.com` 或預設值——**不需加**（Paddle 用自己的 domain，與 `@keeply.work` SPF 無關）

### 0.3 其他可能

- [ ] **GitHub Release notification**：sender `noreply@github.com`（預設）——**通常不用處理**
- [ ] **Zoho Campaigns / Newsletter**：若用 Zoho Campaigns 發 newsletter，通常已涵蓋於 `include:zoho.com`——確認即可
- [ ] **其他** transactional（Mailgun / SendGrid / Postmark / Brevo）：若 Keeply 現階段未用，跳過

若你**不確定**，這個查法：去 Gmail / 自己任何一個收件匣搜尋 `from:*@keeply.work`，看過去一年收到的信 `From` 顯示什麼、`Show original` 裡的 `Received:` header 哪些 IP 送的。

---

## Phase 1 — SPF (Sender Policy Framework) — 20 分鐘

SPF 是 DNS 裡的白名單：「**只有這些 IP / 這些 include 的服務**可以合法以 `@keeply.work` 寄信。」收件方檢查後若不符，DKIM align 失敗後，DMARC policy 決定如何處理。

### 1.1 建立 SPF record 字串

**Keeply baseline**（Zoho + Resend，涵蓋 Phase 0.1 的 3 個 sender）：

```text
v=spf1 include:zoho.com include:_spf.resend.com ~all
```

⚠️ **`_spf.resend.com` 是 Resend 官方在 2026 的 include value**；**務必**在 Resend dashboard 確認當下值：

1. 登入 `https://resend.com/domains`
2. 點 `keeply.work`
3. 頁面 **DNS Records** 區塊會列出 Resend 要求的 SPF、DKIM、return-path 三類 record
4. 其中標記 type = `TXT` + name = `keeply.work` (root) 的那條就是 SPF include 值——以它為準

**若 Paddle 確認從 `@keeply.work` 寄**（Phase 0.2 勾選）：

```text
v=spf1 include:zoho.com include:_spf.resend.com include:_spf.paddle.com ~all
```

（Paddle 官方的 include value 請在 Paddle dashboard 或 `help.paddle.com` 查最新。）

**約定細節**：

- `v=spf1` — SPF 版本
- `include:zoho.com` — 授權所有 Zoho 的寄件 IP（for hello@ / wei@）
- `include:_spf.resend.com` — 授權 Resend 的寄件 IP（for noreply@ via cf-worker）
- `~all` —「soft fail」：不符者標記 softfail，收件方通常會降低 reputation 但不直接丟。**初期先用這個**，穩定後可升級 `-all`（hard fail，直接 reject）
- **不要**用 `+all`——那代表任何人可冒名，比沒設還糟

### 1.2 檢查 SPF 10 lookup 上限

**關鍵測試**：每個 `include:` / `redirect:` / `a` / `mx` 都算一次 DNS 查詢，總和 ≤ 10。

去 `https://dmarcian.com/spf-survey/?domain=keeply.work`（或 `https://www.kitterman.com/spf/validate.html`）輸入你要貼的 SPF 字串，看 lookup count。

- 1-7 次：安全
- 8-10 次：邊界；謹慎加 include
- 11+：**必須 flatten**（把某些 include 的 IP 展開寫死進 SPF）——工具 `https://dmarcian.com/spf-flattener/`

### 1.3 加進 DNS

#### 1.3.A — 若 DNS 在 Cloudflare（spec 022 已完成遷移）

1. Cloudflare dashboard → `keeply.work` → **DNS** → **Records**
2. **Add record**:
   - Type: `TXT`
   - Name: `@`（代表 apex keeply.work）
   - Content: `v=spf1 include:zoho.com ~all`（或含 Paddle 的版本）
   - TTL: `Auto`
   - Proxy: **灰色 DNS only**（TXT records 不能 proxy）
3. Save

#### 1.3.B — 若 DNS 還在 registrar

**Namecheap**：Domain List → Manage → Advanced DNS → Add New Record → Type: `TXT Record` / Host: `@` / Value: 上面的 SPF 字串 / TTL: Automatic → Save

**GoDaddy**：My Products → DNS → Add → Type: TXT / Name: `@` / Value: SPF 字串 / TTL: 1 hour → Save

**Cloudflare Registrar**：同 1.3.A（Registrar 自動連動 DNS dashboard）

**Porkbun**：Domain Management → Details → DNS Records → Add → Type: TXT / Host: 空（代表 apex）/ Answer: SPF 字串 → Submit

### 1.4 驗證 SPF

等 10 分鐘讓 DNS 傳播，然後：

```
nslookup -type=TXT keeply.work
```

應該回：`"v=spf1 include:zoho.com ~all"`

或直接用線上工具：`https://mxtoolbox.com/SuperTool.aspx?action=spf%3Akeeply.work`——綠燈代表 OK。

---

## Phase 2 — DKIM (DomainKeys Identified Mail) — 15 分鐘

DKIM 給每封信加上密碼學簽章，收件方用 DNS 裡的 public key 驗證「這封信真的是 keeply.work 寄的、內容沒被改過」。

### 2.1 在 Zoho 啟用 DKIM

1. 登入 Zoho Mail Admin Console：`https://mailadmin.zoho.com/`
2. 左側 **Domains** → 點 `keeply.work`
3. 分頁 **Email Authentication** → **DKIM**
4. 若未啟用，點 **Add** / **Configure**
5. Zoho 會給你**兩個欄位**：
   - **Selector**（例如：`zoho._domainkey` 或 `zmail._domainkey`——每家 Zoho tenant 不同）
   - **TXT Record Value**（一長串 `v=DKIM1; k=rsa; p=<public key base64>`）
6. **複製**這兩個值到文字檔備用
7. **先不要關 Zoho 頁面**——加完 DNS 後要回來點「Verify」

### 2.2 把 DKIM 記錄加進 DNS

#### 2.2.A — Cloudflare

1. Cloudflare DNS → Add record
2. Type: `TXT`
3. Name: 貼 Zoho 給的 Selector（完整的 `zoho._domainkey` 或類似）
4. Content: 貼 Zoho 給的 `v=DKIM1; ...` 整串
5. TTL: Auto / Proxy: DNS only
6. Save

#### 2.2.B — Registrar

同 Phase 1.3.B 各家的 TXT record 流程，只是 Host/Name 填 `zoho._domainkey`、Value 填 Zoho 給的整串。

### 2.3 回 Zoho 驗證

1. 回剛才的 Zoho Admin Console 頁面（2.1 步驟 7 留著的）
2. 點 **Verify**
3. Zoho 會去查 DNS——成功後顯示綠勾勾「Verified」
4. 若失敗：
   - 等 15-30 分鐘讓 DNS 傳播再 Verify
   - 確認 selector name 沒打錯（Cloudflare 預設會加 `.keeply.work` 後綴，你只要填 `zoho._domainkey`）

### 2.4 驗證 DKIM (Zoho)

發一封測試信到你自己的 Gmail：

1. 從 Zoho webmail 寄 `hello@keeply.work` → `<你的gmail>@gmail.com`
2. Gmail 收件匣打開 → 右上角選單 **Show original**
3. 頂部應看到 `DKIM: PASS with domain keeply.work`

或用 `https://mxtoolbox.com/SuperTool.aspx?action=dkim%3Akeeply.work%3Azoho`（把 `zoho` 換成你的 selector）。

---

### 2b Resend DKIM（for `noreply@keeply.work`）— 必做

⚠️ **這一整段是 spec 027 新增**。Resend 從 `noreply@keeply.work` 發 license email（Paddle webhook → cf-worker 後觸發），如果沒設 Resend DKIM，DMARC 升 `p=reject` 後這條路會斷，客戶付完錢收不到授權碼。

#### 2b.1 檢查 Resend domain 現有狀態

1. 登入 `https://resend.com/domains`
2. 找 `keeply.work`（若沒有，先 **Add Domain**）
3. 看 **Status** 欄位：
   - **Verified**（綠色勾勾）→ DKIM records 已在 DNS，**跳到 2b.3 驗證**
   - **Pending / Failed** → 繼續 2b.2 設定

#### 2b.2 加 Resend DKIM records 進 DNS

Resend domain 頁面的 **DNS Records** 會列出**多條**要加的 records，典型包含：

| Type | Host/Name | Value | 用途 |
|---|---|---|---|
| `MX` | `send.keeply.work` | `10 feedback-smtp.<region>.amazonses.com` | Return-path（SES bounce/complaint 路由）|
| `TXT` | `send.keeply.work` | `v=spf1 include:amazonses.com ~all` | Return-path SPF |
| `TXT` | `resend._domainkey.keeply.work` | `p=<public key>` (very long) | **DKIM public key** |

**把 Resend dashboard 給的每一條** 貼進 Cloudflare DNS（或 registrar）——複製時小心**完整字串**不要截斷（DKIM public key 通常超過 400 字元，DNS TXT 單行上限 255，大部分 registrar UI 會自動處理分段，Cloudflare 自動處理）。

加完後回 Resend dashboard 按 **Verify DNS Records**。

**狀態變 Verified = 成功**（通常 1-30 分鐘內；DNS TTL 長的話最多幾小時）。

#### 2b.3 實測 Resend DKIM

理論上可以從 Resend dashboard 發一封測試信，但最可靠是走**真實的 Paddle webhook**：

- 用 Paddle sandbox 做一次測試交易（測試卡號 `4242 4242 4242 4242`）
- 觸發 cf-worker 發 license email 到你自己的 Gmail
- Gmail 打開 license email → **Show original**
- 應看到：
  - `SPF: PASS with IP <amazonses IP>`
  - `DKIM: PASS with domain keeply.work (s=resend)`
  - `DMARC: PASS`

若 DKIM fail，通常是：
- DNS 還沒傳播（等 1 小時再試）
- TXT record 貼漏字或被 registrar 把 `;` 改成 `\;`——用 `dig TXT resend._domainkey.keeply.work` 比對實際值
- Resend dashboard 未按 Verify（靜默狀態）

#### 2b.4 注意：不需要 `From:` 另設 DKIM selector

Zoho 用一個 selector（例如 `zoho._domainkey`）、Resend 用另一個（`resend._domainkey`）——兩個 DKIM selector 可**共存**於同一個 domain，彼此不干擾。每封信只會用自己 provider 的 selector 簽章、DMARC 檢查時只要其中一個 align 就 pass。

---

## Phase 3 — DMARC (Domain-based Message Authentication) — 分階段，4-6 週

DMARC 是**策略層**：告訴收件方「看到信的 SPF/DKIM align fail 要怎麼辦」。

### 3.1 Phase 3a — 監測模式 `p=none`（Week 1-2）

**絕對不可跳過這階段**——你要**先收 2 週 aggregate reports**，看誰在冒名 / 誰在 SPF fail，**再**決定是否升級。

加 DMARC TXT record：

| 欄位 | 值 |
|---|---|
| Type | `TXT` |
| Name | `_dmarc`（不是 `@`，是子網域）|
| Content | `v=DMARC1; p=none; rua=mailto:dmarc-reports@keeply.work; ruf=mailto:dmarc-reports@keeply.work; pct=100; aspf=r; adkim=r` |

- `p=none`：不動任何信，只「**報告**」
- `rua=mailto:...`：**每日匯總報告**寄到這個 email（XML 格式，工具會解析）
- `ruf=mailto:...`：**失敗個案**寄到這個 email（選用，可省，量會多）
- `pct=100`：100% 套用
- `aspf=r`、`adkim=r`：relaxed alignment（subdomain 也算；大多數合法來源需要）

### 3.2 設定 `dmarc-reports@keeply.work` 收報告

**選項 A — 自己收**：
1. Zoho admin → 建 `dmarc-reports` alias，轉寄到 `wei@keeply.work`
2. 用 XML 解析工具讀：`https://dmarcian.com/dmarc-xml-viewer/`（貼 XML 給它解析）

**選項 B — 用免費 DMARC 解析服務**（推薦——人類可讀、異常警示）：
1. 到 `https://postmarkapp.com/free-dmarc-monitoring` 或 `https://www.easydmarc.com/dmarc-monitoring/free/`
2. 註冊後他們會給你一個地址，例如 `keeply.work@dmarc.postmarkapp.com`
3. 把 DMARC 的 `rua=mailto:...` 值換成這地址
4. 他們做 dashboard 給你看（每個 source、每個 IP、每天）

### 3.3 Phase 3b — 分析報告（Week 1-2）

讀 2 週後的報告，你會看到每個 sending source 和他們的 SPF/DKIM pass/fail 情形，例如：

```
zoho.com     |  1234 msgs | SPF=pass | DKIM=pass  ← OK
paddle.com   |    48 msgs | SPF=fail | DKIM=pass  ← alignment issue！
unknown IP   |     7 msgs | SPF=fail | DKIM=fail  ← 冒名或未授權工具
```

**動作**：
- 所有**合法** sender 必須顯示 SPF=pass 或 DKIM=pass（至少一個）——否則上 `p=quarantine/reject` 會 reject 掉他們
- Paddle SPF fail？回 Phase 1 加 `include:_spf.paddle.com` 到 SPF
- 有未知 IP？可能是冒名攻擊者——放著被擋即可（這就是 DMARC 的價值）

### 3.4 Phase 3c — 升級到 `p=quarantine`（Week 3-4）

當所有合法 sender 都 align 後，改 DMARC TXT record：

```
v=DMARC1; p=quarantine; rua=mailto:...; ruf=mailto:...; pct=25; aspf=r; adkim=r
```

**注意 `pct=25`**：先對 25% 流量套用 quarantine，75% 仍 `p=none`——漸進。觀察 1 週無異狀，升 `pct=50` → `pct=100`。

`p=quarantine` 的效果：冒名信**進垃圾信夾**，而不是收件匣。

### 3.5 Phase 3d — 升級到 `p=reject`（Week 5-6+）

**最強保護**，但也最容易誤傷合法信。只有在 `p=quarantine; pct=100` 穩定 2 週、aggregate report 顯示 0 合法 sender fail 才升：

```
v=DMARC1; p=reject; rua=mailto:...; pct=100; aspf=s; adkim=s
```

- `p=reject`：冒名信直接拒收，不進垃圾信夾
- `aspf=s; adkim=s`：strict alignment——更嚴格，exactly 子網域匹配

**這不是不可逆**——發現問題可回 `p=quarantine` 或 `p=none`。但合法寄件量會在 reject 生效那一刻突然消失，所以務必先穩定再升。

---

## Phase 4 — 綜合驗證

**工具**：

1. `https://mxtoolbox.com/SuperTool.aspx?action=spf%3Akeeply.work` → 綠燈
2. `https://mxtoolbox.com/SuperTool.aspx?action=dmarc%3Akeeply.work` → 綠燈
3. `https://mxtoolbox.com/SuperTool.aspx?action=dkim%3Akeeply.work%3Azoho` → 綠燈
4. `https://www.mail-tester.com/` → 發一封信到他們給的地址，回 10/10 滿分
5. `https://www.dmarcanalyzer.com/dmarc/dmarc-record-check/` → 詳細 DMARC 解讀
6. **Google Postmaster Tools**（`https://postmaster.google.com/`）→ 加 keeply.work → 24 小時後看 Authentication / Reputation / Spam rate

**實測偽冒**（可選、證明 policy 生效）：

1. 從一台 VPS 用 `sendmail` 或 Python `smtplib`，設 `From: hello@keeply.work`、寄到你自己的 Gmail
2. 收件 → Show original：
   - 若在 `p=none` 階段：`DMARC: FAIL`，但信仍進收件匣（只是標 fail）
   - `p=quarantine`：信進垃圾信夾
   - `p=reject`：**Gmail 直接拒收**，你的 VPS 的 sendmail 收到 bounce

---

## Phase 5 — 維運與警示

### 5.1 何時需要改 SPF

- 新增 email 發送服務（改用 Google Workspace、加 Mailgun transactional 等）→ 加對應 `include:`
- 廢棄舊服務 → 移除 include，保持 lookup count 低

### 5.2 何時需要 rotate DKIM key

業界建議**每年換一次** DKIM key：
1. Zoho admin 產生新 key（Zoho 通常提供 "generate new key" 按鈕）
2. 拿到新 selector 和 value（**保留舊的 selector** 不刪）
3. DNS 加**新的** TXT record（例如 `zoho2._domainkey`）
4. 等 48 小時讓新 key 傳播
5. Zoho admin 切換到新 selector 為 active
6. 等 14 天——確認沒任何歷史 queue 還在用舊 selector
7. DNS 刪掉**舊**的 `zoho._domainkey` TXT record

### 5.3 DMARC reports 如何持續讀

- EasyDMARC / Postmark 的免費 plan 通常 dashboard 保 30-90 天數據
- 每月快速看一次：
  - 是否有新的冒名嘗試？（有就記一下 IP / 時間，威脅情報）
  - 是否有自己啟用的新服務 fail 在那邊？（要補 SPF 或 DKIM）

---

## Rollback 手冊

### R-1 上 `p=reject` 後某個合法 sender 被 reject、業務斷線

**立刻**把 DMARC 改回 `p=quarantine; pct=25`（最寬鬆有保護的策略）或 `p=none`：
1. DNS 更新 `_dmarc` TXT record value
2. DNS TTL 過期（通常 1-4 小時）後生效
3. 同時回 Phase 3 aggregate report 查被誤傷的 sender，補 SPF 或協調該 sender 配 DKIM

### R-2 SPF 設錯導致自家發信被 reject

**立刻**改 DNS——把 `~all` 改成 `?all`（neutral）或直接刪除整個 SPF TXT record：
1. `?all` 代表「不表示立場」——收件方通常放行，reputation 降
2. 刪除整個 SPF 可**快速**搶救，但保留更多被冒名空間
3. 查為什麼錯、重設正確版本

### R-3 DKIM 簽章失效（key rotation 中斷）

DKIM fail 不會導致信被 reject（除非 DMARC 嚴格）——只會降 reputation：
1. 讓 DMARC 退到 `p=none`
2. Zoho admin 重新啟用 DKIM、拿新 selector + key
3. 加新 TXT record、驗證、升 DMARC 回去

---

## Checklist

```
Phase 0
[ ] 0.1 盤點完 sender：Zoho ✓
[ ] 0.2 確認 Paddle 是否從 @keeply.work 寄
[ ] 0.2 確認無其他 transactional email 服務

Phase 1 — SPF
[ ] 1.1 設計 SPF 字串
[ ] 1.2 dmarcian SPF Surveyor 驗證 lookup count <= 10
[ ] 1.3 加進 DNS (Cloudflare / registrar)
[ ] 1.4 mxtoolbox SPF check 綠燈

Phase 2 — DKIM
[ ] 2.1 Zoho admin 啟用 DKIM、取得 selector + key
[ ] 2.2 加進 DNS
[ ] 2.3 Zoho admin 點 Verify 成功
[ ] 2.4 實測寄到 Gmail → DKIM: PASS

Phase 3 — DMARC
[ ] 3.1 加 DMARC p=none record
[ ] 3.2 設定 dmarc-reports 收件地（自己 alias 或 Postmark/EasyDMARC）
[ ] 3.3 Week 1-2：收、讀 aggregate reports
[ ] 3.3 所有合法 sender 都 align ✓
[ ] 3.4 升級 p=quarantine; pct=25
[ ] 3.4 pct=25 → 50 → 100 逐週升
[ ] 3.5 升級 p=reject; pct=100

Phase 4 — 驗證
[ ] mxtoolbox SPF / DKIM / DMARC 三個綠燈
[ ] mail-tester.com 10/10
[ ] Google Postmaster Tools 顯示 PASS
[ ] 偽冒測試：VPS 用 From: hello@keeply.work 寄到 gmail → 被擋

Phase 5 — 維運
[ ] Calendar: 每月看一次 DMARC report
[ ] Calendar: 1 年後 rotate DKIM key
```

---

## FAQ

**Q：Paddle 不是用他們自己 `@paddle.com` 寄收據嗎？**
A：**預設是**。但 Paddle 提供「Send from your own domain」進階選項（Settings → Emails）。若你沒啟用此選項，SPF 不用加 Paddle。實際以 Paddle dashboard 為準。

**Q：`p=reject` 會不會讓正常的使用者回信也被當垃圾？**
A：**不會**。DMARC 檢查的是「這封信聲稱從 keeply.work 來是不是真的」，你的客戶從 gmail / outlook 寄給你的信 `From:` 是他們自己網域——跟你的 DMARC 無關。只有信 `From: *@keeply.work` 會被檢查。

**Q：為什麼 `~all` 而不是 `-all`？**
A：`~all`（soft fail）對未來加 sender 容錯；`-all`（hard fail）更嚴格但穩定後才上。DMARC 的 `p=reject` 效果已經比 SPF `-all` 強，所以大多數 guide 建議 `~all` + `p=reject` 組合。

**Q：DKIM key 被盜了怎麼辦？**
A：立刻到 Zoho 作廢現有 key、產生新的；同時 DNS 先留舊的不動（等 48-72 小時讓正常 queue 消化完）、再刪。若需要當天撤銷，可把舊 DKIM TXT 改成空或假值，被盜 key 簽的信立刻失效但自家信也會失效——通常影響可接受。

---

*Spec 026 Email Security Runbook v1.0 | 2026-04-23*
