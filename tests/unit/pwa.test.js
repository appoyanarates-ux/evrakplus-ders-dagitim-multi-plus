import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { detectPwaCapabilities } from '../../packages/ui-shared/public/pwa-capabilities.js';

test('PWA yetenek dedektörü iOS, Android, Masaüstü ve çevrimdışı durumlarını doğru raporlamalı', () => {
  const ios = detectPwaCapabilities({
    navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', serviceWorker: {}, onLine: true },
    window: {},
    indexedDB: {}
  });
  assert.equal(ios.isIOS, true);
  assert.equal(ios.isMobile, true);
  assert.equal(ios.canRunLocalNativeSolvers, false, 'Mobil cihazda yerel Windows EXE motorları çalıştırılmaz');
  assert.equal(ios.recommendedSolverBackend, 'solver_server_or_paired_desktop');
  assert.equal(ios.offlineReady, true);
  assert.ok(ios.installGuidance.includes('Ana Ekrana Ekle'));

  const noSw = detectPwaCapabilities({
    navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14)', onLine: false },
    window: {},
    indexedDB: undefined
  });
  assert.equal(noSw.isAndroid, true);
  assert.equal(noSw.isOnline, false);
  assert.equal(noSw.offlineReady, false, 'ServiceWorker/IndexedDB yokken offlineReady true olamaz');

  const desktop = detectPwaCapabilities({
    navigator: { userAgent: 'Electron/34', onLine: true },
    window: { evrakplusBridge: {} },
    indexedDB: {}
  });
  assert.equal(desktop.canRunLocalNativeSolvers, true);
  assert.equal(desktop.recommendedSolverBackend, 'desktop_local_6_engines');
});

test('Mobil PWA dosyaları (manifest, sw.js Background Sync, iOS meta, IndexedDB) eksiksiz olmalı', () => {
  const sw = fs.readFileSync(path.resolve('apps/web-php-cpanel/sw.js'), 'utf8');
  assert.ok(sw.includes('evrakplus-sync'));
  assert.ok(sw.includes('pwa-idb.js'));

  const phpIdx = fs.readFileSync(path.resolve('apps/web-php-cpanel/index.php'), 'utf8');
  assert.ok(phpIdx.includes('apple-mobile-web-app-capable'));
  assert.ok(phpIdx.includes('apple-touch-icon'));
  assert.ok(phpIdx.includes('manifest.json'));
});
