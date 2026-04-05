/**
 * Keeply Website — i18n Loader
 * 動態載入所有語言包和 i18n 引擎。
 * 取代每個 HTML 中重複的 19 個 <script> 標籤。
 *
 * 載入順序：語言包（同步依序）→ i18n.js（引擎）
 * 確保 window.__i18n 在引擎執行前已填入所有翻譯。
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

  function loadEngine() {
    var s = document.createElement('script');
    s.src = basePath + 'i18n.js';
    document.body.appendChild(s);
  }

  function loadNext() {
    if (loaded >= total) {
      loadEngine();
      return;
    }
    var s = document.createElement('script');
    s.src = basePath + 'i18n/' + LOCALES[loaded] + '.js';
    s.onload = function () {
      loaded++;
      loadNext();
    };
    s.onerror = function () {
      loaded++;
      loadNext();
    };
    document.body.appendChild(s);
  }

  // 開始依序載入
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNext);
  } else {
    loadNext();
  }
})();
