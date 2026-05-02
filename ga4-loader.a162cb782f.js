/**
 * Keeply — GA4 Consent-Gated Loader (spec 024)
 *
 * Integrates Google Analytics 4 with Google Consent Mode v2, bridged to
 * window.keeplyConsent (spec 023). No user data is collected until the
 * user explicitly grants Analytics consent via the cookie banner.
 *
 * Strategy:
 *   1. Always load gtag.js (so that when consent is eventually granted, we
 *      don't lose the session or need to reload).
 *   2. Default ALL consent flags to 'denied' before the first gtag call.
 *      Per Google's Consent Mode v2, this suppresses identifying cookies
 *      and prevents collect/analytics events from firing.
 *   3. When window.keeplyConsent changes, mirror the state via
 *      gtag('consent', 'update', ...). Granted analytics → GA4 begins
 *      collecting immediately. Revoked → stops immediately.
 *
 * Ads-related consents (ad_storage, ad_user_data, ad_personalization) are
 * held at 'denied' always because Keeply currently runs no ads.
 *
 * Measurement ID: G-V3SZDGJ06D (non-secret; public on every page anyway).
 *
 * Load order (HTML <head> defer, in this order):
 *   consent-api.js → components.js → cookie-banner.js → ga4-loader.js → i18n-loader.js
 * Ensures window.keeplyConsent exists before this script runs.
 */
(function () {
  'use strict';

  var MEASUREMENT_ID = 'G-V3SZDGJ06D';
  var GTAG_SRC = 'https://www.googletagmanager.com/gtag/js?id=' + MEASUREMENT_ID;

  // Initialise dataLayer + gtag shim BEFORE the async script loads so that
  // any gtag() calls queued here reach gtag.js in the correct order.
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  // Expose gtag for potential use by future custom events.
  window.gtag = window.gtag || gtag;

  // Set defaults FIRST — before any 'config' or analytics event. Per
  // Consent Mode v2 spec, defaults must be established prior to other
  // gtag calls.
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'granted', // necessary: language prefs etc
    security_storage: 'granted'       // always needed (CSRF tokens etc)
  });

  gtag('js', new Date());

  gtag('config', MEASUREMENT_ID, {
    // Privacy-first config:
    allow_google_signals: false,              // disable cross-device personalisation
    allow_ad_personalization_signals: false,  // disable ad-personalisation signal flow
    // GA4 auto-anonymizes IPs since 2023; no `anonymize_ip` needed.
    // Defer debug_mode to GA4 DebugView (no client-side flag).
    send_page_view: true
  });

  // Inject the gtag.js <script> tag only AFTER defaults are queued, so
  // commands fire in the right order once the remote script evaluates.
  var s = document.createElement('script');
  s.async = true;
  s.src = GTAG_SRC;
  document.head.appendChild(s);

  // ─── Bridge window.keeplyConsent → GA4 Consent Mode ───────────────────

  function syncFromKeeplyConsent() {
    if (!window.keeplyConsent) return;
    var state = window.keeplyConsent.get();
    var analyticsGranted = state && state.analytics === true;
    gtag('consent', 'update', {
      analytics_storage: analyticsGranted ? 'granted' : 'denied'
      // ad_* stays denied — Keeply runs no ads. If a future spec
      // enables Marketing category with ad integrations, extend here.
    });
  }

  if (window.keeplyConsent && typeof window.keeplyConsent.onChange === 'function') {
    // Initial sync (in case consent was already granted in a prior session).
    syncFromKeeplyConsent();
    window.keeplyConsent.onChange(syncFromKeeplyConsent);
  } else {
    console.warn('[ga4-loader] window.keeplyConsent missing; staying at default-denied');
  }
})();
