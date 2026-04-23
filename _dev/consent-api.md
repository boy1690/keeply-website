# `window.keeplyConsent` API

> Spec 023 contract | 給未來 GA4 / Meta Pixel / Hotjar / Intercom 等追蹤工具整合使用

## TL;DR

```js
// Pattern 1: load-once on page ready
if (window.keeplyConsent?.has('analytics')) {
  loadGa4();
}

// Pattern 2: react to consent changes (recommended)
window.keeplyConsent?.onChange(function (state) {
  if (state && state.analytics) {
    if (!window.__ga4Loaded) loadGa4();
  } else {
    // user withdrew consent → stop collecting
    if (window.__ga4Loaded) unloadGa4();
  }
});
```

**Always** use optional chaining (`?.`) — consent-api.js should load before tracking scripts (defer order), but defensive access costs nothing and protects against mis-ordered script tags.

## API reference

```ts
interface ConsentState {
  necessary: true;           // always true
  analytics: boolean;
  marketing: boolean;
  timestamp: string;         // ISO 8601 UTC
  version: number;
}

interface KeeplyConsent {
  /** Returns true if the category is opted in.
   *  `necessary` always returns true regardless of state. */
  has(category: 'necessary' | 'analytics' | 'marketing'): boolean;

  /** Returns a shallow copy of the full state, or null if no consent recorded yet. */
  get(): ConsentState | null;

  /** Merge partial state. `necessary` is always forced to true.
   *  Updates timestamp. Emits onChange. Persists to localStorage. */
  set(partial: { analytics?: boolean; marketing?: boolean }): void;

  /** Clear consent entirely. Banner will re-show on next page load. */
  reset(): void;

  /** Programmatically open the preference panel (same as footer link). */
  openPanel(): void;

  /** Subscribe to state changes. Returns an unsubscribe function.
   *  Callback receives the new state (null if reset). */
  onChange(cb: (state: ConsentState | null) => void): () => void;
}
```

## Load order (critical)

`consent-api.js` must parse **before** any tracking loader. The canonical HTML script order:

```html
<script src="consent-api.js" defer></script>   <!-- 1 — MUST be first -->
<script src="components.js" defer></script>    <!-- 2 -->
<script src="cookie-banner.js" defer></script> <!-- 3 — overrides openPanel -->
<script src="i18n-loader.js" defer></script>   <!-- 4 -->
<!-- tracking loaders go AFTER all the above: -->
<script src="ga4-loader.js" defer></script>    <!-- example future spec -->
```

Because all scripts are `defer`, browsers execute them in document order, after HTML parsing. This guarantees `window.keeplyConsent` exists before `ga4-loader.js` runs.

## Consent withdrawal behaviour

GDPR requires withdrawal of consent to be **as easy as giving it**. Our API supports this via `onChange`:

```js
let ga4Ready = false;

window.keeplyConsent?.onChange(function (state) {
  const wantsAnalytics = state && state.analytics;
  if (wantsAnalytics && !ga4Ready) {
    // opt-in event — load tracker
    ga4Ready = true;
    loadGa4();
  } else if (!wantsAnalytics && ga4Ready) {
    // opt-out event — stop tracking
    ga4Ready = false;
    // GA4-specific: disable via gtag('consent', 'update', {analytics_storage: 'denied'})
    if (window.gtag) {
      window.gtag('consent', 'update', { analytics_storage: 'denied' });
    }
  }
});
```

### Why not auto-unload scripts on opt-out?

Removing a loaded `<script>` tag doesn't stop it from running. It also leaves cookies / localStorage that the tracker set. For robust withdrawal, the tracker itself must support a "consent denied" mode (GA4 has one via Consent Mode v2; Meta Pixel has `fbq('consent', 'revoke')`). Use the tracker's native API inside `onChange`.

## Safety guarantees

- `has()`, `get()`, `set()`, `reset()`, `openPanel()`, `onChange()` **never throw**. Failure modes are logged via `console.warn` and callers still get sensible values (`has` → `false`, `get` → `null`).
- `set()` is idempotent — calling with the same partial multiple times produces identical state (only `timestamp` updates).
- `set()` forces `necessary: true` even if the partial includes `necessary: false` — this is GDPR-mandated.
- Cross-tab sync: if user updates consent in tab A, tab B's `onChange` subscribers fire automatically (via browser `storage` event).

## Storage format

**Key:** `localStorage.keeply_cookie_consent_v1`
**Value:** JSON string of `ConsentState` (see above).

**Schema version bump policy:** increment `v1` → `v2` only when adding/removing categories (breaking change). Migrations go in `consent-api.js` — read old key, map to new schema, write new key, delete old. Never delete user data silently; preserve boolean intent (user wanting analytics stays wanting analytics after migration).

## Common pitfalls

1. **Don't access `window.keeplyConsent` without `?.`** — even though load order guarantees presence, future refactors / async loaders may break this. Optional chaining costs 2 chars for robustness.

2. **Don't mutate the object returned by `get()`** — it's a shallow copy, but treating it as immutable keeps code simpler. Use `set()` to update.

3. **Don't use `reset()` as a UX flow** — `reset()` is for debugging/testing only. To let users change preferences, call `openPanel()` so they see the preference UI instead of a full banner re-show.

4. **Don't load tracker scripts speculatively** — wait until `onChange` fires with `analytics: true` OR check `has('analytics')` explicitly. "We'll just load and gate the actual tracking call" is not GDPR-compliant; the cookie is set by the SDK on load.

5. **Don't add categories outside the 3 defined** — if you need a new category (e.g., `personalization`), bump schema version and update banner + panel. Don't silently extend.

## References

- [Spec 023 — GDPR Cookie Consent Banner](../specs/website/023-cookie-consent-banner/spec-lite.md) (may archive after delivery)
- [Spec 019 — CSP + Referrer](../specs/website/019-csp-referrer-email/) — banner/script-src alignment
- [GDPR Article 7](https://gdpr-info.eu/art-7-gdpr/) — conditions for consent
- [CNIL Cookies guidelines](https://www.cnil.fr/en/cookies-and-other-trackers) — design requirements for the banner
- [GA4 Consent Mode v2](https://developers.google.com/tag-platform/security/guides/consent) — how to gate GA4 when consent is denied
