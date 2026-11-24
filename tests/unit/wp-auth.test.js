import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  EVRAKPLUS_LOGIN_URL,
  generatePkcePair,
  verifyPkce,
  signOfflineEntitlement,
  verifyOfflineEntitlement,
  getMembershipPromptSpec
} from '../../packages/auth-client/src/index.js';

test('PKCE S256 üretimi, doğru verifier kabulü ve yanlış verifier reddi', () => {
  const { codeVerifier, codeChallenge, method } = generatePkcePair();
  assert.equal(method, 'S256');
  assert.ok(codeVerifier.length >= 43);
  assert.equal(verifyPkce(codeVerifier, codeChallenge), true);
  assert.equal(verifyPkce(codeVerifier + 'x', codeChallenge), false);
});

test('Ed25519 imzalı çevrimdışı yetki belgesi: geçerli doğrulama, tahrifat reddi, süre dolumu ve cihaz uyuşmazlığı', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

  const now = Math.floor(Date.now() / 1000);
  const token = signOfflineEntitlement({
    sub: 42,
    deviceId: 'win-device-001',
    canExport: true,
    canCloudSync: true,
    iat: now,
    exp: now + 3600
  }, privPem);

  // 1. Geçerli belge
  const ok = verifyOfflineEntitlement(token, pubPem, { expectedDeviceId: 'win-device-001', nowSec: now + 10 });
  assert.equal(ok.valid, true);
  assert.equal(ok.canExport, true);

  // 2. Süre dolumu reddi
  const expired = verifyOfflineEntitlement(token, pubPem, { expectedDeviceId: 'win-device-001', nowSec: now + 7200 });
  assert.equal(expired.valid, false);
  assert.equal(expired.reason, 'EXPIRED');

  // 3. Başka cihazda kullanım reddi
  const wrongDev = verifyOfflineEntitlement(token, pubPem, { expectedDeviceId: 'other-pc', nowSec: now + 10 });
  assert.equal(wrongDev.valid, false);
  assert.equal(wrongDev.reason, 'DEVICE_MISMATCH');

  // 4. Payload tahrifatı (imza bozulması) kesinlikle reddedilmeli
  const [enc, sig] = token.split('.');
  const tampered = `${enc.slice(0, -2)}AA.${sig}`;
  const badSig = verifyOfflineEntitlement(tampered, pubPem, { expectedDeviceId: 'win-device-001', nowSec: now + 10 });
  assert.equal(badSig.valid, false);
  assert.equal(badSig.reason, 'INVALID_SIGNATURE');
});

test('EvrakPlus Multi Plus Connect WP eklentisi 8 zorunlu uç noktayı ve güvenlik kontrollerini içermeli', () => {
  const wpFile = path.resolve('apps/wp-connect-plugin/evrakplus-multi-plus-connect/evrakplus-multi-plus-connect.php');
  assert.equal(fs.existsSync(wpFile), true);
  const src = fs.readFileSync(wpFile, 'utf8');

  for (const ep of ['/auth/start', '/auth/exchange', '/auth/refresh', '/auth/status', '/auth/logout', '/entitlements', '/sync/push', '/sync/pull']) {
    assert.ok(src.includes(ep), `Eksik WP REST uç noktası: ${ep}`);
  }
  assert.ok(src.includes('ep_mp_require_https'));
  assert.ok(src.includes('code_challenge'));
  assert.ok(src.includes('409')); // Çakışma tespiti

  const prompt = getMembershipPromptSpec();
  assert.equal(prompt.title, 'Ücretsiz üyelik gerekli');
  assert.equal(prompt.buttons[0].url, EVRAKPLUS_LOGIN_URL);
  assert.equal(prompt.buttons[1].url, EVRAKPLUS_LOGIN_URL);
});
