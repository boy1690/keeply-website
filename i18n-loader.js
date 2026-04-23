/**
 * Keeply Website — i18n Loader
 * 動態載入所有語言包和 i18n 引擎。
 * 取代每個 HTML 中重複的 19 個 <script> 標籤。
 *
 * 載入順序：sri-manifest.json（非阻塞可跳過）→ 語言包（依序）→ i18n.js（引擎）
 * 確保 window.__i18n 在引擎執行前已填入所有翻譯。
 *
 * SRI (spec 020): when sri-manifest.json is reachable, each dynamically-
 * injected <script> tag is tagged with its integrity hash, so a tampered
 * response is rejected by the browser. A manifest fetch failure is treated
 * as a graceful degradation — scripts load without SRI rather than the
 * whole page breaking.
 */
(function () {
  var LOCALES = [
    'zh-TW', 'zh-CN', 'en', 'ja', 'ko',
    'de', 'fr', 'es', 'pt', 'it',
    'nl', 'pl', 'cs', 'hu', 'tr',
    'fi', 'sv', 'no', 'da'
  ];

  // 計算 i18n/ 的基礎路徑（相對於當前頁面）
  // 在子目錄頁面中，script src 會是 ../i18n-loader.js，
  // 所以 basePath 會是 ../ ，語言包路徑就是 ../i18n/{locale}.js
  var scripts = document.getElementsByTagName('script');
  var basePath = '';
  for (var i = 0; i < scripts.length; i++) {
    var src = scripts[i].getAttribute('src') || '';
    if (src.indexOf('i18n-loader.js') !== -1) {
      basePath = src.replace('i18n-loader.js', '');
      break;
    }
  }
  // Fallback: detect from URL if script detection fails
  if (!basePath && location.pathname.match(/^\/[a-z]{2}(?:-[A-Z]{2})?\//)) {
    basePath = '../';
  }

  var loaded = 0;
  var total = LOCALES.length;
  var sriManifest = null; // filled by fetchManifest() or left null

  function applySri(scriptEl, key) {
    if (sriManifest && sriManifest[key]) {
      scriptEl.integrity = sriManifest[key];
      scriptEl.crossOrigin = 'anonymous';
    }
  }

  function loadEngine() {
    var s = document.createElement('script');
    applySri(s, 'i18n.js');
    s.src = basePath + 'i18n.js';
    document.body.appendChild(s);
  }

  function loadNext() {
    if (loaded >= total) {
      loadEngine();
      return;
    }
    var key = 'i18n/' + LOCALES[loaded] + '.js';
    var s = document.createElement('script');
    applySri(s, key);
    s.src = basePath + key;
    s.onload = function () {
      loaded++;
      loadNext();
    };
    s.onerror = function () {
      // Pack fetch failed (network / 404 / SRI mismatch). Continue loading
      // the rest; i18n.js engine will fall back to DEFAULT for any missing
      // locale rather than break the whole page.
      loaded++;
      loadNext();
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
    fetchManifest(loadNext);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
