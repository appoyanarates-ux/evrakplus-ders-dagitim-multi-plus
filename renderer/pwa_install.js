'use strict';

(function (root) {
  let deferredPrompt = null;

  function isStandalonePwa() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || window.navigator.standalone === true
      || Boolean(window.dersDagitimAPI);
  }

  function isIosDevice() {
    const ua = window.navigator.userAgent || '';
    return /iphone|ipad|ipod/i.test(ua);
  }

  function showInstallButtons() {
    const btn = document.getElementById('btnMobilePwaInstall');
    if (btn && !isStandalonePwa()) {
      btn.classList.remove('hidden');
      btn.classList.add('inline-flex');
    }
  }

  function hideInstallButtons() {
    const btn = document.getElementById('btnMobilePwaInstall');
    if (btn) {
      btn.classList.add('hidden');
      btn.classList.remove('inline-flex');
    }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return;
    }
    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
      .then((reg) => { if (reg && typeof reg.update === 'function') reg.update().catch(() => {}); })
      .catch(() => {});
  }

  function syncBottomNavActive(activeView, m6Tab) {
    const nav = document.getElementById('mobileBottomNav');
    if (!nav) return;
    const currentKey = (activeView === 'menu6' && m6Tab === 'duty') ? 'duty' : activeView;
    nav.querySelectorAll('.mob-nav-btn').forEach((btn) => {
      const isAct = btn.dataset.mobNav === currentKey;
      btn.classList.toggle('text-indigo-600', isAct);
      btn.classList.toggle('font-bold', isAct);
      btn.classList.toggle('text-slate-500', !isAct);
    });
  }

  function initPwa(hooks) {
    registerServiceWorker();

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showInstallButtons();
    });

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      hideInstallButtons();
      if (hooks && hooks.showToast) hooks.showToast('EvrakPlus Ders Dağıtım ana ekrana eklendi!');
    });

    // iOS Safari'de "Ana Ekrana Ekle" yardımı için butonu göster
    if (isIosDevice() && !isStandalonePwa()) {
      showInstallButtons();
    }

    const installBtn = document.getElementById('btnMobilePwaInstall');
    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          try { await deferredPrompt.userChoice; } catch (_e) {}
          deferredPrompt = null;
          hideInstallButtons();
        } else if (isIosDevice()) {
          if (hooks && hooks.showToast) {
            hooks.showToast('iPhone/iPad: Alt menüden Paylaş (↑) → "Ana Ekrana Ekle"ye dokunun.');
          }
        }
      });
    }

    // Alt mobil gezinme çubuğu tıklamaları
    const nav = document.getElementById('mobileBottomNav');
    if (nav && hooks && typeof hooks.navigateMobile === 'function') {
      nav.querySelectorAll('.mob-nav-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          hooks.navigateMobile(btn.dataset.mobNav);
        });
      });
    }

    // URL hash kısayolları (#menu6, #duty)
    if (hooks && typeof hooks.navigateMobile === 'function') {
      const h = (window.location.hash || '').replace(/^#/, '');
      if (h === 'duty' || h === 'menu6') {
        hooks.navigateMobile(h);
      }
    }
  }

  root.EvrakPlusPWA = {
    init: initPwa,
    syncBottomNavActive
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
