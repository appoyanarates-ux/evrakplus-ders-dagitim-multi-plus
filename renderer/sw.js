'use strict';

const CACHE_NAME = 'dersoptime-pwa-v1.0.4';
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.js',
  './clubs_module.js',
  './multi_solver_ui.js',
  './editor_logic.js',
  './export_engine.js',
  './duty_module.js',
  './web_evrakplus_bridge.js',
  './evrakplus_ui.js',
  './system_ui.js',
  './pwa_install.js',
  './manifest.webmanifest',
  './assets/styles.css',
  './assets/lucide.min.js',
  './assets/xlsx.full.min.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        STATIC_ASSETS.map((url) =>
          fetch(new Request(url, { cache: 'reload' }))
            .then((resp) => (resp && resp.ok ? cache.put(url, resp) : null))
            .catch(() => null)
        )
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // API isteklerini asla önbelleğe alma
  if (url.pathname.includes('/wp-json/')) return;
  if (url.origin !== self.location.origin) return;

  // Gezinme istekleri için çevrimdışı index.html yedeği (Network-first -> Cache)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put('./index.html', clone));
          }
          return resp;
        })
        .catch(() => caches.match('./index.html', { ignoreSearch: true }))
    );
    return;
  }

  // Kod ve stil dosyaları (.js, .css, .html, .webmanifest) için Network-first -> Cache
  // Böylece cPanel / sunucu güncellemeleri asla eski önbellekte takılı kalmaz
  const isCodeOrStyle = /\.(js|css|html|webmanifest)$/i.test(url.pathname);
  if (isCodeOrStyle) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200 && resp.type === 'basic') {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return resp;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }

  // Simge ve görseller için Cache-first -> Network
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        }
        return resp;
      });
    })
  );
});
