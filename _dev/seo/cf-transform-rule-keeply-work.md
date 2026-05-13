# Cloudflare Transform Rule — keeply.work apex security headers

> Paste-ready setup doc for adding 6 response headers to `keeply.work` apex
> via Cloudflare Transform Rule. Spec: `specs/website/040-cf-transform-rule-keeply-work/`.
>
> Time to apply: 5-10 min in the Cloudflare dashboard.
> Reversibility: one-click disable on the rule in dashboard (no code revert needed).

---

## Why we need this

GitHub Pages does not let us set custom response headers. The existing
`<meta http-equiv="Content-Security-Policy">` covers CSP but is silently
ignored for `frame-ancestors`, HSTS, `Permissions-Policy`, `X-Frame-Options`,
`X-Content-Type-Options`, `Referrer-Policy` (those 6 are header-only).

This Transform Rule injects them at Cloudflare's edge before the response
reaches the browser. We already have an equivalent rule on `blog.keeply.work`
("Keeply Security Headers"); this adds the apex `keeply.work` to the same
posture.

---

## Setup (Cloudflare dashboard)

### 1. Navigate

`keeply.work` zone → **Rules** → **Transform Rules** → **Modify Response Header**
→ **Create rule**.

### 2. Rule name

```
Keeply Main Security Headers
```

### 3. Expression (When incoming requests match…)

Use **Edit expression** → paste this exact expression:

```
(http.host eq "keeply.work")
```

> This scopes the rule to the apex domain only. Subdomains
> (`blog.keeply.work`, future `staging.keeply.work`, etc.) are NOT affected —
> they keep their own zone-level rules. Memory
> `reference_cloudflare_cross_zone_redirect_gotcha.md` documents why zone
> rules need explicit `http.host` scoping.

### 4. Then... (add 6 actions)

Click **+ Add** six times. For each, action = **Set static**, header name + value as below.

#### Header 1: Strict-Transport-Security

| Field | Value |
|---|---|
| Header name | `Strict-Transport-Security` |
| Value | `max-age=600; includeSubDomains` |

> **Note**: starts at 10 min (`600`s) for safe rollback. Bumping to
> 1 year + `preload` is a separate decision (spec 041) — that's a one-way
> commitment with a 6+ month uninstall path.

#### Header 2: X-Frame-Options

| Field | Value |
|---|---|
| Header name | `X-Frame-Options` |
| Value | `SAMEORIGIN` |

> Stops other origins from putting `keeply.work` in an `<iframe>` for
> clickjacking attempts. Legacy browser fallback for CSP's `frame-ancestors`.

#### Header 3: X-Content-Type-Options

| Field | Value |
|---|---|
| Header name | `X-Content-Type-Options` |
| Value | `nosniff` |

> Prevents browsers from MIME-sniffing responses (a known XSS vector when
> a content-type is wrong or missing).

#### Header 4: Referrer-Policy

| Field | Value |
|---|---|
| Header name | `Referrer-Policy` |
| Value | `strict-origin-when-cross-origin` |

> Mirrors the existing `<meta name="referrer">` on every page — keeping
> the header version means even cross-document loads (not just `<a>` clicks)
> respect the same policy.

#### Header 5: Permissions-Policy

| Field | Value |
|---|---|
| Header name | `Permissions-Policy` |
| Value | `geolocation=(), microphone=(), camera=(), interest-cohort=()` |

> Denies four browser APIs that Keeply never needs:
> - `geolocation`, `microphone`, `camera`: no use case
> - `interest-cohort`: opts out of FLoC/Topics cohort assignment

#### Header 6: Content-Security-Policy

| Field | Value |
|---|---|
| Header name | `Content-Security-Policy` |
| Value | (see below — one long line, paste as-is) |

```
default-src 'self'; script-src 'self' https://www.googletagmanager.com https://static.cloudflareinsights.com https://*.clarity.ms https://cdn.paddle.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://www.google-analytics.com https://*.clarity.ms; font-src 'self'; connect-src 'self' https://docs.google.com https://*.google-analytics.com https://*.analytics.google.com https://cloudflareinsights.com https://*.clarity.ms; form-action 'self' https://docs.google.com; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; upgrade-insecure-requests
```

> **Diff from current meta CSP** (spec 019 baseline): only added
> `frame-ancestors 'self'` (which is header-only, ignored in meta).
> Everything else is character-for-character the same as what's in the
> HTML today, so this won't break any existing inline behavior.

### 5. Deploy

Click **Deploy**. Rule should go live within ~30 seconds globally.

---

## Verification (run after deploy)

Run each line; expect the value on the right.

```bash
curl -sI https://keeply.work/ | grep -i strict-transport
# Expect: strict-transport-security: max-age=600; includeSubDomains

curl -sI https://keeply.work/ | grep -i x-frame
# Expect: x-frame-options: SAMEORIGIN

curl -sI https://keeply.work/ | grep -i x-content-type
# Expect: x-content-type-options: nosniff

curl -sI https://keeply.work/ | grep -i referrer-policy
# Expect: referrer-policy: strict-origin-when-cross-origin

curl -sI https://keeply.work/ | grep -i permissions-policy
# Expect: permissions-policy: geolocation=(), microphone=(), camera=(), interest-cohort=()

curl -sI https://keeply.work/ | grep -i content-security-policy
# Expect: content-security-policy: default-src 'self'; ... frame-ancestors 'self'; ...
```

### Scope check (rule must NOT touch blog)

```bash
curl -sI https://blog.keeply.work/ | grep -i strict-transport
# Expect: strict-transport-security: max-age=600; includeSubDomains
#         (set by blog's own existing rule — value should match,
#          but should NOT appear twice)
```

If you see double headers on the blog (the apex rule leaking), the
expression scoping is wrong. Roll back and re-check the expression is
exactly `(http.host eq "keeply.work")`.

### Smoke test (manual, 2 min)

1. Open https://keeply.work/buy.html in a fresh incognito window.
2. Open DevTools → Network → reload.
3. Click any request → Response Headers → confirm 6 headers present.
4. Click the Paddle "Buy" button — does the checkout iframe load?
   - If yes: CSP isn't blocking Paddle.
   - If no: check console for CSP violation. Likely a missing
     `cdn.paddle.com` or `*.paddle.com` in `script-src` / `connect-src` /
     `frame-src`. Diff against the CSP value above and add what's missing.

---

## Rollback

In CF dashboard, navigate to the rule, toggle **Enabled** off. Headers
revert to GitHub Pages defaults within ~30 seconds globally. No code
change needed.

---

## What's next

- **spec 041** — HSTS preload decision (bump `max-age` to 1 year +
  `preload`, then submit to hstspreload.org). One-way commitment with
  ~6 month uninstall lag; deferred until ops shape is solid.
- **CSP tightening** — drop `'unsafe-inline'` from `style-src`, add
  nonce / hash-based whitelist. Out of scope here; needs paddle / GA4
  initialization audit first.
- **Permissions-Policy expansion** — currently denies 4 APIs; full list
  has ~30 directives. Add as discovered (no current need).

---

## Cross-references

- Spec: `specs/website/040-cf-transform-rule-keeply-work/`
- Source handoff: `keeply-blog _dev/seo/handoff-keeply-website-integration-audit-2026-05-13.md` § 2
- Existing meta CSP: `index.html` line 9 (spec 019)
- Sister rule on blog: CF zone `keeply.work` (same zone) → rule "Keeply Security Headers"
- Memory: `reference_cloudflare_csp_rule.md` (where header config lives)
- Memory: `reference_cloudflare_cross_zone_redirect_gotcha.md` (why zone scope matters)
