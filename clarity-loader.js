/**
 * Keeply — Microsoft Clarity Consent-Gated Loader (parity with ga4-loader.js spec 024)
 *
 * Integrates Microsoft Clarity (session replay + heatmaps) with the same
 * Consent Mode v2 pattern used by ga4-loader.js, bridged to
 * window.keeplyConsent (spec 023). No session recording or event collection
 * fires until the user explicitly grants Analytics consent via the cookie
 * banner.
 *
 * Strategy:
 *   1. Always inject the Clarity tag <script>. Defaulting consent to denied
 *      means the script is loaded and ready, but Clarity's API holds back
 *      data collection until granted.
 *   2. Initialise the clarity() stub BEFORE the tag so that consent-related
 *      commands queued here reach Clarity in the correct order once the
 *      remote script evaluates.
 *   3. Default to consent denied. Clarity's `consent(false)` directive
 *      suppresses recording until later granted.
 *   4. When window.keeplyConsent changes, mirror analytics state via
 *      clarity('consent', boolean). Granted analytics → Clarity begins
 *      recording immediately. Revoked → stops immediately.
 *
 * Project ID: wkw6horp6j (Keeply Main Site project; non-secret, every page
 * exposes it via the script src URL).
 *
 * Load order (HTML <head> defer, in this order):
 *   consent-api.js → components.js → cookie-banner.js → ga4-loader.js →
 *   clarity-loader.js → i18n-loader.js
 * Ensures window.keeplyConsent exists before this script runs.
 */
(function () {
  'use strict';

  var PROJECT_ID = 'wkw6horp6j';
  var CLARITY_TAG_SRC = 'https://www.clarity.ms/tag/' + PROJECT_ID;

  // Initialise the clarity() command queue BEFORE injecting the tag, so any
  // commands queued here (notably the consent default) reach Clarity in the
  // correct order once the remote script evaluates.
  window.clarity = window.clarity || function () {
    (window.clarity.q = window.clarity.q || []).push(arguments);
  };

  // Default to consent denied — must be queued BEFORE the tag loads so that
  // Clarity respects the gate from the very first event. Mirrors GA4's
  // gtag('consent', 'default', {analytics_storage: 'denied'}) pattern.
  window.clarity('consent', false);

  // Inject the Clarity tag. Async; placed before the first existing <script>
  // per Microsoft's standard install pattern. The remote tag evaluates the
  // queued commands once it loads.
  var s = document.createElement('script');
  s.async = true;
  s.src = CLARITY_TAG_SRC;
  var first = document.getElementsByTagName('script')[0];
  if (first && first.parentNode) {
    first.parentNode.insertBefore(s, first);
  } else {
    document.head.appendChild(s);
  }

  // ─── Bridge window.keeplyConsent → Clarity consent ────────────────────

  function syncFromKeeplyConsent() {
    if (!window.keeplyConsent) return;
    var state = window.keeplyConsent.get();
    var analyticsGranted = state && state.analytics === true;
    window.clarity('consent', analyticsGranted);
  }

  if (window.keeplyConsent && typeof window.keeplyConsent.onChange === 'function') {
    // Initial sync — covers prior-session consent already granted in localStorage.
    syncFromKeeplyConsent();
    window.keeplyConsent.onChange(syncFromKeeplyConsent);
  } else {
    console.warn('[clarity-loader] window.keeplyConsent missing; staying at default-denied');
  }
})();
