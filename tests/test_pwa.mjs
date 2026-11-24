import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const rendererDir = path.join(projectRoot, 'renderer');

test('Tüm renderer/*.js ve electron/*.cjs dosyaları sözdizimi (node --check) kontrolünden geçer', () => {
  for (const dir of [rendererDir, path.join(projectRoot, 'electron')]) {
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith('.js') || file.endsWith('.cjs')) {
        execFileSync(process.execPath, ['--check', path.join(dir, file)], { stdio: 'pipe' });
      }
    }
  }
});

test('Mobil PWA: Manifest, gerçek PNG simgeler (180/192/512), Service Worker, iOS/Android meta ve alt mobil menü', () => {
  const manifestPath = path.join(rendererDir, 'manifest.webmanifest');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './index.html');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3);

  const sizes = manifest.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192'), '192x192 simgesi eksik');
  assert.ok(sizes.includes('512x512'), '512x512 simgesi eksik');
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'), 'maskable simge eksik');

  // Tüm PNG simgeler gerçekten diskte ve geçerli PNG başlığına sahip olmalı
  for (const rel of ['assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-maskable-512.png', 'assets/apple-touch-icon.png']) {
    const abs = path.join(rendererDir, rel);
    assert.ok(fs.existsSync(abs), `PWA simgesi bulunamadı: ${rel}`);
    const hdr = fs.readFileSync(abs).subarray(0, 8);
    assert.deepEqual(Array.from(hdr), [137, 80, 78, 71, 13, 10, 26, 10], `Geçersiz PNG başlığı: ${rel}`);
  }

  // Service Worker tüm zorunlu dosyaları önbelleğe almalı ve /wp-json/ isteklerini atlamalı
  const sw = fs.readFileSync(path.join(rendererDir, 'sw.js'), 'utf8');
  for (const asset of ['./index.html', './app.js', './duty_module.js', './pwa_install.js', './assets/icon-192.png', './assets/icon-512.png']) {
    assert.ok(sw.includes(asset), `sw.js önbellek listesinde eksik: ${asset}`);
  }
  assert.ok(sw.includes('/wp-json/'), 'sw.js API isteklerini önbellek dışı bırakmalı');
  assert.ok(sw.includes('isCodeOrStyle'), 'sw.js JS/CSS dosyaları için Network-First kullanmalı');

  // HTML mobil PWA meta etiketleri ve alt gezinme çubuğu
  const html = fs.readFileSync(path.join(rendererDir, 'index.html'), 'utf8');
  assert.ok(html.includes('viewport-fit=cover'));
  assert.ok(html.includes('apple-mobile-web-app-capable'));
  assert.ok(html.includes('apple-touch-icon.png'));
  assert.ok(html.includes('id="btnMobilePwaInstall"'));
  assert.ok(html.includes('id="mobileBottomNav"'));
  assert.ok(html.includes('./pwa_install.js'));
  assert.ok(html.includes('./web_evrakplus_bridge.js'));
});

test('Web/Mobil PWA EvrakPlus Köprüsü: cihaz eşleştirme, proje senkronizasyonu, 409 çakışma ve token yenileme', async () => {
  const { createRequire } = await import('node:module');
  const req = createRequire(import.meta.url);
  const { createWebEvrakPlusBridge, isAllowedExternalUrl } = req('../renderer/web_evrakplus_bridge.js');

  assert.equal(isAllowedExternalUrl('https://evrakplus.com/evrakplus-cihaz-onay/?code=ABC', 'https://www.evrakplus.com'), true);
  assert.equal(isAllowedExternalUrl('http://evrakplus.com/insecure', 'https://www.evrakplus.com'), false);
  assert.equal(isAllowedExternalUrl('https://evil.example.com/phish', 'https://www.evrakplus.com'), false);

  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k)
  };

  let syncCalls = 0;
  let force401Once = true;
  const mockFetch = async (url, init) => {
    const body = init.body ? JSON.parse(init.body) : null;
    if (url.endsWith('/auth/device')) {
      return {
        status: 200, ok: true,
        text: async () => JSON.stringify({
          device_code: 'dev_123',
          user_code: 'ABCD-1234',
          verification_url: 'https://evrakplus.com/evrakplus-cihaz-onay/?code=ABCD-1234',
          interval: 3
        })
      };
    }
    if (url.endsWith('/auth/token') && body.grant_type === 'device_code') {
      return {
        status: 200, ok: true,
        text: async () => JSON.stringify({
          device_id: 'mob_1',
          access_token: 'tok_initial',
          refresh_token: 'ref_1',
          expires_at: '2027-01-01T00:00:00Z',
          user: { id: 7, full_name: 'Ayşe Yılmaz', email: 'ayse@evrakplus.com' },
          entitlement: { signed_token: 'sig_ok', expires_at: '2027-01-01T00:00:00Z', can_export_pdf: true, can_export_excel: true }
        })
      };
    }
    if (url.endsWith('/auth/token') && body.grant_type === 'refresh_token') {
      return {
        status: 200, ok: true,
        text: async () => JSON.stringify({
          access_token: 'tok_refreshed',
          refresh_token: 'ref_2',
          expires_at: '2027-01-01T00:00:00Z'
        })
      };
    }
    if (url.endsWith('/projects') && init.method === 'GET') {
      if (force401Once) {
        force401Once = false;
        return { status: 401, ok: false, text: async () => JSON.stringify({ message: 'expired' }) };
      }
      assert.equal(init.headers.Authorization, 'Bearer tok_refreshed');
      return { status: 200, ok: true, text: async () => JSON.stringify({ projects: [{ project_uuid: 'prj_1', title: 'Atatürk OO', version: 2 }] }) };
    }
    if (url.includes('/projects/prj_1/sync')) {
      syncCalls += 1;
      if (syncCalls === 1) {
        return {
          status: 409, ok: false,
          text: async () => JSON.stringify({ server_version: 3, server_project: { project_uuid: 'prj_1', version: 3, payload: { school: { name: 'Atatürk OO' } } } })
        };
      }
      return {
        status: 200, ok: true,
        text: async () => JSON.stringify({ id: 1, project_uuid: 'prj_1', version: 4, updated_at: '2026-11-24T07:00:00Z', payload_size: 1024 })
      };
    }
    if (url.endsWith('/auth/logout')) {
      return { status: 200, ok: true, text: async () => JSON.stringify({ ok: true }) };
    }
    return { status: 404, ok: false, text: async () => '{}' };
  };

  const bridge = createWebEvrakPlusBridge({
    baseUrl: 'https://evrakplus.com',
    storage,
    fetchImpl: mockFetch,
    openWindow: () => null // mobil popup engeli simülasyonu
  });

  const started = await bridge.evrakplusStartLogin({ openBrowser: true });
  assert.equal(started.userCode, 'ABCD-1234');
  assert.equal(started.popupBlocked, true);

  const poll = await bridge.evrakplusPollLogin('dev_123');
  assert.equal(poll.status, 'approved');
  assert.equal(poll.session.loggedIn, true);
  assert.equal(poll.session.user.full_name, 'Ayşe Yılmaz');

  // 401 -> otomatik refresh_token -> tekrar istek
  const list = await bridge.evrakplusListProjects();
  assert.equal(list.length, 1);
  assert.equal(list[0].project_uuid, 'prj_1');

  // 409 çakışma + force senkronizasyon
  const conflict = await bridge.evrakplusSyncProject({ projectUuid: 'prj_1', baseVersion: 2, title: 'Atatürk OO', payload: {} });
  assert.equal(conflict.status, 'conflict');
  assert.equal(conflict.serverVersion, 3);

  const synced = await bridge.evrakplusSyncProject({ projectUuid: 'prj_1', baseVersion: 3, title: 'Atatürk OO', payload: {}, force: true });
  assert.equal(synced.status, 'synced');
  assert.equal(synced.version, 4);

  const out = await bridge.evrakplusLogout();
  assert.equal(out.loggedOut, true);
  assert.equal(out.session.loggedIn, false);
});
