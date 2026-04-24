# Cloudflare Setup Runbook — keeply.work Security Headers

> Spec 022 / audit #8 + #11 | 2026-04-23
>
> 這份文件帶你一步一步把 `keeply.work` 放到 Cloudflare 後面，補齊 GitHub Pages 送不出的 HTTP security headers（HSTS、frame-ancestors、Permissions-Policy 等）。**所有步驟預估 30-60 分鐘**（DNS 傳播可能要等，可離開去做其他事）。
>
> **重要**：如果你看不懂某一步，**停下來問**，不要猜——這些步驟涉及 DNS，做錯可能讓 `keeply.work` 幾小時連不上。

---

## ⚠️ 讀完再開始

| 風險 | 如何控制 |
|---|---|
| **DNS migration 失敗** → 網站暫時連不上 | 所有步驟在**下班前別開始**；選**週末早上**執行，傳播慢可等一整天 |
| **TLS mode 誤設成 Flexible** → 中間人可攻擊 | Phase 4 明確設成 **Full (strict)**，不要選其他 |
| **HSTS preload 不可逆** | Phase 7 分階段：`max-age=600` → 24h → 1 年；Phase 8 submit 是**最後**動作，無法反悔 |
| **既有 meta CSP 被覆蓋** | Cloudflare 層 CSP 與 meta CSP 共存；兩邊設定必須**一致**（已在 worker.js 同步） |

若你任何一步卡住，最快速的 rollback 是：**Cloudflare DNS 頁面把 orange cloud 點成 grey cloud**（關掉 proxy），網站立刻變回直連 GitHub Pages。不用改 registrar，不會 down。

---

## Phase 0 — Pre-flight 準備（5 分鐘）

**打開這些分頁備用：**
1. `https://dash.cloudflare.com/sign-up`（若還沒帳號）
2. 你的 domain registrar 後台（`keeply.work` 目前是在哪家？看下方 Phase 2 對應說明）
3. `https://securityheaders.com/?q=https%3A%2F%2Fkeeply.work%2F&hide=on&followRedirects=on`（baseline：先截圖現在的 F 評級，之後對比）
4. `https://observatory.mozilla.org/analyze/keeply.work`（baseline：Mozilla 觀測評分）

**把 baseline 截圖存好**——之後用來證明「從 F → A+」。

---

## Phase 1 — 註冊 Cloudflare 並加入 keeply.work（10 分鐘）

### 1.1 登入 / 註冊帳號

> 📌 **你已經有 Cloudflare 帳號**——跑 `keeply-billing` Worker（Paddle webhook → Keygen → Resend 金流橋）的那個。**直接登入同一個帳號即可**，不要開新的。跨帳號管理很麻煩。
>
> 證據：`D:/tools/doing/Keeply/cf-worker/wrangler.toml` 的 `account_id` 指向這個帳號，它跑著 `keeply-billing` Worker 在 `*.workers.dev` subdomain。**`keeply.work` zone 尚未加進這個帳號**（Worker 不用 custom domain），所以 Phase 1.2 Add Site 仍要做。

**登入（已有帳號）**：

1. 開 `https://dash.cloudflare.com/login`
2. email + 密碼（+ 2FA，應該已設）→ 進 Dashboard
3. 登入後會看到左側 **Workers & Pages** 下方有 `keeply-billing` Worker 在跑——對，就是這個帳號

**若 somehow 你真的沒有帳號**（不太可能，但以防萬一）：

1. 開 `https://dash.cloudflare.com/sign-up`
2. email + 密碼 → 驗證 email
3. 登入後進 Dashboard

### 1.2 Add a Site

1. 點右上角 **"Add a Site"**（或 Dashboard 首頁的大按鈕）
2. 輸入 `keeply.work` → Continue
3. **選 Free plan**（每月 $0，是本 spec 需要的一切）→ Continue
4. Cloudflare 會**自動爬**你 domain 現有的 DNS 記錄。出現畫面列出所有 `A` / `CNAME` / `MX` 等記錄。
5. **重要檢查**：
   - 應該有一個 `A` 或 `CNAME` 記錄指向 GitHub Pages（例如 `boy1690.github.io` 或 IP `185.199.108.153` 之類）
   - 這個記錄旁邊應該是**橘色雲朵**（Proxied 狀態）——這是我們要的
   - 如果某些記錄你不認得（例如 email 相關的 MX、TXT 記錄），**先不要動**，保留原樣
6. 點 Continue

### 1.3 拿到 Nameservers

Cloudflare 會顯示**兩組 nameserver**，類似：

```
ada.ns.cloudflare.com
todd.ns.cloudflare.com
```

（每個人的名字不同，Cloudflare 會隨機分配）

**把這兩行複製到文字檔備用**——下一步要貼進 registrar。

---

## Phase 2 — 到 Registrar 改 Nameservers（5 分鐘 + 等 DNS）

### ⚠️ 這一步會讓 DNS 切換到 Cloudflare 管理

找你的 registrar 對應段照做：

### 2.A — Namecheap

1. 登入 `https://www.namecheap.com/`
2. Account → Domain List → `keeply.work` 旁邊 **Manage**
3. Nameservers 區塊 → 下拉選 **Custom DNS**
4. 把 Cloudflare 給的兩個 nameservers 貼進去（第一行 `ada.ns...`、第二行 `todd.ns...`）
5. 右邊的綠色勾勾 → 儲存
6. 通知你：「propagation may take up to 48 hours」— 實際通常 5-60 分鐘

### 2.B — GoDaddy

1. 登入 `https://account.godaddy.com/products`
2. 找 `keeply.work` → 右邊 **DNS** 按鈕
3. 頁面滑到最下方 **Nameservers** 區塊 → **Change**
4. 選 **I'll use my own nameservers** → 貼入 Cloudflare 的兩個
5. Save
6. GoDaddy 可能要你再次確認 email

### 2.C — Cloudflare Registrar（你的 domain 已經在 Cloudflare）

你應該**不會**到這步——如果 domain 本來就在 Cloudflare Registrar，Phase 1.2 的 DNS 爬取就會直接連動 nameserver，不用另改。直接跳 Phase 3。

### 2.D — Porkbun

1. 登入 `https://porkbun.com/account/domainsSpeedy`
2. `keeply.work` → **Details** → 找 **Authoritative Nameservers**
3. 點 **Edit** → 清空既有 → 貼兩個 Cloudflare nameservers
4. Submit

### 2.E — 其他 registrar

通用流程：「**找 Nameservers 或 DNS 設定 → 改成 Custom / Private nameservers → 貼 Cloudflare 兩個值**」。如果找不到，Google「`<你的 registrar>` change nameservers」。

### 2.F — 我忘記 domain 是在哪家 registrar 了

在 PowerShell / Terminal 跑：

```
whois keeply.work | findstr "Registrar:"
```

或在瀏覽器打 `https://who.is/whois/keeply.work`，找 **Registrar** 欄位。

---

## Phase 3 — 等 DNS 傳播（5 分鐘到幾小時）

### 3.1 等

回到 Cloudflare dashboard → `keeply.work` 的 overview 頁面。

- 狀態一開始是「**Pending Nameserver Update**」
- 每 5 分鐘自己刷一次
- 等到看到「**Active**」綠色——恭喜，Cloudflare 已接管 DNS

通常 10-30 分鐘，最慢 48 小時。實務上很少超過 1 小時。

### 3.2 驗證

在 PowerShell / Terminal：

```
nslookup keeply.work
```

回應裡應該看到 Cloudflare 的 IP（例如 `104.21.x.x` 或 `172.67.x.x`，不再是 GitHub Pages 的 `185.199.x.x`）。

另一個檢查：

```
curl -I https://keeply.work/
```

response headers 應該含：
```
cf-ray: xxxxxxxxx
server: cloudflare
```

看到 `cf-ray` 就代表**請求經過 Cloudflare**——接下來的 headers 我們才改得到。

---

## Phase 4 — 設定 SSL/TLS（3 分鐘）

### ⚠️ 這步**極重要**。設錯會被中間人攻擊。

1. Cloudflare dashboard → `keeply.work` → 左側選單 **SSL/TLS**
2. **Overview** 頁面 → **SSL/TLS encryption mode**
3. **必須選 "Full (strict)"**
   - ✅ Full (strict) ← **選這個**
   - ❌ Flexible ← **不要選**（會讓 Cloudflare → GitHub Pages 走 HTTP，被中間人）
   - ❌ Off ← 不要選
   - ⚠️ Full ← 不建議（不驗證 origin cert）
4. 點 Save

**為什麼 Full (strict) 安全**：Cloudflare → GitHub Pages 之間走 HTTPS 並驗證 GitHub Pages 的證書；visitor → Cloudflare 走 HTTPS；全程加密。

GitHub Pages 本身有合法 cert（Let's Encrypt 自動），所以 Full (strict) 不會壞。

---

## Phase 4.5 — DNSSEC（audit #15，5 分鐘 + 5 分鐘在 registrar）

### 這步做什麼

DNSSEC 用密碼學簽章保護 DNS 查詢——防止中間人「你輸入 keeply.work，實際被導向攻擊者 IP」這類 DNS cache poisoning / spoofing 攻擊。沒有 DNSSEC 的 domain 像是沒貼郵票的信件——收件者無法確認寄件來源。

### 為什麼 Cloudflare 讓這變簡單

在 Cloudflare 之外手動做 DNSSEC 很痛（要自己管 KSK/ZSK、rotate keys、簽 zone file）。Cloudflare **一鍵幫你生 key、自動 rotate、自動 resign**——你只需要在 registrar 貼一條 DS record。

### 4.5.1 在 Cloudflare 啟用 DNSSEC

1. Cloudflare dashboard → `keeply.work` → 左側 **DNS** → **Settings**
2. 找 **DNSSEC** 區塊 → 點 **Enable DNSSEC**
3. 彈出框顯示一組 **DS Record** 值，像這樣：
   ```
   Algorithm:  13 (ECDSAP256SHA256)
   Digest Type: 2 (SHA-256)
   Digest:     (一長串 hex)
   Key Tag:    (4-5 位數字)
   Public Key: (一長串 base64)
   ```
4. **把這些值複製到文字檔備用**——下一步要貼到 registrar
5. **先不要關這個視窗**——Cloudflare 會持續顯示「Pending: waiting for DS record at registrar」

### 4.5.2 在 registrar 加 DS Record

這步**必須到 registrar 後台做**（不是 Cloudflare）。因為 DNSSEC trust chain 從 `.work` TLD → 你的 registrar → Cloudflare，根節點的 DS record 掛在 registrar 那邊。

#### 4.5.2.A — Namecheap

1. Domain List → `keeply.work` → Manage
2. Advanced DNS 頁籤 → 滑到 **DNSSEC** 區塊
3. **Add New Record**
4. 填入 Cloudflare 給的四個欄位（Key Tag / Algorithm 13 / Digest Type 2 / Digest）
5. Save

#### 4.5.2.B — GoDaddy

1. 登入 → My Products → `keeply.work` → **DNS**
2. 滑到最下 **DNSSEC** 區塊 → **Manage DS Records**（如果沒這個選項，GoDaddy 部分方案不支援 DNSSEC，要升級——少見）
3. **Add DS Record** → 貼 Cloudflare 四個值
4. Save

#### 4.5.2.C — Cloudflare Registrar

最簡單——在同一個 Cloudflare 介面：
1. Cloudflare dashboard → **Registrar**（左側選單）→ `keeply.work` → **Configuration**
2. DNSSEC 通常會**自動配**（同一家公司），你 4.5.1 Enable 後它自己生效
3. 若沒自動，按畫面指示手動 paste DS record

#### 4.5.2.D — Porkbun

1. Domain Management → `keeply.work` → Details
2. 找 **DNSSEC** 區塊 → **Add a DS Record**
3. 貼 Cloudflare 四個值 → Submit

### 4.5.3 等 DNSSEC 驗證

1. 回到 Cloudflare dashboard DNS → Settings → DNSSEC
2. 每 5 分鐘刷一下——從「Pending」變「**Active**」通常 5-30 分鐘，最慢 24 小時
3. 驗證：
   ```
   dig +dnssec keeply.work | findstr ad
   ```
   或去 `https://dnssec-analyzer.verisignlabs.com/keeply.work`——整條 trust chain 都綠燈才算成功

### 4.5.4 Rollback（萬一 DNSSEC 壞掉域名 resolve 不了）

**如果 DNSSEC 設錯 domain 會拒絕解析**（比 Cloudflare headers 還嚴重）。Rollback：

1. registrar 後台把 DS Record **刪除**（不是 Cloudflare 端，是 registrar）
2. 等 TTL 過期（通常幾小時）
3. DNS 回到無 DNSSEC 狀態，可正常解析
4. 回 Cloudflare dashboard 把 DNSSEC disable，重來一次

### ⚠️ DNSSEC 常見陷阱

- **DS record 的 "Digest" 欄位**：有些 registrar 要全小寫 hex、有些大寫——如果 Cloudflare 顯示「Pending」超過 1 小時，檢查大小寫是否被 registrar 改動
- **Algorithm 13 (ECDSAP256SHA256)**：現代標準，所有 registrar 都支援。若 registrar 只吃 Algorithm 8 (RSA)，代表你的 registrar 很舊，換別家
- **Transfer 到其他 registrar 前要先 disable DNSSEC**：否則新 registrar 無 DS record，網域停擺

---

## Phase 5 — 加入 Security Headers（選一條路）

### 🛣️ Path 1 — Transform Rules（**推薦**，免寫 code）

**優點**：全在 UI 點選、好 rollback、不需要理解 JS

1. Cloudflare dashboard → `keeply.work` → 左側 **Rules** → **Transform Rules**
2. 點 **Create rule** → **Modify Response Header**
3. **Rule name**: `Keeply Security Headers`
4. **When incoming requests match**:
   - Field: `Hostname`
   - Operator: `equals`
   - Value: `keeply.work`
   - （如果你也用 `www.keeply.work`，點 "Or" 再加一條 Hostname equals www.keeply.work）
5. **Then**: 逐一加下列 **Set static header**，每條一個：

| Header name | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=600; includeSubDomains` ⚠️ Phase 7 再延長 |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), autoplay=(), fullscreen=(self)` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' https://www.googletagmanager.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://www.google-analytics.com; font-src 'self'; connect-src 'self' https://docs.google.com https://*.google-analytics.com https://*.analytics.google.com https://cloudflareinsights.com; form-action 'self' https://docs.google.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |

6. **Deploy**
7. 驗證：`curl -I https://keeply.work/` → 應該看到上面所有 header。如果還沒看到，等 1-2 分鐘讓 CF edge 傳播。

### 🛣️ Path 2 — Cloudflare Worker（進階，**本 repo 已附代碼**）

**何時選 Path 2**：
- 未來要動態依請求加 nonce 到 CSP
- 要依 path / 語系 / user-agent 發不同 header
- 想記 CSP violation report

步驟：
1. Cloudflare dashboard → **Workers & Pages** → **Create application** → **Create Worker**
2. Worker name: `keeply-security-headers`
3. Deploy 預設範例先（隨便什麼都好）
4. 進 Worker → **Edit code**
5. 把整份 `cloudflare/worker.js`（本 repo）的內容貼進去、replace 預設 code
6. 點 **Save and Deploy**
7. 進 Worker → **Settings** → **Triggers** → **Add Custom Domain** → `keeply.work`（和 `www.keeply.work` 如果用）
8. 等 1 分鐘，`curl -I https://keeply.work/` 應該看到 `x-keeply-security: cloudflare-worker/spec-022` header（Worker 已生效）

---

## Phase 6 — 驗證（5 分鐘）

### 6.1 securityheaders.com

回到 Phase 0 的分頁 → 點 **Recan this site**

應該從 F → **A+**（或至少 A）。沒有到 A+ 代表某個 header 漏掉或值錯；對比 Phase 5 表格檢查。

### 6.2 Mozilla Observatory

回到 Phase 0 的分頁 → 點 **Rescan**

分數應該從 ~30 → **≥ 90**。

### 6.3 curl

```
curl -I https://keeply.work/
```

逐條核對 Phase 5 表格內所有 header 都在 response 裡。

### 6.4 功能迴歸測試

- 開 `https://keeply.work/en/` 看頁面渲染正常
- 展開 Spec 021 的 Verify download disclosure 看內容正常
- 點 Team notify 表單 submit 看 Google Forms 有收到（inline script 沒被 CSP 擋）
- DevTools Console **不應該有** CSP violation error（如果有，某個既有 inline 被擋，需調整 CSP `script-src`）

---

## Phase 7 — HSTS 分階段延長（選一週慢慢做，**不可跳過**）

**為什麼要分階段**：一旦 `max-age` 改成一年，訪客瀏覽器會**記住**這個值。中途發現站出包必須 rollback 的話，短 max-age 很快過期，長 max-age 要等一年。

### Day 0（剛做完 Phase 5）：`max-age=600`（10 分鐘）

這是 Phase 5 我們預設的值。跑 48 小時觀察無異狀。

### Day 2：改成 `max-age=86400`（1 天）

Transform Rule 或 Worker 內把 HSTS header 值改成：
```
max-age=86400; includeSubDomains
```
再觀察 1 週無異狀。

### Day 9：改成 `max-age=31536000`（1 年）

```
max-age=31536000; includeSubDomains
```

跑 2 週無異狀。

### Day 23：加入 `preload` 字樣

```
max-age=31536000; includeSubDomains; preload
```

**但還沒送 preload list**。這只是頭告訴瀏覽器「我準備好了」。跑 1 週無異狀。

---

## Phase 8 — HSTS Preload 提交（**不可逆**）

### ⚠️ 這是整份 runbook 最後、最不可逆的動作。

### 8.1 確認 prerequisites

在 `https://hstspreload.org/?domain=keeply.work` 檢查：
- ✅ HSTS header 有出現
- ✅ `max-age >= 31536000`
- ✅ `includeSubDomains` directive 有在
- ✅ `preload` directive 有在
- ✅ HTTPS redirect from HTTP works
- ✅ 所有 subdomain 也 HTTPS

### 8.2 你真的確定嗎？

問自己這些問題——**任何一個答不出「100% 確定未來不會違反」就不要 submit**：

- 我未來 12+ 個月會一直用 HTTPS 嗎？（答案必須是 YES）
- 我會把 `keeply.work` 賣掉或轉作其他用途嗎？（答案必須是 NO）
- 所有 subdomain（假設 `blog.keeply.work`、`status.keeply.work` 等）也都永久 HTTPS 嗎？（全部 YES）

**一旦 submit，即使從 preload list 移除（需要 6-12 個月）**，Chrome/Firefox/Safari 的**舊版本**還是會繼續鎖 HTTPS。

### 8.3 Submit

填 `https://hstspreload.org/` 的表單 → Submit。

等幾週後 Chrome team 審核通過，`keeply.work` 進 preload list。下版 Chrome/Firefox/Safari 發佈時內建。

---

## Rollback 手冊（緊急）

### R-1 Cloudflare proxy 出問題，要立刻回 GitHub Pages 直連

1. Cloudflare dashboard → `keeply.work` → **DNS** → 找指向 GitHub Pages 的 A/CNAME 記錄
2. 點橘色雲朵 → 變灰色（**Proxied → DNS only**）
3. 幾秒後網站直連 GitHub Pages，無 Cloudflare headers

### R-2 Cloudflare 整個壞掉，要回非 Cloudflare 的 DNS

這最難 rollback——nameserver 已交給 Cloudflare：

1. 到 registrar 後台，把 nameservers 改回原本的（Phase 2 前你有沒有截圖原本的 nameservers？希望有）
2. 如果沒截圖，典型 GitHub Pages user 的 DNS 記錄是：
   - `A` records: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME`: `www.keeply.work` → `boy1690.github.io`
3. registrar 後台手動建這些記錄、指回 registrar 自己的 nameservers
4. 等 DNS 傳播

### R-3 Transform Rule 設錯導致頁面壞

Cloudflare dashboard → Rules → Transform Rules → 把 rule **Disable**（不用 delete）。幾秒後 headers 停止 inject。站恢復到 meta CSP-only 狀態。

### R-4 HSTS 已經 submit 到 preload，想移除（最慘的情境）

1. 在 `https://hstspreload.org/removal/` 提交 removal request
2. 等 Chrome/Firefox/Safari 下一次更新（可能 6-12 個月）才從瀏覽器 preload list 移除
3. 已下載並快取舊版 list 的瀏覽器不會自動更新——**user 要升級瀏覽器**才會解除
4. **這段時間內 keeply.work 必須繼續是 HTTPS**，否則訪客連不上

---

## Checklist（你做到哪了？）

印一份出來 check：

- [ ] Phase 0：baseline securityheaders + Observatory 截圖存下
- [ ] Phase 1.1：Cloudflare 帳號已註冊
- [ ] Phase 1.2：`keeply.work` 已加到 Cloudflare
- [ ] Phase 1.3：拿到兩個 nameservers
- [ ] Phase 2：registrar 已改 nameservers
- [ ] Phase 3.1：Cloudflare dashboard 顯示「Active」
- [ ] Phase 3.2：`curl -I` 看到 `cf-ray` header
- [ ] Phase 4：SSL/TLS = **Full (strict)**
- [ ] Phase 5：Transform Rule 或 Worker 部署、`curl -I` 看到所有安全 headers
- [ ] Phase 6.1：securityheaders.com 評 A+
- [ ] Phase 6.2：Observatory 評 ≥ 90
- [ ] Phase 6.4：頁面功能無迴歸（Team notify / Download 等）
- [ ] Phase 7：HSTS 值分階段提高
- [ ] Phase 8：**（不可逆，慢慢來）** submit 到 preload list

---

## FAQ

**Q：Cloudflare Free 真的不用錢嗎？**
A：對。本 spec 用到的 Transform Rules + Workers（100k req/day）+ SSL/TLS + Analytics 基本 + DDoS 基本全免費。

**Q：如果未來 Keeply 流量爆大會被收費嗎？**
A：Worker 超過 100k req/day 才收費。keeply.work 目前流量遠低於此。即使將來爆，Pro plan $20/月也是小錢。

**Q：這樣 Cloudflare 看得到我的訪客資料嗎？**
A：Cloudflare 能看到 request metadata（IP、URL、UA）。這已在 Privacy Policy §2.3 的「standard web server logs」範圍內——GitHub Pages 本身就能看到這些，只是換一家代理。若你想徹底零 proxy，可跳過這整個 spec。

**Q：我想收 CSP violation reports 怎麼辦？**
A：Path 2 (Worker) 可以加 `report-uri` / `report-to`，把 reports 送到外部 endpoint（例如 Sentry 免費層）。本 spec 範圍不含此；未來 spec 可加。

**Q：把 `keeply.work` zone 加進 Cloudflare 會不會把既有的 `keeply-billing` Worker 搞壞？**
A：**不會**。那個 Worker 綁在 `keeply-billing.<subdomain>.workers.dev`（workers.dev subdomain）——跟 `keeply.work` zone 完全獨立。`keeply.work` 變成 Cloudflare DNS 管理後，Worker 繼續在 `*.workers.dev` 上跑，Paddle 的 webhook URL 也不變。若未來你想把 Worker 搬到 `pay.keeply.work` 這種子網域，是另外一個任務（本 runbook 範圍不含）。

**Q：既有 `keeply-billing` Worker 的 secrets（PADDLE_WEBHOOK_SECRET 等）會不會受影響？**
A：**完全不會**。Worker 的 secrets 是綁在 Worker 本身，不是綁在 zone。把新 zone 加進同一個 Cloudflare account，對既有 Worker 零影響。

---

*Spec 022 Runbook v1.0 | 2026-04-23 (amended 2026-04-24 by spec 027)*
