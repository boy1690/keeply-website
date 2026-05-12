/**
 * Keeply Website — Shared Components (Nav + Footer)
 * 注入共用的導覽列和頁尾到頁面中。
 *
 * 用法：HTML 中放置 <div id="nav-root"></div> 和 <div id="footer-root"></div>
 * 此腳本以 defer 載入，DOM ready 後自動注入。
 */
(function () {
  // 偵測語言子目錄前綴（例如 /en/, /zh-TW/, /ja/）
  var path = location.pathname;
  var localeMatch = path.match(/^\/([a-z]{2}(?:-[A-Z]{2})?)\//);
  var localePrefix = localeMatch ? '/' + localeMatch[1] + '/' : '';

  // 偵測是否為首頁（根目錄語言選擇頁或語言子目錄首頁）
  var isHome = path === '/' || path.endsWith('/index.html') || path.endsWith('/keeply-website/') || path === '';
  // 語言子目錄首頁也算首頁
  if (localeMatch) {
    var subPath = path.substring(localeMatch[0].length);
    isHome = subPath === '' || subPath === 'index.html';
  }
  // file:// 協議下的判斷
  if (location.protocol === 'file:') {
    isHome = path.endsWith('index.html') || path.endsWith('/');
  }

  var logoLink = isHome ? '#' : localePrefix + 'index.html';
  var downloadLink = isHome ? '#download' : localePrefix + 'index.html#download';

  // === NAV ===
  var NAV_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none" class="w-9 h-9">'
    + '<defs>'
    + '<linearGradient id="ring" x1="80" y1="404" x2="434" y2="112" gradientUnits="userSpaceOnUse">'
    + '<stop offset="0" stop-color="#4338CA"/><stop offset="1" stop-color="#4F46E5"/>'
    + '</linearGradient>'
    + '<linearGradient id="amber" x1="115" y1="171" x2="270" y2="82" gradientUnits="userSpaceOnUse">'
    + '<stop offset="0" stop-color="#F59E0B"/><stop offset="1" stop-color="#FFB300"/>'
    + '</linearGradient>'
    + '<linearGradient id="doc-front" x1="166" y1="164" x2="308" y2="372" gradientUnits="userSpaceOnUse">'
    + '<stop offset="0" stop-color="#5D54F6"/><stop offset="1" stop-color="#4F46E5"/>'
    + '</linearGradient>'
    + '<linearGradient id="doc-back" x1="208" y1="160" x2="364" y2="350" gradientUnits="userSpaceOnUse">'
    + '<stop offset="0" stop-color="#9C98FF"/><stop offset="1" stop-color="#6F6AF0"/>'
    + '</linearGradient>'
    + '</defs>'
    + '<g>'
    + '<path d="M396 129C429 159 448 200 448 255C448 363 360 451 252 451C145 451 58 368 56 263C55 206 75 158 111 123" stroke="url(#ring)" stroke-width="44" stroke-linecap="round"/>'
    + '<path d="M111 123C145 91 190 72 239 72C253 72 265 73 278 76" stroke="url(#amber)" stroke-width="44" stroke-linecap="round"/>'
    + '<path d="M236 54L313 79L254 134L236 54Z" fill="url(#amber)"/>'
    + '<rect x="220" y="150" width="152" height="206" rx="32" fill="url(#doc-back)" opacity="0.48"/>'
    + '<rect x="192" y="167" width="152" height="206" rx="32" fill="url(#doc-back)" opacity="0.72"/>'
    + '<rect x="164" y="184" width="152" height="206" rx="32" fill="url(#doc-front)"/>'
    + '<path d="M250 184H316V247L250 184Z" fill="#BDBAFF" opacity="0.95"/>'
    + '</g></svg>';

  var navHTML = '<nav class="fixed top-0 w-full bg-white/80 backdrop-blur-lg border-b border-gray-100 z-50">'
    + '<div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">'
    + '<a href="' + logoLink + '" class="flex items-center gap-3">'
    + NAV_SVG
    + '<span class="text-xl font-bold text-brand-700">Keeply</span>'
    + '</a>'
    + '<div class="flex items-center gap-3">'
    + '<div id="lang-switcher" class="relative">'
    + '<button id="lang-toggle" class="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-brand-600 border border-gray-200 hover:border-brand-300 px-3 py-1.5 rounded-full transition-all">'
    + '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
    + '<span id="lang-label">繁體中文</span>'
    + '<svg class="w-3 h-3 opacity-50" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>'
    + '</button>'
    + '</div>'
    + '<a href="https://blog.keeply.work" target="_blank" rel="noopener" class="hidden sm:inline-block text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors" data-i18n="nav.blog">部落格</a>'
    + '<a href="' + downloadLink + '" class="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-5 py-2.5 rounded-full transition-all hover:shadow-lg hover:shadow-brand-600/25" data-i18n="nav.download">'
    + '免費下載'
    + '</a>'
    + '</div>'
    + '</div>'
    + '</nav>';

  // === FOOTER ===
  var FOOTER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none" class="w-7 h-7">'
    + '<g>'
    + '<path d="M396 129C429 159 448 200 448 255C448 363 360 451 252 451C145 451 58 368 56 263C55 206 75 158 111 123" stroke="#6366f1" stroke-width="44" stroke-linecap="round"/>'
    + '<path d="M111 123C145 91 190 72 239 72C253 72 265 73 278 76" stroke="#fbbf24" stroke-width="44" stroke-linecap="round"/>'
    + '<path d="M236 54L313 79L254 134L236 54Z" fill="#fbbf24"/>'
    + '<rect x="164" y="184" width="152" height="206" rx="32" fill="#6366f1"/>'
    + '</g></svg>';

  var footerHTML = '<footer class="bg-gray-900 text-gray-400 py-12">'
    + '<div class="max-w-6xl mx-auto px-6">'
    + '<div class="flex flex-col md:flex-row items-center justify-between gap-6">'
    + '<div class="flex items-center gap-3">'
    + FOOTER_SVG
    + '<span class="text-white font-bold">Keeply</span>'
    + '</div>'
    + '<div class="flex items-center gap-6 text-sm">'
    + '<a href="' + localePrefix + 'privacy.html" class="hover:text-white transition-colors" data-i18n="footer.privacy">隱私權政策</a>'
    + '<a href="' + localePrefix + 'terms.html" class="hover:text-white transition-colors" data-i18n="footer.terms">服務條款</a>'
    + '<a href="' + localePrefix + 'refund.html" class="hover:text-white transition-colors" data-i18n="footer.refund">退款政策</a>'
    + '<a href="https://blog.keeply.work" target="_blank" rel="noopener" class="hover:text-white transition-colors" data-i18n="footer.blog">部落格</a>'
    + '<a href="' + localePrefix + 'buy.html" class="text-amber-400 hover:text-amber-300 font-semibold transition-colors" data-i18n="footer.buy">購買永久授權</a>'
    + '<a href="https://github.com/boy1690/keeply-releases/releases/latest" class="hover:text-white transition-colors" data-i18n="footer.download">下載</a>'
    + '<a href="#cookie-settings" data-cookie-settings class="hover:text-white transition-colors" data-i18n="footer.cookie-settings">Cookie 設定</a>'
    + '<a href="' + localePrefix + 'contact.html" class="hover:text-white transition-colors" data-i18n="footer.contact">聯繫我們</a>'
    + '</div>'
    + '<p class="text-sm" data-i18n="footer.copyright">&copy; 2026 Keeply. All rights reserved.</p>'
    + '</div>'
    + '</div>'
    + '</footer>';

  // === INJECT ===
  function inject() {
    var navRoot = document.getElementById('nav-root');
    var footerRoot = document.getElementById('footer-root');
    if (navRoot) navRoot.innerHTML = navHTML;
    if (footerRoot) footerRoot.innerHTML = footerHTML;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
