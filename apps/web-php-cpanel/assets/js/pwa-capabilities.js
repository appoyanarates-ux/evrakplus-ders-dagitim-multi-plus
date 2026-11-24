/**
 * Tarayıcı ve mobil cihaz yeteneklerini gerçek değerlerle raporlar.
 * Desteklenmeyen PWA özelliklerini asla destekleniyormuş gibi göstermez.
 */
export function detectPwaCapabilities(env = {}) {
  const nav = env.navigator ?? (typeof navigator !== 'undefined' ? navigator : {});
  const win = env.window ?? (typeof window !== 'undefined' ? window : {});
  const ua = String(nav.userAgent || '');

  const isIOS = /iPad|iPhone|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid || /Mobile|Tablet/i.test(ua);
  const hasServiceWorker = Boolean(nav.serviceWorker);
  const hasIndexedDB = typeof (env.indexedDB ?? (typeof indexedDB !== 'undefined' ? indexedDB : undefined)) !== 'undefined';
  const isStandalone = Boolean(
    nav.standalone === true ||
    (typeof win.matchMedia === 'function' && win.matchMedia('(display-mode: standalone)').matches)
  );
  const isOnline = nav.onLine !== false;
  const canRunLocalNativeSolvers = Boolean(win.evrakplusBridge);

  let installGuidance = 'Tarayıcınız PWA kurulumunu destekliyor; üst çubuktaki "Uygulamayı Yükle" butonunu kullanabilirsiniz.';
  if (isStandalone) {
    installGuidance = 'Uygulama ana ekrana yüklü (standalone) modda çalışıyor.';
  } else if (isIOS) {
    installGuidance = 'iOS Safari: Paylaş simgesine dokunup "Ana Ekrana Ekle" seçeneğini kullanın.';
  } else if (!hasServiceWorker) {
    installGuidance = 'Bu tarayıcı/bağlam (ör. HTTPS dışı ortam) Service Worker kurulumunu desteklemiyor.';
  }

  return {
    isIOS,
    isAndroid,
    isMobile,
    hasServiceWorker,
    hasIndexedDB,
    isStandalone,
    isOnline,
    offlineReady: hasServiceWorker && hasIndexedDB,
    canRunLocalNativeSolvers,
    recommendedSolverBackend: canRunLocalNativeSolvers
      ? 'desktop_local_6_engines'
      : 'solver_server_or_paired_desktop',
    installGuidance
  };
}
