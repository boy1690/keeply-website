(function () {
  var PADDLE_TOKEN = 'live_726f0f875b0763c28ad33b316b0';
  var PADDLE_PRICE_ID = 'pri_01kp64ptv624b460p1hak579s9';

  var btn = null;

  function initPaddle() {
    if (typeof Paddle === 'undefined') {
      console.error('[Keeply] Paddle.js failed to load — check network or ad-blocker');
      return false;
    }
    try {
      Paddle.Initialize({
        token: PADDLE_TOKEN,
        eventCallback: function(data) {
          if (data.name === 'checkout.completed') {
            var txnId = data.data && (data.data.transaction_id || data.data.id);
            if (txnId) {
              window.location.href = 'activate.html?txn=' + encodeURIComponent(txnId);
            }
          }
        }
      });
      return true;
    } catch (e) {
      console.error('[Keeply] Paddle.Initialize failed:', e);
      return false;
    }
  }

  // Paddle supports these locales for checkout UI:
  //   en, fr, de, es, it, nl, pl, pt, ru, zh-Hans, ja, da, no, sv, cs,
  //   sk, hu, tr, el, ar, bg, fi, ko, he, ro, uk, hr, lt, lv, ms, th,
  //   vi, hi, id, et, sl, sr
  // Notably NO zh-Hant/zh-TW support. For Traditional Chinese pages we
  // fall back to English to avoid forcing Simplified Chinese on zh-Hant
  // readers.
  function paddleLocale() {
    var lang = document.documentElement.lang || 'en';
    if (lang === 'zh-Hant' || lang === 'zh-TW') return 'en';
    return lang.split('-')[0];
  }

  function handleClick() {
    if (typeof Paddle === 'undefined') {
      console.error('[Keeply] Paddle.js not available — click ignored');
      return;
    }
    var previousText = btn.textContent;
    btn.disabled = true;
    var lang = document.documentElement.lang || 'en';
    var loading = (window.__i18n
      && window.__i18n[lang]
      && window.__i18n[lang]['buy.button.loading']) || previousText;
    btn.textContent = loading;

    try {
      Paddle.Checkout.open({
        items: [{ priceId: PADDLE_PRICE_ID, quantity: 1 }],
        settings: {
          displayMode: 'overlay',
          theme: 'light',
          locale: paddleLocale()
        }
      });
    } catch (e) {
      console.error('[Keeply] Paddle.Checkout.open failed:', e);
    } finally {
      setTimeout(function () {
        btn.disabled = false;
        btn.textContent = previousText;
      }, 2000);
    }
  }

  function init() {
    btn = document.getElementById('buy-button');
    if (!btn) {
      console.warn('[Keeply] #buy-button not found');
      return;
    }
    initPaddle();
    btn.addEventListener('click', handleClick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
