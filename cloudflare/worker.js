/**
 * Keeply — Cloudflare Worker for Security Headers (spec 022 / audit #8 + #11)
 *
 * Sits between Cloudflare edge and origin (GitHub Pages). Passes through
 * every request unchanged, then decorates HTML responses with a full set
 * of security headers that GitHub Pages cannot send itself.
 *
 * PATH 2 (advanced) deployment:
 *   Cloudflare dashboard → Workers & Pages → Create Worker → paste this
 *   file → Deploy. Then bind the Worker to your zone:
 *   Workers & Pages → your Worker → Settings → Triggers → Add Custom
 *   Domain → `keeply.work`  (and repeat for `www.keeply.work` if used).
 *
 * PATH 1 (simpler) alternative: Transform Rules UI (no code).
 *   See docs/cloudflare-setup.md §Phase 5 — Path 1.
 *
 * Tune the header values in SECURITY_HEADERS below before deploying.
 *
 * Request-per-day limit on the Free plan is 100k; keeply.work is well
 * under that.
 */

const SECURITY_HEADERS = {
  // HSTS: instruct browsers to always use HTTPS for 1 year including
  // subdomains. Start the rollout with a short max-age (see runbook
  // Phase 7). `preload` is set here but does NOT auto-submit to the
  // preload list — submission is a manual step at hstspreload.org.
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // Clickjacking protection. CSP frame-ancestors is the modern rule;
  // X-Frame-Options stays as a belt-and-braces fallback for older clients.
  'X-Frame-Options': 'DENY',

  // MIME sniffing: force browsers to trust the declared Content-Type
  // rather than guessing from body contents.
  'X-Content-Type-Options': 'nosniff',

  // Referrer Policy: origin only on cross-origin. Matches the meta tag
  // set in spec 019 so there is no conflict.
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions-Policy (formerly Feature-Policy). Deny access to browser
  // APIs the site never legitimately needs — a compromised third-party
  // script cannot silently enable them.
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), ' +
    'usb=(), magnetometer=(), gyroscope=(), accelerometer=(), ' +
    'autoplay=(), fullscreen=(self)',

  // Full CSP served as an HTTP header. Supersedes the meta CSP from
  // spec 019 (the meta tag remains in place as a defence-in-depth
  // fallback when the Worker is bypassed or misconfigured). The
  // header version adds `frame-ancestors` which cannot be expressed
  // in a meta CSP.
  'Content-Security-Policy':
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://static.cloudflareinsights.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https://www.google-analytics.com; " +
    "font-src 'self'; " +
    "connect-src 'self' https://docs.google.com https://*.google-analytics.com https://*.analytics.google.com https://cloudflareinsights.com; " +
    "form-action 'self' https://docs.google.com; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "object-src 'none'; " +
    "upgrade-insecure-requests",

  // Cross-origin isolation (minimal; tighten later if we ever adopt
  // SharedArrayBuffer / COOP+COEP).
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin'
};

export default {
  async fetch(request) {
    // Pass the request through to origin (GitHub Pages).
    const response = await fetch(request);

    // Only decorate HTML responses — binaries, CSS, JS inherit
    // response headers from origin and do not need CSP.
    const contentType = response.headers.get('content-type') || '';
    if (!/^text\/html/i.test(contentType)) {
      return response;
    }

    const headers = new Headers(response.headers);

    // Remove any headers GitHub Pages set that we want to own.
    for (const name of Object.keys(SECURITY_HEADERS)) {
      headers.delete(name);
    }

    // Apply our own.
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(name, value);
    }

    // Mark our work for debugging / audit.
    headers.set('X-Keeply-Security', 'cloudflare-worker/spec-022');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
