/**
 * Keeply — Cookie Consent Banner UI (spec 023)
 *
 * Renders the GDPR consent banner + preference panel. Pairs with consent-api.js
 * (loads before this script; exposes window.keeplyConsent).
 *
 * Responsibilities:
 *   - Decide whether to show banner on page load (based on consent-api state).
 *   - Render banner (bottom-fixed bar) + panel (centered modal) DOM.
 *   - Handle button clicks, keyboard (Tab trap, Esc close), prefers-reduced-motion.
 *   - Override window.keeplyConsent.openPanel() with the real modal-opening impl.
 *   - Delegate clicks on footer "Cookie settings" link (added via components.js).
 *
 * Design notes:
 *   - All text localised via `data-i18n` attributes — i18n.js translates after
 *     this script injects the DOM (defer order: cookie-banner.js before
 *     i18n-loader.js).
 *   - Never depends on external libraries. Tailwind classes from style.css only.
 *   - Fails silently if window.keeplyConsent is missing (should never happen
 *     given defer order, but defensive).
 */
(function () {
  'use strict';

  if (!window.keeplyConsent || typeof window.keeplyConsent.set !== 'function') {
    console.warn('[cookie-banner] keeplyConsent missing; banner disabled');
    return;
  }

  var BANNER_ID = 'cookie-banner';
  var PANEL_ID = 'cookie-panel';
  var OVERLAY_ID = 'cookie-overlay';

  var lastFocusedBeforePanel = null;
  var panelEscHandler = null;
  var panelTabHandler = null;

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ─── HTML builders ────────────────────────────────────────────────────────

  function buildBannerHTML() {
    // All user-visible text via data-i18n; fallback text below is zh-TW (template language).
    return (
      '<div id="' + BANNER_ID + '" role="region" aria-labelledby="cookie-banner-title" ' +
           'class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-[60] px-6 py-5">' +
        '<div class="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center gap-4">' +
          '<div class="flex-1">' +
            '<h3 id="cookie-banner-title" class="text-base font-bold text-gray-900 mb-1" ' +
                'data-i18n="cookie.banner.title">我們使用 cookies</h3>' +
            '<p class="text-sm text-gray-600 leading-relaxed">' +
              '<span data-i18n="cookie.banner.description">' +
                '用來改善你的使用體驗、記住語言偏好，以及了解網站如何被使用。你可以選擇要允許哪些類別。' +
              '</span> ' +
              '<a href="privacy.html" class="text-brand-600 hover:underline whitespace-nowrap" ' +
                 'data-i18n="cookie.banner.learn-more">了解更多</a>' +
            '</p>' +
          '</div>' +
          '<div class="flex flex-col sm:flex-row gap-2 shrink-0">' +
            '<button type="button" data-cookie-action="accept-all" ' +
                    'class="bg-brand-600 hover:bg-brand-700 text-white font-medium px-6 py-3 rounded-full transition-colors whitespace-nowrap" ' +
                    'data-i18n="cookie.banner.accept-all">全部接受</button>' +
            '<button type="button" data-cookie-action="reject-all" ' +
                    'class="bg-brand-600 hover:bg-brand-700 text-white font-medium px-6 py-3 rounded-full transition-colors whitespace-nowrap" ' +
                    'data-i18n="cookie.banner.reject-all">全部拒絕</button>' +
            '<button type="button" data-cookie-action="customize" ' +
                    'class="border-2 border-brand-600 text-brand-600 hover:bg-brand-50 font-medium px-6 py-3 rounded-full transition-colors whitespace-nowrap" ' +
                    'data-i18n="cookie.banner.customize">自訂偏好</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function buildPanelHTML(state) {
    var analyticsChecked = state && state.analytics ? ' checked' : '';
    var marketingChecked = state && state.marketing ? ' checked' : '';
    return (
      '<div id="' + OVERLAY_ID + '" class="fixed inset-0 bg-gray-900/60 z-[70]"></div>' +
      '<div id="' + PANEL_ID + '" role="dialog" aria-modal="true" ' +
           'aria-labelledby="cookie-panel-title" aria-describedby="cookie-panel-desc" ' +
           'class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 z-[71] max-h-[90vh] overflow-y-auto">' +
        '<div class="px-6 pt-6 pb-4 border-b border-gray-100">' +
          '<div class="flex items-start justify-between gap-4">' +
            '<div>' +
              '<h2 id="cookie-panel-title" class="text-xl font-bold text-gray-900" ' +
                  'data-i18n="cookie.panel.title">Cookie 偏好設定</h2>' +
              '<p id="cookie-panel-desc" class="text-sm text-gray-600 mt-1" ' +
                 'data-i18n="cookie.panel.description">' +
                '選擇你允許哪些類別的 cookies。隨時可從頁尾「Cookie 設定」連結回來修改。' +
              '</p>' +
            '</div>' +
            '<button type="button" data-cookie-action="close" ' +
                    'class="text-gray-400 hover:text-gray-600 -mt-1" aria-label="Close">' +
              '<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">' +
                '<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />' +
              '</svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="px-6 py-4 space-y-4">' +
          // Necessary — no toggle
          '<div class="flex items-start gap-4 py-3">' +
            '<div class="flex-1">' +
              '<div class="flex items-center gap-2 flex-wrap">' +
                '<h3 class="font-semibold text-gray-900" data-i18n="cookie.panel.necessary.name">必要</h3>' +
                '<span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium" ' +
                      'data-i18n="cookie.panel.necessary.badge">永遠啟用</span>' +
              '</div>' +
              '<p class="text-sm text-gray-600 mt-1" data-i18n="cookie.panel.necessary.description">' +
                '儲存你的語言選擇與同意偏好，網站正常運作必需。' +
              '</p>' +
            '</div>' +
          '</div>' +
          // Analytics
          '<div class="flex items-start gap-4 py-3 border-t border-gray-100">' +
            '<div class="flex-1">' +
              '<h3 class="font-semibold text-gray-900" data-i18n="cookie.panel.analytics.name">分析</h3>' +
              '<p class="text-sm text-gray-600 mt-1" data-i18n="cookie.panel.analytics.description">' +
                '幫助我們了解哪些功能被使用，讓 Keeply 越來越好。' +
              '</p>' +
            '</div>' +
            '<label class="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">' +
              '<input type="checkbox" role="switch" data-cookie-toggle="analytics" class="sr-only peer"' + analyticsChecked + ' />' +
              '<span class="w-11 h-6 bg-gray-300 peer-checked:bg-brand-600 rounded-full transition-colors peer-focus:ring-2 peer-focus:ring-brand-300"></span>' +
              '<span class="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow pointer-events-none"></span>' +
            '</label>' +
          '</div>' +
          // Marketing
          '<div class="flex items-start gap-4 py-3 border-t border-gray-100">' +
            '<div class="flex-1">' +
              '<h3 class="font-semibold text-gray-900" data-i18n="cookie.panel.marketing.name">行銷</h3>' +
              '<p class="text-sm text-gray-600 mt-1" data-i18n="cookie.panel.marketing.description">' +
                '用於廣告歸因與再行銷。預設關閉。' +
              '</p>' +
            '</div>' +
            '<label class="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">' +
              '<input type="checkbox" role="switch" data-cookie-toggle="marketing" class="sr-only peer"' + marketingChecked + ' />' +
              '<span class="w-11 h-6 bg-gray-300 peer-checked:bg-brand-600 rounded-full transition-colors peer-focus:ring-2 peer-focus:ring-brand-300"></span>' +
              '<span class="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow pointer-events-none"></span>' +
            '</label>' +
          '</div>' +
        '</div>' +
        '<div class="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row gap-2 justify-end">' +
          '<button type="button" data-cookie-action="cancel" ' +
                  'class="border-2 border-gray-300 text-gray-700 hover:bg-gray-50 font-medium px-6 py-3 rounded-full transition-colors" ' +
                  'data-i18n="cookie.panel.cancel">取消</button>' +
          '<button type="button" data-cookie-action="save" ' +
                  'class="bg-brand-600 hover:bg-brand-700 text-white font-medium px-6 py-3 rounded-full transition-colors" ' +
                  'data-i18n="cookie.panel.save">儲存偏好</button>' +
        '</div>' +
      '</div>'
    );
  }

  // ─── DOM insertion / removal ──────────────────────────────────────────────

  function insertBanner() {
    if (document.getElementById(BANNER_ID)) return;
    var wrapper = document.createElement('div');
    wrapper.innerHTML = buildBannerHTML();
    document.body.appendChild(wrapper.firstChild);
    attachBannerHandlers();
  }

  function removeBanner() {
    var el = document.getElementById(BANNER_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function insertPanel() {
    if (document.getElementById(PANEL_ID)) return;
    lastFocusedBeforePanel = document.activeElement;
    var state = window.keeplyConsent.get();
    var wrapper = document.createElement('div');
    wrapper.innerHTML = buildPanelHTML(state);
    // append both overlay and panel
    while (wrapper.firstChild) {
      document.body.appendChild(wrapper.firstChild);
    }
    attachPanelHandlers();
    // Focus first focusable inside panel (the close button) for WCAG dialog pattern.
    var panel = document.getElementById(PANEL_ID);
    var firstFocusable = panel.querySelector('button, [href], input, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) firstFocusable.focus();
  }

  function removePanel() {
    detachPanelHandlers();
    var overlay = document.getElementById(OVERLAY_ID);
    var panel = document.getElementById(PANEL_ID);
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    if (lastFocusedBeforePanel && typeof lastFocusedBeforePanel.focus === 'function') {
      try { lastFocusedBeforePanel.focus(); } catch (e) { /* ignore */ }
    }
    lastFocusedBeforePanel = null;
  }

  // ─── Event handlers ───────────────────────────────────────────────────────

  function onBannerClick(e) {
    var btn = e.target.closest ? e.target.closest('[data-cookie-action]') : null;
    if (!btn || !document.getElementById(BANNER_ID)) return;
    var action = btn.getAttribute('data-cookie-action');
    if (action === 'accept-all') {
      window.keeplyConsent.set({ analytics: true, marketing: true });
      removeBanner();
    } else if (action === 'reject-all') {
      window.keeplyConsent.set({ analytics: false, marketing: false });
      removeBanner();
    } else if (action === 'customize') {
      insertPanel();
    }
  }

  function attachBannerHandlers() {
    var banner = document.getElementById(BANNER_ID);
    if (banner) banner.addEventListener('click', onBannerClick);
  }

  function onPanelClick(e) {
    var btn = e.target.closest ? e.target.closest('[data-cookie-action]') : null;
    if (!btn) return;
    var action = btn.getAttribute('data-cookie-action');
    if (action === 'close' || action === 'cancel') {
      removePanel();
    } else if (action === 'save') {
      var analyticsEl = document.querySelector('[data-cookie-toggle="analytics"]');
      var marketingEl = document.querySelector('[data-cookie-toggle="marketing"]');
      window.keeplyConsent.set({
        analytics: analyticsEl ? analyticsEl.checked : false,
        marketing: marketingEl ? marketingEl.checked : false
      });
      removePanel();
      removeBanner();
    }
  }

  function onOverlayClick() {
    removePanel();
  }

  function onPanelKeydown(e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
      e.preventDefault();
      removePanel();
      return;
    }
    if (e.key === 'Tab' || e.keyCode === 9) {
      trapFocus(e);
    }
  }

  function trapFocus(e) {
    var panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    var focusables = panel.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function attachPanelHandlers() {
    var panel = document.getElementById(PANEL_ID);
    var overlay = document.getElementById(OVERLAY_ID);
    if (panel) panel.addEventListener('click', onPanelClick);
    if (overlay) overlay.addEventListener('click', onOverlayClick);
    panelEscHandler = onPanelKeydown;
    document.addEventListener('keydown', panelEscHandler, true);
  }

  function detachPanelHandlers() {
    if (panelEscHandler) {
      document.removeEventListener('keydown', panelEscHandler, true);
      panelEscHandler = null;
    }
  }

  // ─── Footer "Cookie settings" link (delegated) ────────────────────────────

  function onDocumentClick(e) {
    var link = e.target.closest ? e.target.closest('[data-cookie-settings]') : null;
    if (!link) return;
    e.preventDefault();
    window.keeplyConsent.openPanel();
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  // Override consent-api placeholder with real impl.
  window.keeplyConsent.openPanel = insertPanel;

  function init() {
    // Always wire up footer link, regardless of whether banner shows.
    document.addEventListener('click', onDocumentClick);

    // Show banner on first visit (no consent recorded).
    if (window.keeplyConsent.get() === null) {
      insertBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
