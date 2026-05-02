/**
 * Keeply Website — i18n Loader
 * Loads the language pack for the CURRENT page's locale only, then the i18n engine.
 *
 * Performance optimization (2026-05-02): previously this loaded all 19 language
 * packs sequentially (~1.15 MB / 19 round-trips) on every page. Language
 * switching is full-page navigation (i18n.js setLang() does `window.location.href`),
 * so packs other than the current locale's are dead weight. Loading just one
 * pack drops TBT by ~1.5 s on Slow 4G simulation and ~500 ms on simulated
 * desktop networks.
 *
 * Order: sri-manifest.json (non-blocking) → current locale pack → i18n.js engine.
 *
 * SRI (spec 020): when sri-manifest.json is reachable, dynamically-injected
 * <script> tags carry their integrity hash. Manifest fetch failure is a
 * graceful degradation (scripts load without SRI rather than the page breaking).
 *
 * URL fingerprinting (spec 15): `_dev/build-fingerprint.js` replaces the
 * inline FINGERPRINT_MANIFEST token at build time with a JSON map of
 * original → hashed pack paths (e.g. "i18n/en.js" → "i18n/en.abc1234567.js").
 * The runtime uses the hashed path for both the script `src` and the SRI
 * manifest lookup. If the token is left empty (file served pre-build), the
 * fallback path is the original unhashed filename.
 */
(function () {
  var FINGERPRINT_MANIFEST = /*__FINGERPRINT_MANIFEST__*/{};

  var SUPPORTED = [
    'zh-TW', 'zh-CN', 'en', 'ja', 'ko',
    'de', 'fr', 'es', 'pt', 'it',
    'nl', 'pl', 'cs', 'hu', 'tr',
    'fi', 'sv', 'no', 'da'
  ];
  var DEFAULT_LOCALE = 'en';

  // Detect current locale from URL path (e.g. /en/, /ja/, /zh-TW/).
  // Root path or unknown locale falls back to DEFAULT_LOCALE so the
  // language-selection landing page still has working translations
  // for the language picker UI.
  function detectLocale() {
    var match = location.pathname.match(/^\/([a-zA-Z]{2}(?:-[A-Z]{2})?)\//);
    if (!match) return DEFAULT_LOCALE;
    var candidate = match[1];
    // Try exact match
    for (var i = 0; i < SUPPORTED.length; i++) {
      if (SUPPORTED[i].toLowerCase() === candidate.toLowerCase()) {
        return SUPPORTED[i];
      }
    }
    return DEFAULT_LOCALE;
  }

  var currentLocale = detectLocale();

  // Compute basePath relative to current page (e.g. ../ from a locale subdir).
  // Match either the original "i18n-loader.js" or the fingerprinted variant
  // "i18n-loader.<10-hex>.js" so this loader works whether served pre- or
  // post-fingerprint build.
  var LOADER_FILENAME_RE = /i18n-loader(?:\.[0-9a-f]{10})?\.js$/;
  var scripts = document.getElementsByTagName('script');
  var basePath = '';
  for (var i = 0; i < scripts.length; i++) {
    var src = scripts[i].getAttribute('src') || '';
    var m = src.match(LOADER_FILENAME_RE);
    if (m) {
      basePath = src.slice(0, src.length - m[0].length);
      break;
    }
  }
  if (!basePath && location.pathname.match(/^\/[a-z]{2}(?:-[A-Z]{2})?\//)) {
    basePath = '../';
  }

  var sriManifest = null;

  function applySri(scriptEl, key) {
    if (sriManifest && sriManifest[key]) {
      scriptEl.integrity = sriManifest[key];
      scriptEl.crossOrigin = 'anonymous';
    }
  }

  function fingerprinted(key) {
    return (FINGERPRINT_MANIFEST && FINGERPRINT_MANIFEST[key]) || key;
  }

  function loadEngine() {
    var s = document.createElement('script');
    var key = fingerprinted('i18n.js');
    applySri(s, key);
    s.src = basePath + key;
    document.body.appendChild(s);
  }

  function loadCurrentLocalePack() {
    var key = fingerprinted('i18n/' + currentLocale + '.js');
    var s = document.createElement('script');
    applySri(s, key);
    s.src = basePath + key;
    s.onload = loadEngine;
    s.onerror = function () {
      // Pack failed (network / 404 / SRI mismatch). Engine falls back to
      // DEFAULT translations so the page still renders without translation
      // strings rather than breaking entirely.
      loadEngine();
    };
    document.body.appendChild(s);
  }

  function fetchManifest(done) {
    if (!window.fetch) { done(); return; }
    try {
      fetch(basePath + 'sri-manifest.json', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (m) { if (m && typeof m === 'object') sriManifest = m; done(); })
        .catch(function () { done(); });
    } catch (e) { done(); }
  }

  function start() {
    fetchManifest(loadCurrentLocalePack);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
