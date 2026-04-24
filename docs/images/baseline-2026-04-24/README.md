# Security audit artifacts — 2026-04-24

One-day migration from bare GitHub Pages → Cloudflare proxy + DNSSEC +
hardened CSP. This folder captures the before/after evidence for the
18-item security audit closure.

## Mozilla Observatory score progression

| Time (local) | Score | Grade | Milestone |
|---|---|---|---|
| 20:47 | 55 | C | Baseline after spec 022 (Phase 5 Transform Rules deployed) |
| 21:48 | 70 | B | Spec 030 CSP alignment (GTM + Cloudflare Insights allowlisted) |
| **22:39** | **115** | **A+** | Spec 031 — `'unsafe-inline'` removed from `script-src` |

## Artifacts

- `Raw Headers.pdf` / `Raw Headers2.pdf` — mid-migration header snapshots
- `Raw Headers3.pdf` — **A+ achievement snapshot (Mozilla Observatory scan at 22:39)**
- `HTTP Observatory Report.pdf` / `HTTP Observatory Report2.pdf` —
  C/55 and B/70 intermediate scan reports
- `nameservers-before.txt` — pre-Cloudflare Namecheap NS for rollback
- `dnssec-values.txt` — DS record (Key Tag 2371, SHA-256 digest) passed
  to `.work` TLD; DNSSEC trust chain fully validated per
  dnssec-analyzer.verisignlabs.com

## What got us A+

Score = 100 baseline + 25 bonuses − 10 HSTS penalty = **115**

Bonuses:

- +5 Referrer-Policy: `strict-origin-when-cross-origin`
- +5 Subresource Integrity: all same-origin scripts carry `sha384-...`
- +5 X-Frame-Options via CSP `frame-ancestors 'none'`
- +10 Cross-Origin-Resource-Policy: `same-origin`

Only deduction: HSTS `max-age=600` (< 6 months). Will flip to a bonus
when Phase 7 `max-age=31536000` lands on 2026-05-03 per
`docs/keeply-hsts-rollout.ics`.

## Audit items closed this day

| Audit # | Topic | Status |
|---|---|---|
| 8 | Cloudflare proxy + HSTS / frame-ancestors / Permissions-Policy | ✅ |
| 9 | SPF / DKIM / DMARC alignment | ✅ (already in production) |
| 11 | HSTS | ✅ Day 1 (`max-age=600`); staged rollout on calendar |
| 15 | DNSSEC | ✅ Algorithm 13, chain validated |
| 16 | Registrar hardening (2FA / lock / auto-renew / WhoisGuard) | ✅ |

Plus follow-up specs committed today:

- 030 — CSP meta + header alignment (GTM + Cloudflare Insights)
- 031 — Remove `'unsafe-inline'` from script-src via inline→external refactor

## Specs

Full context (local only per policy — `specs/` is gitignored):

- `specs/infra/022-cloudflare-headers/` — base Transform Rule runbook
- `specs/infra/030-csp-gtm-insights/` — meta/header CSP alignment hotfix
- `specs/infra/031-csp-no-unsafe-inline/` — inline scripts extracted to 3 external `.js` files
