import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { EvrakPlusClient, isAllowedBaseUrl } = require('../electron/evrakplus_client.cjs');
const ExportEngine = require('../renderer/export_engine.js');

/**
 * Gerçek WordPress EvrakPlus Bridge REST API sözleşmesini (/wp-json/evrakplus-dd/v1/)
 * birebir uygulayan yerel test sunucusu.
 */
function createMockEvrakPlusServer() {
  const secret = 'test-signing-secret-epdd';
  const deviceCodes = new Map();
  const sessions = new Map(); // refreshHash -> { userId, deviceId, revoked }
  const activeDevices = new Set(); // `${userId}:${deviceId}`
  const projects = new Map(); // `${userId}:${uuid}` -> record
  let seq = 1;

  const users = {
    101: { id: 101, first_name: 'Ahmet', last_name: 'Yılmaz', full_name: 'Ahmet Yılmaz', email: 'ahmet@okul.k12.tr', membership_tier: 'free_member', membership_label: 'Ücretsiz EvrakPlus Üyesi' },
    202: { id: 202, first_name: 'Ayşe', last_name: 'Demir', full_name: 'Ayşe Demir', email: 'ayse@okul.k12.tr', membership_tier: 'free_member', membership_label: 'Ücretsiz EvrakPlus Üyesi' }
  };

  function signToken(payload) {
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(b64).digest('base64url');
    return `${b64}.${sig}`;
  }

  function verifyToken(tok) {
    if (!tok || !tok.includes('.')) return null;
    const [b64, sig] = tok.split('.');
    const expected = crypto.createHmac('sha256', secret).update(b64).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) return null;
    if (!activeDevices.has(`${payload.sub}:${payload.dev}`)) return null;
    return payload;
  }

  function makeEntitlement(userId, deviceId, days = 7) {
    const now = Date.now();
    const exp = now + days * 24 * 60 * 60 * 1000;
    const claims = {
      sub: userId,
      device_id: deviceId,
      membership_label: 'Ücretsiz EvrakPlus Üyesi',
      can_export_pdf: true,
      can_export_excel: true,
      can_print: true,
      issued_at: new Date(now).toISOString(),
      expires_at: new Date(exp).toISOString(),
      offline_days: days
    };
    return { entitlement: claims, signed_token: signToken(claims) };
  }

  function readJson(req) {
    return new Promise((resolve) => {
      let buf = '';
      req.on('data', (c) => { buf += c.toString('utf8'); });
      req.on('end', () => {
        try { resolve(buf ? JSON.parse(buf) : {}); } catch (_e) { resolve({}); }
      });
    });
  }

  function send(res, status, obj) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(obj));
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const p = url.pathname.replace(/^\/wp-json\/evrakplus-dd\/v1/, '');
    const body = await readJson(req);

    if (req.method === 'POST' && p === '/auth/device') {
      const device_code = crypto.randomBytes(16).toString('hex');
      const user_code = 'EP-TEST-' + String(seq++).padStart(4, '0');
      deviceCodes.set(device_code, { user_code, status: 'pending', user_id: null });
      return send(res, 200, {
        device_code,
        user_code,
        verification_url: `http://127.0.0.1:${server.address().port}/evrakplus-ders-dagitim-giris/?code=${user_code}`,
        expires_in: 600,
        interval: 1
      });
    }

    if (req.method === 'POST' && p === '/auth/token') {
      if (body.grant_type === 'device_code') {
        const rec = deviceCodes.get(body.device_code);
        if (!rec) return send(res, 400, { message: 'Geçersiz kod' });
        if (rec.status === 'pending') return send(res, 202, { status: 'authorization_pending' });
        if (rec.status === 'approved') {
          rec.status = 'consumed';
          const device_id = 'dev_' + (seq++);
          const refresh_token = 'eprt_' + crypto.randomBytes(16).toString('hex');
          const rHash = crypto.createHash('sha256').update(refresh_token).digest('hex');
          sessions.set(rHash, { userId: rec.user_id, deviceId: device_id, revoked: false });
          activeDevices.add(`${rec.user_id}:${device_id}`);
          const access_token = signToken({ sub: rec.user_id, dev: device_id, exp: Date.now() + 600000 });
          return send(res, 200, {
            device_id,
            access_token,
            refresh_token,
            expires_in: 600,
            expires_at: new Date(Date.now() + 600000).toISOString(),
            user: users[rec.user_id],
            entitlement: makeEntitlement(rec.user_id, device_id, 7)
          });
        }
        return send(res, 400, { message: 'Kod zaten kullanıldı' });
      }
      if (body.grant_type === 'refresh_token') {
        const rHash = crypto.createHash('sha256').update(String(body.refresh_token || '')).digest('hex');
        const sess = sessions.get(rHash);
        if (!sess || sess.revoked) return send(res, 401, { message: 'Geçersiz refresh token' });
        sessions.delete(rHash);
        const newRefresh = 'eprt_' + crypto.randomBytes(16).toString('hex');
        const newHash = crypto.createHash('sha256').update(newRefresh).digest('hex');
        sessions.set(newHash, sess);
        const access_token = signToken({ sub: sess.userId, dev: sess.deviceId, exp: Date.now() + 600000 });
        return send(res, 200, {
          device_id: sess.deviceId,
          access_token,
          refresh_token: newRefresh,
          expires_at: new Date(Date.now() + 600000).toISOString(),
          user: users[sess.userId],
          entitlement: makeEntitlement(sess.userId, sess.deviceId, 7)
        });
      }
    }

    // Auth required endpoints
    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const auth = verifyToken(jwt);
    if (!auth) return send(res, 401, { message: 'Yetkisiz istek' });

    if (req.method === 'GET' && p === '/auth/me') {
      return send(res, 200, { user: users[auth.sub], device_id: auth.dev });
    }
    if (req.method === 'POST' && p === '/auth/logout') {
      activeDevices.delete(`${auth.sub}:${auth.dev}`);
      for (const s of sessions.values()) {
        if (s.userId === auth.sub && s.deviceId === auth.dev) s.revoked = true;
      }
      return send(res, 200, { logged_out: true });
    }
    if (req.method === 'GET' && p === '/entitlements') {
      return send(res, 200, makeEntitlement(auth.sub, auth.dev, 7));
    }
    if (req.method === 'GET' && p === '/projects') {
      const list = [];
      for (const rec of projects.values()) {
        if (rec.user_id === auth.sub) {
          list.push({
            id: rec.id, project_uuid: rec.project_uuid, title: rec.title,
            version: rec.version, payload_size: rec.payload_size, updated_at: rec.updated_at
          });
        }
      }
      return send(res, 200, { projects: list });
    }

    const syncMatch = p.match(/^\/projects\/([^/]+)\/sync$/);
    if (req.method === 'POST' && syncMatch) {
      const uuid = decodeURIComponent(syncMatch[1]);
      const key = `${auth.sub}:${uuid}`;
      const existing = projects.get(key);
      const rawSize = Buffer.byteLength(JSON.stringify(body.payload || {}), 'utf8');
      if (!existing) {
        const rec = {
          id: seq++, project_uuid: uuid, user_id: auth.sub,
          title: body.title || 'Proje', version: 1,
          payload: body.payload, payload_size: rawSize,
          updated_at: new Date().toISOString()
        };
        projects.set(key, rec);
        return send(res, 201, { id: rec.id, project_uuid: uuid, version: 1, updated_at: rec.updated_at, payload_size: rawSize });
      }
      if (!body.force && Number(body.base_version) !== existing.version) {
        return send(res, 409, {
          code: 'epdd_sync_conflict',
          message: 'Sürüm çakışması',
          server_version: existing.version,
          server_updated_at: existing.updated_at,
          server_project: {
            id: existing.id, project_uuid: existing.project_uuid, title: existing.title,
            version: existing.version, updated_at: existing.updated_at, payload: existing.payload
          }
        });
      }
      existing.version += 1;
      existing.title = body.title || existing.title;
      existing.payload = body.payload;
      existing.payload_size = rawSize;
      existing.updated_at = new Date().toISOString();
      return send(res, 200, { id: existing.id, project_uuid: uuid, version: existing.version, updated_at: existing.updated_at, payload_size: rawSize });
    }

    const itemMatch = p.match(/^\/projects\/([^/]+)$/);
    if (itemMatch) {
      const uuid = decodeURIComponent(itemMatch[1]);
      const key = `${auth.sub}:${uuid}`;
      const rec = projects.get(key);
      if (!rec) return send(res, 404, { message: 'Proje bulunamadı' });
      if (req.method === 'GET') return send(res, 200, rec);
      if (req.method === 'DELETE') {
        projects.delete(key);
        return send(res, 200, { deleted: true, project_uuid: uuid });
      }
    }

    return send(res, 404, { message: 'Bilinmeyen uç nokta' });
  });

  return {
    server,
    approveDevice(deviceCode, userId = 101) {
      const rec = deviceCodes.get(deviceCode);
      if (rec) {
        rec.status = 'approved';
        rec.user_id = userId;
      }
    }
  };
}

test('1. HTTPS zorunluluğu ve dış URL izin listesi güvenliği', () => {
  assert.equal(isAllowedBaseUrl('https://www.evrakplus.com', false), true);
  assert.equal(isAllowedBaseUrl('http://www.evrakplus.com', false), false);
  assert.equal(isAllowedBaseUrl('http://127.0.0.1:8080', false), false);
  assert.equal(isAllowedBaseUrl('http://127.0.0.1:8080', true), true);

  assert.throws(() => new EvrakPlusClient({ baseUrl: 'http://evil.example.com' }));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'epdd-url-'));
  const client = new EvrakPlusClient({ baseUrl: 'https://www.evrakplus.com', storageDir: tmpDir });
  assert.equal(client.isUrlAllowedForExternalOpen('https://www.evrakplus.com/hesabim/'), true);
  assert.equal(client.isUrlAllowedForExternalOpen('https://evil.example.com/phish'), false);
  assert.equal(client.isUrlAllowedForExternalOpen('javascript:alert(1)'), false);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('2. Cihaz eşleştirme, 7 günlük çevrimdışı çıktı yetkisi, bulut senkronizasyonu, 409 çakışma ve kullanıcı izolasyonu', async () => {
  const mock = createMockEvrakPlusServer();
  await new Promise((resolve) => mock.server.listen(0, '127.0.0.1', resolve));
  const port = mock.server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'epdd-userA-'));
  const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'epdd-userB-'));

  // Sahte DPAPI safeStorage (encrypt/decrypt doğrulaması)
  const fakeSafeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: (str) => Buffer.from('ENC:' + str, 'utf8'),
    decryptString: (buf) => buf.toString('utf8').replace(/^ENC:/, '')
  };

  try {
    const clientA = new EvrakPlusClient({ baseUrl, storageDir: dirA, safeStorage: fakeSafeStorage, allowLocalHttp: true });

    // Giriş yapmadan çıktı kapısı engellenmeli
    const guestSession = clientA.getPublicSession();
    assert.equal(guestSession.loggedIn, false);
    const gateDenied = ExportEngine.EvrakPlusAuthService.checkExportPermission('export_pdf', { evrakPlusSession: guestSession });
    assert.equal(gateDenied.allowed, false);
    assert.match(gateDenied.message, /ücretsiz EvrakPlus üyeliğinizle giriş yapmanız gerekiyor/);

    // Cihaz eşleştirme başlat -> pending -> onayla -> approved
    const start = await clientA.startDeviceLogin({ deviceName: 'Test-PC', appVersion: '1.4.0' });
    assert.ok(start.deviceCode);
    assert.match(start.userCode, /^EP-TEST-/);

    const poll1 = await clientA.pollDeviceLogin(start.deviceCode);
    assert.equal(poll1.status, 'pending');

    mock.approveDevice(start.deviceCode, 101);
    const poll2 = await clientA.pollDeviceLogin(start.deviceCode);
    assert.equal(poll2.status, 'approved');
    assert.equal(poll2.session.loggedIn, true);
    assert.equal(poll2.session.user.full_name, 'Ahmet Yılmaz');

    // Public session asla ham token sızdırmamalı
    assert.equal('accessToken' in poll2.session, false);
    assert.equal('refreshToken' in poll2.session, false);

    // Diskteki dosya DPAPI ile şifrelenmiş olmalı (düz metin token yok)
    const rawDisk = fs.readFileSync(path.join(dirA, 'evrakplus_session.enc'), 'utf8');
    assert.match(rawDisk, /"mode":"dpapi"/);
    assert.equal(rawDisk.includes('eprt_'), false);

    // Giriş sonrası 7 günlük çevrimdışı çıktı yetkisi onaylanmalı
    const gateAllowed = ExportEngine.EvrakPlusAuthService.checkExportPermission('export_pdf', { evrakPlusSession: poll2.session });
    assert.equal(gateAllowed.allowed, true);
    assert.equal(poll2.session.entitlement.offlineRemainingDays, 7);

    // 8 gün ileri sarıldığında çevrimdışı yetki süresi dolmuş sayılmalı
    const eightDaysLater = Date.now() + 8 * 24 * 60 * 60 * 1000;
    const expiredSession = clientA.getPublicSession(eightDaysLater);
    const gateExpired = ExportEngine.EvrakPlusAuthService.checkExportPermission('export_xlsx', { evrakPlusSession: expiredSession });
    assert.equal(gateExpired.allowed, false);
    assert.equal(gateExpired.status, 'expired_license');

    // Bulut projesi oluştur ve eşitle (120 öğretmenlik büyük okul verisi testi)
    const bigTeachers = Array.from({ length: 120 }, (_, i) => ({ id: `t${i + 1}`, name: `Öğretmen ${i + 1}`, branch: 'Matematik' }));
    const bigClasses = Array.from({ length: 48 }, (_, i) => ({ id: `c${i + 1}`, name: `${5 + (i % 4)}/${String.fromCharCode(65 + (i % 12))}` }));
    const bigPayload = { school: { name: 'Büyük Anadolu Lisesi', academicYear: '2026-2027' }, teachers: bigTeachers, classes: bigClasses };

    const t0 = Date.now();
    const sync1 = await clientA.syncProject({
      projectUuid: 'prj_big_school',
      baseVersion: 0,
      title: 'Büyük Anadolu Lisesi 2026-2027',
      payload: bigPayload
    });
    const elapsedMs = Date.now() - t0;
    assert.equal(sync1.status, 'synced');
    assert.equal(sync1.version, 1);
    assert.ok(elapsedMs < 3000, `Büyük okul senkronizasyonu hızlı olmalı (${elapsedMs}ms)`);

    // Sürüm 2 güncellemesi
    const sync2 = await clientA.syncProject({
      projectUuid: 'prj_big_school',
      baseVersion: 1,
      title: 'Büyük Anadolu Lisesi v2',
      payload: { ...bigPayload, updated: true }
    });
    assert.equal(sync2.status, 'synced');
    assert.equal(sync2.version, 2);

    // Eski baseVersion (1) ile gönderildiğinde 409 ÇAKIŞMA döndürmeli
    const conflict = await clientA.syncProject({
      projectUuid: 'prj_big_school',
      baseVersion: 1,
      title: 'Çakışan Yerel Sürüm',
      payload: { ...bigPayload, localEdit: true }
    });
    assert.equal(conflict.status, 'conflict');
    assert.equal(conflict.serverVersion, 2);
    assert.ok(conflict.serverProject && conflict.serverProject.payload.updated === true);

    // Farklı kullanıcı (User B) User A'nın projesine erişememeli
    const clientB = new EvrakPlusClient({ baseUrl, storageDir: dirB, safeStorage: fakeSafeStorage, allowLocalHttp: true });
    const startB = await clientB.startDeviceLogin();
    mock.approveDevice(startB.deviceCode, 202);
    await clientB.pollDeviceLogin(startB.deviceCode);

    const listB = await clientB.listProjects();
    assert.equal(listB.length, 0);
    await assert.rejects(() => clientB.getProject('prj_big_school'), /bulunamadı/i);

    // Refresh token rotation testi
    const refreshed = await clientA.refreshSession();
    assert.equal(refreshed.loggedIn, true);

    // Oturumu kapatma (sunucuda iptal + yerel şifreli dosya silinir)
    await clientA.logout();
    assert.equal(clientA.getPublicSession().loggedIn, false);
    assert.equal(fs.existsSync(path.join(dirA, 'evrakplus_session.enc')), false);
  } finally {
    mock.server.close();
    fs.rmSync(dirA, { recursive: true, force: true });
    fs.rmSync(dirB, { recursive: true, force: true });
  }
});

test('3. WordPress eklentisi statik güvenlik ve 9 REST uç noktası doğrulaması', () => {
  const pluginDir = path.resolve(__dirname, '../evrakplus-ders-dagitim-bridge');
  const mainPhp = fs.readFileSync(path.join(pluginDir, 'evrakplus-ders-dagitim-bridge.php'), 'utf8');
  const restPhp = fs.readFileSync(path.join(pluginDir, 'includes/class-rest-api.php'), 'utf8');
  const authPhp = fs.readFileSync(path.join(pluginDir, 'includes/class-auth.php'), 'utf8');
  const adminPhp = fs.readFileSync(path.join(pluginDir, 'includes/class-admin.php'), 'utf8');

  // 9 REST endpoint mevcut olmalı
  const requiredRoutes = [
    '/auth/device',
    '/auth/token',
    '/auth/me',
    '/auth/logout',
    '/entitlements',
    '/projects',
    '/projects/(?P<id>[a-zA-Z0-9_-]+)',
    '/projects/(?P<id>[a-zA-Z0-9_-]+)/sync',
    '/projects/(?P<id>[a-zA-Z0-9_-]+)/history'
  ];
  for (const r of requiredRoutes) {
    assert.ok(restPhp.includes(r), `REST uç noktası eksik: ${r}`);
  }

  // Devre dışı bırakıldığında tablo silinmemeli (DROP TABLE yok)
  assert.equal(/DROP\s+TABLE/i.test(mainPhp), false);

  // CSRF nonce ve SQL prepare kullanımı
  assert.ok(authPhp.includes('wp_nonce_field'));
  assert.ok(authPhp.includes('check_admin_referer'));
  assert.ok(adminPhp.includes('check_admin_referer'));
  assert.ok(restPhp.includes('$wpdb->prepare'));
});
