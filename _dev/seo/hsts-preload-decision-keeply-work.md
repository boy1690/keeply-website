# HSTS preload decision — keeply.work apex

> Created 2026-05-13. **Decision belongs to the owner**, not to any
> AI agent or downstream maintainer. Preload is a **one-way commitment**
> that locks HTTPS at the browser level for `keeply.work` + every
> current and future subdomain, with a 6+ month uninstall path.
>
> Status: **awaiting-owner-decision**. Default recommendation: do not
> preload yet. Revisit Q4 2026 when product ops shape solidifies.
>
> Spec: `specs/website/041-hsts-preload-decision/`.

---

## Current state

After spec 040 (CF Transform Rule for keeply.work) ships, the header
will be:

```text
$ curl -sI https://keeply.work/ | grep -i strict-transport
strict-transport-security: max-age=600; includeSubDomains
```

`max-age=600` (10 min) is intentionally conservative. It enforces HTTPS
for repeat visitors for 10 minutes after their last visit. If something
breaks, change the rule and the constraint disappears within 10 min.

---

## What HSTS preload is

Preload = the domain ships in a list hard-coded into Chrome / Firefox /
Safari / Edge browser binaries. Browsers refuse to load the domain over
HTTP **ever**, even on a user's first visit before they've seen any
`Strict-Transport-Security` response header from your server.

### Eligibility (per hstspreload.org)

| Requirement | Current state |
|---|---|
| `max-age` ≥ `31536000` (1 year) | ✗ currently `600` |
| `includeSubDomains` directive present | ✓ |
| `preload` directive present | ✗ currently missing |
| All HTTP requests redirect to HTTPS on same host | ✓ (Cloudflare default) |
| Subdomains also serve HTTPS | ✓ (`blog.keeply.work` over HTTPS) |
| Domain is apex (no subdomain) | ✓ (only `keeply.work` is eligible; `blog.keeply.work` is automatically covered by `includeSubDomains`) |

To become preload-eligible we'd need to flip the two ✗ — bump `max-age`
to `31536000` and add `preload` to the directive.

---

## Cost / benefit, plainly

### Benefit

1. Forecloses SSL-strip MITM attacks against first-time visitors who
   type `keeply.work` (defaults to HTTP) before Cloudflare's HTTPS
   redirect can fire on their first request.
2. Minor SEO + trust signal. Google has historically used HSTS preload
   as a positive ranking factor. AI search engines may use it for
   domain trustworthiness scoring.
3. "Locks in" HTTPS — no future config slip can serve HTTP to anyone
   who has ever visited via a preload-aware browser.

### Cost

1. **6+ month uninstall path.** If you ever need to disable HTTPS or use
   HTTP for a temporary endpoint on any subdomain (Jenkins, Grafana,
   staging panel), it is not possible without waiting for the preload
   list to update in Chrome / Firefox / Safari / Edge releases.
2. **Every subdomain forced HTTPS forever.** Including ones that don't
   exist yet. If you add `staging.keeply.work` and forget cert renewal,
   the subdomain is unreachable — not "served over HTTP as fallback".
3. **Removal lag for users who don't update.** Even after submitting a
   removal request, users on outdated browsers can have HTTPS forced for
   12+ months.

---

## Decision matrix

| Your situation | Recommendation |
|---|---|
| You're confident `keeply.work` + every subdomain ever will be HTTPS-only, forever. | ✅ Preload |
| You might run an HTTP-only dev tool on a subdomain at some point. | ❌ Skip |
| Product is new, infra still solidifying, subdomain plan unclear. | ❌ Wait. Revisit Q4 2026. |

**Today (2026-05-13): situation 3.** Keeply is a new product. Likely future
subdomains: `status.keeply.work`, `staging.keeply.work`, possibly an
internal admin panel. Until those exist and have settled HTTPS posture,
the preload commitment is premature.

---

## Steps if owner decides to proceed

1. **Bump max-age in the existing CF Transform Rule** (the one spec 040
   created — "Keeply Main Security Headers"):
   - Edit the rule, change `Strict-Transport-Security` value from
     `max-age=600; includeSubDomains` to
     **`max-age=31536000; includeSubDomains; preload`**.
   - Save + deploy.

2. **Verify**:
   ```bash
   curl -sI https://keeply.work/ | grep -i strict-transport
   # Expect: strict-transport-security: max-age=31536000; includeSubDomains; preload
   ```

3. **Soak test 1–2 weeks**. Keep `max-age=31536000` running. Watch for
   any HTTPS issue on `keeply.work` or any subdomain. If problems
   surface, you can still roll back by lowering `max-age` before
   submitting — submission is the point of no return.

4. **Submit to hstspreload.org**:
   - Open https://hstspreload.org/.
   - Enter `keeply.work`.
   - Re-verify all eligibility checks are green.
   - Submit. Approval is automated if all checks pass.
   - Domain ships into Chrome stable usually 2–3 release cycles later
     (~6–12 weeks). Firefox / Safari / Edge sync from Chromium's list
     with similar lag.

---

## Steps if you change your mind later

1. Submit removal request via https://hstspreload.org/.
2. Wait 4–8 weeks for the next Chrome release that removes you.
3. Users who haven't updated Chrome still have HTTPS forced for ~12+
   months. There is no way to expire HSTS for those users sooner.

This is why this is described as one-way: pre-list it takes one day to
ship; un-list it takes ~12 months for the long tail to drain.

---

## Default recommendation (as of 2026-05-13)

**Do not preload yet.** The conservative `max-age=600` set by spec 040
delivers most of the protection (HTTPS enforced for the 10-minute window
after any visit) without the lock-in cost. Revisit in **Q4 2026** once:

- `keeply.work` + at least one product subdomain have been HTTPS-only
  for 6+ months without incident
- The subdomain plan is settled (you know whether `staging.*`,
  `status.*`, etc. will exist and they will be HTTPS-only)
- You don't expect to need an HTTP endpoint for any internal tool

At that point, bumping max-age + soak + submitting is a 30-minute task.

---

## Cross-references

- Spec: `specs/website/041-hsts-preload-decision/`
- Source handoff: `keeply-blog _dev/seo/handoff-hsts-preload-2026-05-13.md`
  (covers blog.keeply.work; logic is identical for apex)
- Prerequisite: spec 040 (CF Transform Rule on keeply.work apex must be
  live with HSTS header before max-age bump is possible)
- Eligibility checker: https://hstspreload.org/
- Status check: `curl -sI https://keeply.work/ | grep -i strict-transport`
