(function () {
  var WORKER_BASE = 'https://keeply-billing.boy1690.workers.dev';
  var MAX_ATTEMPTS = 15;
  var POLL_INTERVAL = 2000;

  var txn = new URLSearchParams(location.search).get('txn');

  function showState(id) {
    ['loading', 'ready', 'timeout', 'error'].forEach(function (s) {
      var el = document.getElementById('state-' + s);
      if (el) el.classList.toggle('hidden', s !== id);
    });
  }

  function showReady(data) {
    var keyEl = document.getElementById('license-key');
    var fullKey = data.key || '';
    keyEl.setAttribute('data-full-key', fullKey);
    if (keyEl) {
      if (fullKey.length > 24) {
        keyEl.textContent = fullKey.slice(0, 16) + ' •••••••• ' + fullKey.slice(-4);
      } else {
        keyEl.textContent = fullKey;
      }
    }

    var dlBtn = document.getElementById('deeplink-btn');
    if (dlBtn && data.deepLink) {
      dlBtn.href = data.deepLink;
    } else if (dlBtn) {
      dlBtn.style.display = 'none';
    }

    var emailEl = document.getElementById('customer-email');
    if (emailEl && data.email) {
      emailEl.textContent = data.email;
    }

    showState('ready');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setupCopy() {
    var btn = document.getElementById('copy-btn');
    var label = document.getElementById('copy-label');
    var keyEl = document.getElementById('license-key');
    if (!btn || !keyEl) return;

    btn.addEventListener('click', function () {
      var key = keyEl.getAttribute('data-full-key') || keyEl.textContent;
      if (!key) return;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(key).then(function () {
          showCopied(label);
        }).catch(function () {
          fallbackCopy(key, label);
        });
      } else {
        fallbackCopy(key, label);
      }
    });
  }

  function fallbackCopy(text, label) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showCopied(label); }
    catch (e) { /* silent */ }
    document.body.removeChild(ta);
  }

  function showCopied(label) {
    if (!label) return;
    var original = label.textContent;
    var lang = document.documentElement.lang || 'en';
    var copied = (window.__i18n && window.__i18n[lang] && window.__i18n[lang]['activate.ready.copied']) || '✓';
    label.textContent = copied;
    setTimeout(function () { label.textContent = original; }, 2000);
  }

  function setupRetry() {
    var retryBtn = document.getElementById('timeout-retry-btn');
    if (!retryBtn) return;
    retryBtn.addEventListener('click', function () {
      location.reload();
    });
  }

  var attempts = 0;

  function poll() {
    fetch(WORKER_BASE + '/license/lookup?txn=' + encodeURIComponent(txn))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.status === 'ready') {
          showReady(data);
        } else if (++attempts < MAX_ATTEMPTS) {
          setTimeout(poll, POLL_INTERVAL);
        } else {
          showState('timeout');
        }
      })
      .catch(function () {
        if (++attempts < MAX_ATTEMPTS) {
          setTimeout(poll, POLL_INTERVAL);
        } else {
          showState('timeout');
        }
      });
  }

  function init() {
    setupCopy();
    setupRetry();

    if (!txn) {
      showState('error');
      return;
    }

    showState('loading');
    poll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
