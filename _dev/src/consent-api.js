/**
 * Keeply — Cookie Consent API (spec 023)
 *
 * Exposes `window.keeplyConsent` for site-wide GDPR-compliant consent management.
 * Pure logic; DOM-less. Paired with cookie-banner.js which renders UI.
 *
 * Schema (localStorage "keeply_cookie_consent_v1"):
 *   { necessary: true, analytics: bool, marketing: bool,
 *     timestamp: ISO-8601, version: 1 }
 *
 * API:
 *   window.keeplyConsent.has(category)       → boolean
 *   window.keeplyConsent.get()               → ConsentState | null
 *   window.keeplyConsent.set(partial)        → void
 *   window.keeplyConsent.reset()             → void
 *   window.keeplyConsent.openPanel()         → void  (impl injected by banner)
 *   window.keeplyConsent.onChange(cb)        → unsubscribe function
 *
 * Load order: THIS script MUST parse before any analytics/tracking loader.
 * Defer-order in <head>: consent-api → components → cookie-banner → i18n-loader.
 *
 * Design notes:
 *   - Fail closed: if localStorage fails, falls back to in-memory (current session only).
 *   - Corrupt value → defensive reset → banner re-shows.
 *   - Cross-tab sync via `storage` event.
 *   - NEVER throws from public methods; logs warnings instead.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'keeply_cookie_consent_v1';
  var SCHEMA_VERSION = 1;
  var VALID_CATEGORIES = ['necessary', 'analytics', 'marketing'];

  // In-memory cache (source of truth during a session).
  var cache = null;

  // onChange subscribers.
  var subscribers = [];

  // ─── Storage helpers (all non-throwing) ───────────────────────────────────

  function safeGetStorage() {
    try { return window.localStorage; }
    catch (e) { return null; }
  }

  function readFromStorage() {
    var ls = safeGetStorage();
    if (!ls) return null;
    try {
      var raw = ls.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!validateSchema(parsed)) {
        console.warn('[consent] stored value failed schema validation, discarding');
        try { ls.removeItem(STORAGE_KEY); } catch (e2) { /* ignore */ }
        return null;
      }
      return parsed;
    } catch (e) {
      console.warn('[consent] failed to read storage:', e.message);
      return null;
    }
  }

  function writeToStorage(state) {
    var ls = safeGetStorage();
    if (!ls) return false;
    try {
      ls.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('[consent] failed to write storage (quota? private mode?):', e.message);
      return false;
    }
  }

  // ─── Schema ───────────────────────────────────────────────────────────────

  function validateSchema(obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (obj.version !== SCHEMA_VERSION) return false;
    if (obj.necessary !== true) return false;
    if (typeof obj.analytics !== 'boolean') return false;
    if (typeof obj.marketing !== 'boolean') return false;
    if (typeof obj.timestamp !== 'string') return false;
    // Lightweight ISO 8601 check (YYYY-MM-DDTHH:mm:ss...Z)
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(obj.timestamp)) return false;
    return true;
  }

  function buildState(partial) {
    var base = cache || { necessary: true, analytics: false, marketing: false };
    return {
      necessary: true,
      analytics: partial && typeof partial.analytics === 'boolean' ? partial.analytics : base.analytics,
      marketing: partial && typeof partial.marketing === 'boolean' ? partial.marketing : base.marketing,
      timestamp: new Date().toISOString(),
      version: SCHEMA_VERSION
    };
  }

  // ─── Event emitter ────────────────────────────────────────────────────────

  function emitChange() {
    var snapshot = cache ? shallowCopy(cache) : null;
    for (var i = 0; i < subscribers.length; i++) {
      try { subscribers[i](snapshot); }
      catch (e) { console.warn('[consent] subscriber threw:', e.message); }
    }
  }

  function shallowCopy(obj) {
    var out = {};
    for (var k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
    }
    return out;
  }

  // ─── Public API (never throws) ────────────────────────────────────────────

  function has(category) {
    if (typeof category !== 'string') return false;
    if (VALID_CATEGORIES.indexOf(category) === -1) return false;
    if (category === 'necessary') return true;
    if (!cache) return false;
    return cache[category] === true;
  }

  function get() {
    return cache ? shallowCopy(cache) : null;
  }

  function set(partial) {
    var newState = buildState(partial || {});
    cache = newState;
    writeToStorage(newState);
    emitChange();
  }

  function reset() {
    cache = null;
    var ls = safeGetStorage();
    if (ls) {
      try { ls.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    }
    emitChange();
  }

  function onChange(cb) {
    if (typeof cb !== 'function') return function () {};
    subscribers.push(cb);
    return function unsubscribe() {
      var idx = subscribers.indexOf(cb);
      if (idx !== -1) subscribers.splice(idx, 1);
    };
  }

  // Placeholder — cookie-banner.js will override with actual implementation.
  function openPanel() {
    console.warn('[consent] openPanel() called before cookie-banner.js initialised');
  }

  // ─── Cross-tab sync ───────────────────────────────────────────────────────

  function handleStorageEvent(e) {
    if (e.key !== STORAGE_KEY) return;
    // Another tab changed consent — re-read and notify local subscribers.
    var newValue = readFromStorage();
    cache = newValue;
    emitChange();
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  cache = readFromStorage();

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('storage', handleStorageEvent, false);
  }

  // Expose global API. Keep object shape stable — future callers depend on it.
  window.keeplyConsent = {
    has: has,
    get: get,
    set: set,
    reset: reset,
    openPanel: openPanel,
    onChange: onChange
  };
})();
