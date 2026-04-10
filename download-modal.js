/**
 * Keeply Download Modal — 臨時攔截下載連結
 *
 * 認證完成後移除此 script 即可恢復原本下載行為。
 * 移除步驟：刪除此檔案 + 各頁面的 <script src="download-modal.js"> 標籤 + i18n key modal.download.*
 */
(function () {
  var RELEASE_URL = 'github.com/boy1690/Keeply/releases';
  var MODAL_ID = 'keeply-download-modal';
  var lastTrigger = null;

  function createModal() {
    if (document.getElementById(MODAL_ID)) return;

    var overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4';
    overlay.style.cssText = 'background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);animation:keeplyFadeIn .2s ease-out';

    var modal = document.createElement('div');
    modal.className = 'bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative';
    modal.style.cssText = 'animation:keeplySlideUp .3s ease-out';

    modal.innerHTML =
      '<button id="keeply-modal-close-x" style="position:absolute;top:1rem;right:1rem;background:none;border:none;cursor:pointer;padding:0.25rem;color:#9ca3af" aria-label="Close">'
      + '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>'
      + '</button>'
      + '<div style="display:flex;justify-content:center;margin-bottom:1.5rem">'
      + '<div style="width:4rem;height:4rem;background:#eef2ff;border-radius:9999px;display:flex;align-items:center;justify-content:center">'
      + '<svg width="32" height="32" fill="none" stroke="#4f46e5" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
      + '</div>'
      + '</div>'
      + '<h2 style="font-size:1.5rem;font-weight:700;color:#111827;text-align:center;margin:0 0 0.75rem" data-i18n="modal.download.title">\u5373\u5c07\u63a8\u51fa</h2>'
      + '<p style="color:#4b5563;text-align:center;line-height:1.6;margin:0 0 2rem" data-i18n="modal.download.body">Keeply \u6b63\u5728\u9032\u884c\u6700\u7d42\u6e96\u5099\uff0c\u8fd1\u671f\u5c07\u6b63\u5f0f\u4e0a\u7dda\u3002\u611f\u8b1d\u60a8\u7684\u95dc\u6ce8\uff01</p>'
      + '<button id="keeply-modal-close-btn" style="width:100%;background:#4f46e5;color:#fff;font-weight:500;padding:0.75rem 1.5rem;border:none;border-radius:9999px;cursor:pointer;font-size:1rem;transition:background .2s" data-i18n="modal.download.close">\u6211\u77e5\u9053\u4e86</button>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Add animations if not present
    if (!document.getElementById('keeply-modal-style')) {
      var style = document.createElement('style');
      style.id = 'keeply-modal-style';
      style.textContent =
        '@keyframes keeplyFadeIn{from{opacity:0}to{opacity:1}}'
        + '@keyframes keeplySlideUp{from{opacity:0;transform:translateY(20px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}'
        + '#keeply-modal-close-btn:hover{background:#4338ca}'
        + '#keeply-modal-close-x:hover{color:#374151}';
      document.head.appendChild(style);
    }

    // Close handlers
    function close() {
      var el = document.getElementById(MODAL_ID);
      if (el) el.remove();
      if (lastTrigger) {
        lastTrigger.focus();
        lastTrigger = null;
      }
    }

    document.getElementById('keeply-modal-close-x').addEventListener('click', close);
    document.getElementById('keeply-modal-close-btn').addEventListener('click', close);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', handler);
      }
    });

    // Trigger i18n translation if available
    if (window.__keeplyI18n) {
      window.__keeplyI18n.setLang(window.__keeplyI18n.currentLang());
    }

    // Focus the close button for accessibility
    var closeBtn = document.getElementById('keeply-modal-close-btn');
    if (closeBtn) closeBtn.focus();
  }

  // Event delegation: intercept all clicks on links containing the release URL
  document.addEventListener('click', function (e) {
    var target = e.target.closest('a[href]');
    if (!target) return;
    var href = target.getAttribute('href') || '';
    if (href.indexOf(RELEASE_URL) !== -1) {
      e.preventDefault();
      e.stopPropagation();
      // Prevent duplicate modals
      if (document.getElementById(MODAL_ID)) return;
      lastTrigger = target;
      createModal();
    }
  });
})();
