const CACHE_NAME = 'evrakplus-multiplus-v1.0.0';
const APP_SHELL = [
  './index.php',
  './manifest.json',
  './assets/css/styles.css',
  './assets/js/app.js',
  './assets/js/pwa-idb.js',
  './assets/js/pwa-capabilities.js',
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || req.url.includes('/api/')) return;
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(resp => {
        if (resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

// İnternet bağlantısı geri geldiğinde bekleyen senkronizasyonu tetikle
self.addEventListener('sync', event => {
  if (event.tag === 'evrakplus-sync') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(c => c.postMessage({ type: 'EVRAKPLUS_SYNC_FLUSH' }));
      })
    );
  }
});
