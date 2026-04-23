/**
 * Keeply i18n Engine (v5 — globe dropdown, 19 languages, browser-local detection)
 *
 * How it works:
 *   1. Language packs register themselves on window.__i18n
 *   2. This script reads from window.__i18n — no fetch, works on file:// protocol
 *   3. HTML is a pure template — elements use data-i18n / data-i18n-html attributes
 *   4. Globe icon in nav opens a dropdown to pick language
 *
 * Language detection is 100% browser-local (navigator.language). No third-party
 * geolocation calls are made. localStorage is written only when the visitor
 * takes an explicit action (clicks the language menu or visits a locale URL).
 * See /law/products/keeply/governance/2026-04-23-remove-ipapi-geolocation.md.
 *
 * To add a new language:
 *   1. Create i18n/{locale}.js
 *   2. Add <script src="i18n/{locale}.js"></script> in each HTML page
 *   3. Add entry to LANGUAGES below
 */
(function () {
  var LANGUAGES = [
    { code: 'zh-TW', label: '繁體中文' },
    { code: 'zh-CN', label: '简体中文' },
    { code: 'en',    label: 'English' },
    { code: 'ja',    label: '日本語' },
    { code: 'ko',    label: '한국어' },
    { code: 'de',    label: 'Deutsch' },
    { code: 'fr',    label: 'Français' },
    { code: 'es',    label: 'Español' },
    { code: 'pt',    label: 'Português' },
    { code: 'it',    label: 'Italiano' },
    { code: 'nl',    label: 'Nederlands' },
    { code: 'pl',    label: 'Polski' },
    { code: 'cs',    label: 'Čeština' },
    { code: 'hu',    label: 'Magyar' },
    { code: 'tr',    label: 'Türkçe' },
    { code: 'fi',    label: 'Suomi' },
    { code: 'sv',    label: 'Svenska' },
    { code: 'no',    label: 'Norsk' },
    { code: 'da',    label: 'Dansk' }
  ];
  var SUPPORTED = LANGUAGES.map(function (l) { return l.code; });
  var DEFAULT = 'en';
  var STORAGE_KEY = 'keeply-lang';
  var currentLang = null;
  var data = window.__i18n || {};

  // Deep-freeze the i18n tree to prevent runtime mutation of translation
  // strings (defence against supply-chain script compromise and prototype
  // pollution attacks that would otherwise poison DOM insertions via
  // data-i18n-html). i18n-loader.js guarantees all locale packs have
  // registered onto window.__i18n before i18n.js is loaded, so freezing
  // here cannot race with pack registration. See spec 018.
  (function deepFreezeI18n(root) {
    if (!root || typeof Object.freeze !== 'function') return;
    var keys = Object.keys(root);
    for (var i = 0; i < keys.length; i++) {
      var v = root[keys[i]];
      if (v && typeof v === 'object') { Object.freeze(v); }
    }
    Object.freeze(root);
  })(data);

  // Map lang codes to HTML lang attribute values
  var HTML_LANG_MAP = {
    'zh-TW': 'zh-Hant', 'zh-CN': 'zh-Hans',
    'ja': 'ja', 'ko': 'ko', 'en': 'en',
    'de': 'de', 'fr': 'fr', 'es': 'es', 'pt': 'pt', 'it': 'it',
    'nl': 'nl', 'pl': 'pl', 'cs': 'cs', 'hu': 'hu', 'tr': 'tr',
    'fi': 'fi', 'sv': 'sv', 'no': 'no', 'da': 'da'
  };

  function detectLangFromBrowser() {
    var nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
    for (var i = 0; i < SUPPORTED.length; i++) {
      if (nav === SUPPORTED[i].toLowerCase()) return SUPPORTED[i];
    }
    var prefix = nav.split('-')[0];
    if (prefix === 'zh') return 'zh-TW';
    for (var j = 0; j < SUPPORTED.length; j++) {
      if (SUPPORTED[j].toLowerCase() === prefix) return SUPPORTED[j];
    }
    return DEFAULT;
  }

  function detectLang() {
    // Priority 1: User's prior explicit choice (localStorage)
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;
    } catch (e) { /* private browsing */ }
    // Priority 2: Browser-reported language — fully local, no network call
    // Priority 3 (inside detectLangFromBrowser): fall back to DEFAULT
    return detectLangFromBrowser();
  }

  // ---- HTML sanitizer (spec 018 / security audit #5) -------------------
  // Allowlist-based inline sanitizer used for every data-i18n-html value.
  // Defence-in-depth against supply-chain script compromise or prototype
  // pollution mutating window.__i18n. Works purely client-side via DOMParser.
  //
  // Allowed tags: <strong> <b> <em> <i> <br> <span> <a>
  // Allowed attrs: class (global); href/target/rel (on <a>). href must be
  //   http(s)/mailto (relative URLs resolve via location.href).
  // Disallowed tags: unwrap (keep text), except <script>/<style> which are
  //   dropped entirely so their body is never displayed as plain text.
  // Allowlist derived from actual translation usage (survey run 2026-04-23:
  // only A, CODE, LI, P, SPAN, STRONG, UL appear). B/EM/I/BR/OL/H3/H4 are
  // kept because they are safe (text-formatting only, no attributes of
  // concern) and commonly needed for future translations.
  var SAN_ALLOWED_TAGS = {
    'STRONG': true, 'B': true, 'EM': true, 'I': true, 'BR': true,
    'SPAN': true, 'A': true, 'CODE': true, 'P': true,
    'UL': true, 'OL': true, 'LI': true,
    'H3': true, 'H4': true
  };
  var SAN_DROP_WITH_CONTENT = {
    'SCRIPT': true, 'STYLE': true, 'IFRAME': true, 'OBJECT': true,
    'EMBED': true, 'LINK': true, 'META': true
  };
  var SAN_GLOBAL_ATTRS = { 'class': true };
  var SAN_TAG_ATTRS = {
    'A': { 'class': true, 'href': true, 'target': true, 'rel': true }
  };
  var SAN_URL_OK = /^(https?:|mailto:)/i;

  function sanCleanAttrs(el) {
    var attrs = Array.prototype.slice.call(el.attributes);
    var tagAttrs = SAN_TAG_ATTRS[el.tagName] || null;
    for (var i = 0; i < attrs.length; i++) {
      var name = attrs[i].name;
      var val = attrs[i].value;
      var ok = SAN_GLOBAL_ATTRS[name] === true ||
               (tagAttrs && tagAttrs[name] === true);
      if (!ok) { el.removeAttribute(name); continue; }
      if (name === 'href') {
        var abs = null;
        try { abs = new URL(val, location.href); } catch (e) { /* bad URL */ }
        if (!abs || !SAN_URL_OK.test(abs.protocol)) {
          el.removeAttribute('href');
        }
      }
    }
  }

  function sanWalk(node) {
    var children = Array.prototype.slice.call(node.childNodes);
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.nodeType === 3) { continue; } // text — keep
      if (child.nodeType !== 1) { node.removeChild(child); continue; } // comment/other
      var tag = child.tagName;
      if (SAN_DROP_WITH_CONTENT[tag]) { node.removeChild(child); continue; }
      // Recurse first so that if this child turns out to be disallowed and
      // gets unwrapped, the hoisted grandchildren have already been cleaned
      // (fixes <svg><script>...</script></svg> leaking through).
      sanWalk(child);
      if (SAN_ALLOWED_TAGS[tag]) {
        sanCleanAttrs(child);
      } else {
        // unwrap: move (already-cleaned) children out, then drop the element
        while (child.firstChild) { node.insertBefore(child.firstChild, child); }
        node.removeChild(child);
      }
    }
  }

  function sanitizeHtml(html) {
    if (html == null) return '';
    var s = String(html);
    if (s === '') return '';
    var doc = new DOMParser().parseFromString(
      '<!doctype html><body><div id="__san">' + s + '</div>', 'text/html'
    );
    var root = doc.getElementById('__san');
    if (!root) return '';
    sanWalk(root);
    return root.innerHTML;
  }
  // ---- end sanitizer ----------------------------------------------------

  function applyTranslations(translations) {
    if (!translations) return;
    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var key = els[i].getAttribute('data-i18n');
      if (translations[key] != null) {
        if (els[i].tagName === 'INPUT' || els[i].tagName === 'TEXTAREA') {
          els[i].placeholder = translations[key];
        } else {
          els[i].textContent = translations[key];
        }
      }
    }
    var htmlEls = document.querySelectorAll('[data-i18n-html]');
    for (var j = 0; j < htmlEls.length; j++) {
      var hkey = htmlEls[j].getAttribute('data-i18n-html');
      if (translations[hkey] != null) {
        htmlEls[j].innerHTML = sanitizeHtml(translations[hkey]);
      }
    }
    var titleKey = document.documentElement.getAttribute('data-i18n-title');
    if (titleKey && translations[titleKey]) {
      document.title = translations[titleKey];
    }
    var metaDesc = document.querySelector('meta[name="description"]');
    var descKey = document.documentElement.getAttribute('data-i18n-desc');
    if (metaDesc && descKey && translations[descKey]) {
      metaDesc.setAttribute('content', translations[descKey]);
    }
  }

  function getLangLabel(code) {
    for (var i = 0; i < LANGUAGES.length; i++) {
      if (LANGUAGES[i].code === code) return LANGUAGES[i].label;
    }
    return code;
  }

  // Detect if we're in a locale subdirectory (e.g. /en/, /zh-TW/)
  function detectLocaleFromUrl() {
    var match = location.pathname.match(/^\/([a-z]{2}(?:-[A-Z]{2})?)\//);
    return match ? match[1] : null;
  }

  // Get current page filename (e.g. 'privacy.html', 'index.html')
  function getCurrentPage() {
    var parts = location.pathname.split('/').filter(Boolean);
    var last = parts[parts.length - 1] || '';
    if (last && last.indexOf('.html') !== -1) return last;
    return 'index.html';
  }

  // setLang(lang, persist)
  //   persist === true  → write the choice to localStorage
  //                       (use when the change reflects an explicit user action:
  //                        dropdown click, URL-locale navigation)
  //   persist === false → apply in-page only
  //                       (use for first-visit auto-detection, so we do not
  //                        write storage before the visitor has chosen — see
  //                        /law Privacy §2.4)
  //
  // The default is non-persisting because the safer behaviour for ambiguous
  // call-sites is to not persist.
  function setLang(lang, persist) {
    if (SUPPORTED.indexOf(lang) === -1) lang = DEFAULT;
    if (persist === true) {
      try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }
    }

    // If in a locale subdirectory, navigate to the new locale URL
    var urlLocale = detectLocaleFromUrl();
    if (urlLocale && urlLocale !== lang) {
      var page = getCurrentPage();
      var pagePath = page === 'index.html' ? '' : page;
      window.location.href = '/' + lang + '/' + pagePath;
      return;
    }

    // Fallback: in-page replacement (for root page or same locale)
    currentLang = lang;
    document.documentElement.lang = HTML_LANG_MAP[lang] || lang;

    // Update globe button label
    var label = document.getElementById('lang-label');
    if (label) label.textContent = getLangLabel(lang);

    // Update active state in dropdown
    var items = document.querySelectorAll('[data-lang-code]');
    for (var i = 0; i < items.length; i++) {
      var code = items[i].getAttribute('data-lang-code');
      if (code === lang) {
        items[i].classList.add('font-bold', 'text-brand-600');
        items[i].classList.remove('text-gray-700');
      } else {
        items[i].classList.remove('font-bold', 'text-brand-600');
        items[i].classList.add('text-gray-700');
      }
    }

    applyTranslations(data[lang]);
  }

  function buildDropdown() {
    var container = document.getElementById('lang-switcher');
    if (!container) return;

    var dropdown = document.getElementById('lang-dropdown');
    if (dropdown) return; // already built

    // Create dropdown panel
    dropdown = document.createElement('div');
    dropdown.id = 'lang-dropdown';
    dropdown.className = 'absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl py-2 z-[100] w-48 max-h-80 overflow-y-auto hidden';
    dropdown.style.scrollbarWidth = 'thin';

    var page = getCurrentPage();
    var pagePath = page === 'index.html' ? '' : page;

    for (var i = 0; i < LANGUAGES.length; i++) {
      var lang = LANGUAGES[i];
      var item = document.createElement('a');
      item.href = '/' + lang.code + '/' + pagePath;
      item.className = 'block w-full text-left px-4 py-2 text-sm hover:bg-brand-50 transition-colors text-gray-700';
      item.setAttribute('data-lang-code', lang.code);
      item.textContent = lang.label;
      item.addEventListener('click', (function (code) {
        return function (e) {
          // Explicit user action — persist the preference before the
          // <a href="/{code}/..."> navigates. The landing page's init() will
          // also see the URL locale and re-persist, which is idempotent.
          try { localStorage.setItem(STORAGE_KEY, code); } catch (ex) {}
        };
      })(lang.code));
      dropdown.appendChild(item);
    }

    container.style.position = 'relative';
    container.appendChild(dropdown);

    // Toggle dropdown on globe button click
    var btn = document.getElementById('lang-toggle');
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
      });
    }

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!container.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  }

  function init() {
    // If in a locale subdirectory, use that locale as the current language.
    // Visiting a locale URL (including via shared link or bookmark) is treated
    // as an explicit preference, so the choice is persisted.
    var urlLocale = detectLocaleFromUrl();
    var persistOnApply;
    if (urlLocale && SUPPORTED.indexOf(urlLocale) !== -1) {
      currentLang = urlLocale;
      persistOnApply = true;
    } else {
      currentLang = detectLang();
      // If detectLang() returned a value from a prior localStorage entry,
      // storage already reflects the choice; if it came from navigator.language
      // (first visit), we deliberately do NOT write storage — the visitor has
      // not yet taken any explicit action. See /law Privacy §2.4.
      persistOnApply = false;
    }
    buildDropdown();
    setLang(currentLang, persistOnApply);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.__keeplyI18n = {
    setLang: setLang,
    currentLang: function () { return currentLang; },
    sanitizeHtml: sanitizeHtml
  };
})();
