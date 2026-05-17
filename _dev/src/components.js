/**
 * Keeply Website — Shared Components (Nav + Footer)
 * 注入共用的導覽列、頁尾、手機浮動下載 CTA 到頁面中。
 *
 * 用法：HTML 中放置 <div id="nav-root"></div> 和 <div id="footer-root"></div>
 * 此腳本以 defer 載入，DOM ready 後自動注入。
 *
 * Spec 043 結構：
 *   - 主 nav 4 項：對比 / 定價 / 安裝 / 部落格 + 免費下載 CTA
 *   - 桌面：4 項全顯示
 *   - 手機：4 項收進漢堡選單；下載 CTA 浮動置底（thumb-zone）
 */
(function () {
  // 偵測語言子目錄前綴（例如 /en/, /zh-TW/, /ja/）
  var path = location.pathname;
  var localeMatch = path.match(/^\/([a-z]{2}(?:-[A-Z]{2})?)\//);
  var localeCode = localeMatch ? localeMatch[1] : null;
  var localePrefix = localeMatch ? '/' + localeMatch[1] + '/' : '';

  // === 跨子網域 locale 一致性（blog.keeply.work）===
  // Blog 端讀 .keeply.work 範圍的 keeply_locale cookie 走 fallback chain。
  // 主站每頁載入時：(1) 寫 cookie (2) Blog 連結 href 帶 locale path。
  // Blog 的 SUPPORTED 必須與此清單嚴格一致（大小寫、code 對齊）。
  var BLOG_SUPPORTED = [
    'en', 'zh-tw', 'zh-cn', 'ja', 'ko', 'de', 'es', 'fr', 'it', 'pt',
    'ru', 'nl', 'pl', 'tr', 'vi', 'th', 'id', 'ar', 'hi'
  ];
  // 主站 URL 第一段（zh-TW / zh-CN / en / …）normalize 為 blog locale code。
  // 主站 root 顯示繁中（與 install/compare 一致），對應 blog 'zh-tw'。
  var blogLocale = null;
  if (localeCode) {
    var normalized = localeCode.toLowerCase();
    if (BLOG_SUPPORTED.indexOf(normalized) !== -1) blogLocale = normalized;
  } else {
    blogLocale = 'zh-tw';
  }

  // 在 .keeply.work 子網域可讀的 cookie；非 HTTPS 或非 keeply.work 主機略過。
  (function writeLocaleCookie() {
    try {
      if (!blogLocale) return;
      if (location.protocol !== 'https:') return;
      var host = location.hostname;
      if (host !== 'keeply.work' && host.indexOf('.keeply.work') === -1) return;
      var m = document.cookie.match(/(?:^|;\s*)keeply_locale=([^;]+)/);
      if (m && decodeURIComponent(m[1]) === blogLocale) return;
      document.cookie = 'keeply_locale=' + blogLocale +
        '; domain=.keeply.work; path=/; max-age=31536000; SameSite=Lax; Secure';
    } catch (e) {}
  })();

  // Blog 連結：在 blog SUPPORTED 內 → 直接帶 locale path；否則 fallback root。
  var blogLink = blogLocale
    ? 'https://blog.keeply.work/' + blogLocale + '/'
    : 'https://blog.keeply.work/';

  // 首頁判斷
  var isHome = path === '/' || path.endsWith('/index.html') || path.endsWith('/keeply-website/') || path === '';
  if (localeMatch) {
    var subPath = path.substring(localeMatch[0].length);
    isHome = subPath === '' || subPath === 'index.html';
  }
  if (location.protocol === 'file:') {
    isHome = path.endsWith('index.html') || path.endsWith('/');
  }

  // === 連結路由表 ===
  var logoLink = isHome ? '#' : localePrefix + 'index.html';
  var downloadLink = isHome ? '#download' : localePrefix + 'index.html#download';
  var pricingLink = isHome ? '#pricing' : (localePrefix || '/') + '#pricing';

  // install.html（spec 043 Stage 2 + bug-fix）：6 core locale 各有母語版；
  // 13 其他 locale fallback /en/install.html；root pages（無 locale prefix）
  // 因為 root 顯示繁中（spec 043 C），nav 從 root 點「安裝」應連到 /zh-TW/install.html
  var INSTALL_LOCALES = {
    'en': '/en/install.html',
    'zh-TW': '/zh-TW/install.html',
    'zh-CN': '/zh-CN/install.html',
    'ja': '/ja/install.html',
    'ko': '/ko/install.html',
    'it': '/it/install.html'
  };
  var installLink;
  if (localeCode === null) {
    installLink = '/zh-TW/install.html'; // root = zh-TW 顯示
  } else {
    installLink = INSTALL_LOCALES[localeCode] || '/en/install.html';
  }

  // compare hub：en（root level）+ zh-TW 各有獨立版本；17 其他 locale
  // fallback 到 /compare/（en）；root pages 因為顯示繁中 → /zh-TW/compare/
  var COMPARE_LOCALES = { en: '/compare/', 'zh-TW': '/zh-TW/compare/' };
  var compareLink;
  if (localeCode === null) {
    compareLink = '/zh-TW/compare/'; // root = zh-TW 顯示
  } else {
    compareLink = COMPARE_LOCALES[localeCode] || '/compare/';
  }

  // === SVG ===
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

  var FOOTER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none" class="w-7 h-7">'
    + '<g>'
    + '<path d="M396 129C429 159 448 200 448 255C448 363 360 451 252 451C145 451 58 368 56 263C55 206 75 158 111 123" stroke="#6366f1" stroke-width="44" stroke-linecap="round"/>'
    + '<path d="M111 123C145 91 190 72 239 72C253 72 265 73 278 76" stroke="#fbbf24" stroke-width="44" stroke-linecap="round"/>'
    + '<path d="M236 54L313 79L254 134L236 54Z" fill="#fbbf24"/>'
    + '<rect x="164" y="184" width="152" height="206" rx="32" fill="#6366f1"/>'
    + '</g></svg>';

  // === 4 個主 nav 連結（桌面 + 手機共用 markup）===
  function navLink(href, key, fallback, extraClass, isExternal) {
    var ext = isExternal ? ' target="_blank" rel="noopener"' : '';
    var cls = 'text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors' + (extraClass ? ' ' + extraClass : '');
    return '<a href="' + href + '"' + ext + ' class="' + cls + '" data-i18n="' + key + '">' + fallback + '</a>';
  }

  var navLinks = [
    { href: compareLink,  key: 'nav.compare',  label: '對比',     external: false },
    { href: pricingLink,  key: 'nav.pricing',  label: '定價',     external: false },
    { href: installLink,  key: 'nav.install',  label: '安裝指南', external: false },
    { href: blogLink, key: 'nav.blog', label: '部落格', external: true }
  ];

  function renderNavLinks(extraClass) {
    return navLinks.map(function (l) {
      return navLink(l.href, l.key, l.label, extraClass, l.external);
    }).join('');
  }

  // === NAV（桌面 + 手機 collapsed 狀態）===
  var navHTML = '<nav class="fixed top-0 w-full bg-white/80 backdrop-blur-lg border-b border-gray-100 z-50">'
    + '<div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">'
    // logo
    + '<a href="' + logoLink + '" class="flex items-center gap-3">'
    + NAV_SVG
    + '<span class="text-xl font-bold text-brand-700">Keeply</span>'
    + '</a>'
    // 右側：桌面 4 連結 + lang + 下載；手機 lang + 漢堡
    + '<div class="flex items-center gap-3">'
    // 桌面 4 連結（hidden md:flex）
    + '<div class="hidden md:flex items-center gap-5">'
    + renderNavLinks()
    + '</div>'
    // 語言切換（桌面與手機都顯示）
    + '<div id="lang-switcher" class="relative">'
    + '<button id="lang-toggle" class="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-brand-600 border border-gray-200 hover:border-brand-300 px-3 py-1.5 rounded-full transition-all">'
    + '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
    + '<span id="lang-label">繁體中文</span>'
    + '<svg class="w-3 h-3 opacity-50" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>'
    + '</button>'
    + '</div>'
    // 桌面下載 CTA（hidden md:inline-flex）
    + '<a href="' + downloadLink + '" class="hidden md:inline-flex bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-5 py-2.5 rounded-full transition-all hover:shadow-lg hover:shadow-brand-600/25" data-i18n="nav.download">'
    + '免費下載'
    + '</a>'
    // 手機漢堡按鈕（md:hidden）
    + '<button id="nav-burger" aria-label="開啟選單" aria-expanded="false" aria-controls="nav-drawer" class="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-full text-gray-700 hover:bg-gray-100 transition-colors">'
    + '<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>'
    + '</button>'
    + '</div>'
    + '</div>'
    // === 手機側拉選單（drawer + backdrop）===
    + '<div id="nav-drawer-backdrop" class="md:hidden fixed inset-0 bg-black/40 z-40 opacity-0 pointer-events-none transition-opacity duration-200"></div>'
    + '<div id="nav-drawer" class="md:hidden fixed top-0 right-0 h-full w-72 max-w-[80vw] bg-white shadow-2xl z-50 transform translate-x-full transition-transform duration-200 flex flex-col" role="dialog" aria-label="主選單">'
    + '<div class="flex items-center justify-between p-4 border-b border-gray-100">'
    + '<span class="text-sm font-bold text-gray-700" data-i18n="nav.menu">選單</span>'
    + '<button id="nav-drawer-close" aria-label="關閉選單" class="inline-flex items-center justify-center w-10 h-10 rounded-full text-gray-700 hover:bg-gray-100">'
    + '<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>'
    + '</button>'
    + '</div>'
    + '<nav class="flex flex-col py-2">'
    + navLinks.map(function (l) {
        var ext = l.external ? ' target="_blank" rel="noopener"' : '';
        return '<a href="' + l.href + '"' + ext + ' class="block px-6 py-3 text-base font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors" data-i18n="' + l.key + '">' + l.label + '</a>';
      }).join('')
    + '</nav>'
    + '</div>'
    + '</nav>'
    // === 手機浮動下載 CTA（thumb-zone）===
    + '<a href="' + downloadLink + '" class="md:hidden fixed bottom-4 left-4 right-4 z-40 bg-brand-600 hover:bg-brand-700 text-white text-base font-medium px-6 py-3.5 rounded-full text-center shadow-lg shadow-brand-600/30 transition-all" data-i18n="nav.download">'
    + '免費下載'
    + '</a>';

  // === FOOTER ===
  var footerHTML = '<footer class="bg-gray-900 text-gray-400 py-12 pb-24 md:pb-12">'
    + '<div class="max-w-6xl mx-auto px-6">'
    + '<div class="flex flex-col md:flex-row items-center justify-between gap-6">'
    + '<div class="flex items-center gap-3">'
    + FOOTER_SVG
    + '<span class="text-white font-bold">Keeply</span>'
    + '</div>'
    + '<div class="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">'
    + '<a href="' + localePrefix + 'privacy.html" class="hover:text-white transition-colors" data-i18n="footer.privacy">隱私權政策</a>'
    + '<a href="' + localePrefix + 'terms.html" class="hover:text-white transition-colors" data-i18n="footer.terms">服務條款</a>'
    + '<a href="' + localePrefix + 'refund.html" class="hover:text-white transition-colors" data-i18n="footer.refund">退款政策</a>'
    + '<a href="' + compareLink + '" class="hover:text-white transition-colors" data-i18n="footer.compare">對比</a>'
    + '<a href="' + installLink + '" class="hover:text-white transition-colors" data-i18n="footer.install">安裝指南</a>'
    + '<a href="' + blogLink + '" target="_blank" rel="noopener" class="hover:text-white transition-colors" data-i18n="footer.blog">部落格</a>'
    + '<a href="' + localePrefix + 'buy.html" class="text-amber-400 hover:text-amber-300 font-semibold transition-colors" data-i18n="footer.buy">購買永久授權</a>'
    + '<a href="' + localePrefix + 'activate.html" class="hover:text-white transition-colors" data-i18n="footer.activate">啟用授權</a>'
    + '<a href="https://github.com/boy1690/keeply-releases/releases/latest" class="hover:text-white transition-colors" data-i18n="footer.download">下載</a>'
    + '<a href="#cookie-settings" data-cookie-settings class="hover:text-white transition-colors" data-i18n="footer.cookie-settings">Cookie 設定</a>'
    + '<a href="' + localePrefix + 'contact.html" class="hover:text-white transition-colors" data-i18n="footer.contact">聯繫我們</a>'
    + '</div>'
    + '<div class="flex flex-col items-center md:items-end text-sm gap-1">'
    + '<p data-i18n="footer.copyright">&copy; 2026 Keeply. All rights reserved.</p>'
    + '<p class="text-gray-500" data-i18n-html="footer.founder-byline">由創辦人 <a href="https://www.linkedin.com/in/ting-wei-tsao-b57480152/" class="underline hover:text-white" rel="noopener" target="_blank">Tsao Ting Wei (曹庭維)</a> 親手打造。</p>'
    + '</div>'
    + '</div>'
    + '</div>'
    + '</footer>';

  // === 漢堡選單行為 ===
  function wireDrawer() {
    var burger = document.getElementById('nav-burger');
    var drawer = document.getElementById('nav-drawer');
    var backdrop = document.getElementById('nav-drawer-backdrop');
    var closeBtn = document.getElementById('nav-drawer-close');
    if (!burger || !drawer || !backdrop) return;

    function open() {
      drawer.classList.remove('translate-x-full');
      backdrop.classList.remove('opacity-0', 'pointer-events-none');
      backdrop.classList.add('opacity-100');
      burger.setAttribute('aria-expanded', 'true');
    }
    function close() {
      drawer.classList.add('translate-x-full');
      backdrop.classList.add('opacity-0', 'pointer-events-none');
      backdrop.classList.remove('opacity-100');
      burger.setAttribute('aria-expanded', 'false');
    }

    burger.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
    // 點 drawer 內任何連結都關閉
    drawer.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', close);
    });
  }

  // === INJECT ===
  function inject() {
    var navRoot = document.getElementById('nav-root');
    var footerRoot = document.getElementById('footer-root');
    if (navRoot) navRoot.innerHTML = navHTML;
    if (footerRoot) footerRoot.innerHTML = footerHTML;
    wireDrawer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
