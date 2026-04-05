/**
 * Keeply i18n Engine (v4 — globe dropdown, 19 languages, IP geolocation)
 *
 * How it works:
 *   1. Language packs register themselves on window.__i18n
 *   2. This script reads from window.__i18n — no fetch, works on file:// protocol
 *   3. HTML is a pure template — elements use data-i18n / data-i18n-html attributes
 *   4. Globe icon in nav opens a dropdown to pick language
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

  // Map lang codes to HTML lang attribute values
  var HTML_LANG_MAP = {
    'zh-TW': 'zh-Hant', 'zh-CN': 'zh-Hans',
    'ja': 'ja', 'ko': 'ko', 'en': 'en',
    'de': 'de', 'fr': 'fr', 'es': 'es', 'pt': 'pt', 'it': 'it',
    'nl': 'nl', 'pl': 'pl', 'cs': 'cs', 'hu': 'hu', 'tr': 'tr',
    'fi': 'fi', 'sv': 'sv', 'no': 'no', 'da': 'da'
  };

  // Country code → language mapping for IP geolocation
  var COUNTRY_LANG_MAP = {
    'TW': 'zh-TW', 'CN': 'zh-CN', 'HK': 'zh-TW', 'MO': 'zh-TW',
    'JP': 'ja', 'KR': 'ko',
    'DE': 'de', 'AT': 'de', 'CH': 'de', 'LI': 'de',
    'FR': 'fr', 'BE': 'fr', 'LU': 'fr', 'MC': 'fr',
    'ES': 'es', 'MX': 'es', 'AR': 'es', 'CO': 'es', 'CL': 'es', 'PE': 'es',
    'PT': 'pt', 'BR': 'pt',
    'IT': 'it', 'SM': 'it',
    'NL': 'nl',
    'PL': 'pl',
    'CZ': 'cs',
    'HU': 'hu',
    'TR': 'tr',
    'FI': 'fi',
    'SE': 'sv',
    'NO': 'no',
    'DK': 'da',
    'SG': 'en', 'AU': 'en', 'NZ': 'en', 'GB': 'en', 'IE': 'en',
    'US': 'en', 'CA': 'en', 'IN': 'en', 'PH': 'en', 'ZA': 'en'
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
    // Priority 1: User's manual choice (localStorage)
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;
    } catch (e) { /* private browsing */ }
    // Priority 2 & 3: handled in init (IP async → browser fallback)
    return detectLangFromBrowser();
  }

  // Priority 2: IP geolocation (async, upgrades language after initial render)
  function detectLangFromIP() {
    // Skip if user already chose manually
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch (e) { return; }

    fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) })
      .then(function (r) { return r.json(); })
      .then(function (geo) {
        if (!geo || !geo.country_code) return;
        var ipLang = COUNTRY_LANG_MAP[geo.country_code];
        if (ipLang && SUPPORTED.indexOf(ipLang) !== -1 && ipLang !== currentLang) {
          setLang(ipLang);
        }
      })
      .catch(function () { /* timeout or blocked — keep browser detection */ });
  }

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
        htmlEls[j].innerHTML = translations[hkey];
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

  function setLang(lang) {
    if (SUPPORTED.indexOf(lang) === -1) lang = DEFAULT;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }

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
          try { localStorage.setItem(STORAGE_KEY, code); } catch (ex) {}
          // Let the <a> navigate naturally
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
    // If in a locale subdirectory, use that locale as the current language
    var urlLocale = detectLocaleFromUrl();
    if (urlLocale && SUPPORTED.indexOf(urlLocale) !== -1) {
      currentLang = urlLocale;
      try { localStorage.setItem(STORAGE_KEY, urlLocale); } catch (e) {}
    } else {
      currentLang = detectLang();
    }
    buildDropdown();
    setLang(currentLang);
    // Async: try IP geolocation to upgrade language (won't override manual choice or URL locale)
    if (!urlLocale) detectLangFromIP();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.__keeplyI18n = {
    setLang: setLang,
    currentLang: function () { return currentLang; }
  };
})();
