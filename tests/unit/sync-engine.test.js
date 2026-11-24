import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankProject } from '../../packages/core-schema/src/index.js';
import { SyncClient, InMemorySyncServer, ConflictResolution } from '../../packages/sync-engine/src/index.js';

test('3 Cihaz Senaryosu (Masaüstü -> Web -> Mobil PWA -> Masaüstü) ve çevrimdışı kuyruk', async () => {
  const cloud = new InMemorySyncServer();
  const userToken = 'wp-user-42-token';

  const desktop = new SyncClient({ deviceId: 'pc-1', platform: 'desktop', transport: cloud, getAccessToken: () => userToken });
  const web = new SyncClient({ deviceId: 'web-1', platform: 'web', transport: cloud, getAccessToken: () => userToken });
  const mobile = new SyncClient({ deviceId: 'pwa-1', platform: 'pwa', transport: cloud, getAccessToken: () => userToken });

  // 1. Müdür yardımcısı masaüstünde okul + ders tanımlar (çevrimdışı iken kuyruğa alır)
  const proj = createBlankProject({ school: { name: 'Atatürk Ortaokulu' } });
  desktop.setOnline(false);
  desktop.enqueueUpsert(proj);
  const offlineTry = await desktop.syncNow();
  assert.equal(offlineTry.ok, false);
  assert.equal(offlineTry.reason, 'OFFLINE');
  assert.equal(offlineTry.pendingCount, 1);

  // 2. İnternet geldiğinde masaüstü buluta aktarır
  desktop.setOnline(true);
  const r1 = await desktop.syncNow();
  assert.equal(r1.ok, true);
  assert.equal(r1.pushed, 1);

  // 3. Evde Web uygulamasından giriş yapıp aynı veriyi görür
  const r2 = await web.syncNow();
  assert.equal(r2.ok, true);
  assert.equal(r2.pulled.length, 1);
  assert.equal(r2.pulled[0].project.school.name, 'Atatürk Ortaokulu');

  // 4. Telefondan (Mobil PWA) çekip bir ders yerleşimini değiştirir ve gönderir
  const r3Pull = await mobile.syncNow();
  const mobProj = r3Pull.pulled[0].project;
  mobProj.placements['a1:0'] = { day: 1, period: 2, lock: true };
  mobile.enqueueUpsert(mobProj);
  const r3Push = await mobile.syncNow();
  assert.equal(r3Push.ok, true);

  // 5. Masaüstüne döndüğünde telefon değişikliği otomatik senkronize olur
  const r4 = await desktop.syncNow();
  assert.equal(r4.ok, true);
  const updated = r4.pulled.find(x => x.id === proj.id);
  assert.ok(updated);
  assert.equal(updated.project.placements['a1:0'].day, 1);
  assert.equal(updated.project.placements['a1:0'].lock, true);
});

test('Çakışma tespiti (sessizce ezmeme), keep_both ile iki sürümü koruma ve silme (tombstone) senkronizasyonu', async () => {
  const cloud = new InMemorySyncServer();
  const tokenA = 'user-A';
  const tokenB = 'user-B'; // Okul/kullanıcı bazlı veri izolasyonu testi için ayrı kullanıcı

  const pc = new SyncClient({ deviceId: 'pc', transport: cloud, getAccessToken: () => tokenA });
  const phone = new SyncClient({ deviceId: 'phone', transport: cloud, getAccessToken: () => tokenA });
  const otherUser = new SyncClient({ deviceId: 'other', transport: cloud, getAccessToken: () => tokenB });

  // Başlangıç projesi buluta gider (rev 1)
  const p = createBlankProject({ school: { name: 'Fen Lisesi' } });
  pc.enqueueUpsert(p);
  await pc.syncNow();
  const phoneInit = await phone.syncNow();
  const phoneCopy = phoneInit.pulled[0].project;

  // Diğer kullanıcı bu projeyi ASLA görmemeli (veri izolasyonu)
  const otherPull = await otherUser.syncNow();
  assert.equal(otherPull.pulled.length, 0);

  // İki cihaz aynı anda çevrimdışı değişiklik yapar!
  p.school.principal = 'Müdür PC';
  pc.enqueueUpsert(p);
  await pc.syncNow(); // rev 2 olur

  phoneCopy.school.principal = 'Müdür Telefon';
  phone.enqueueUpsert(phoneCopy);
  const conflictRes = await phone.syncNow();
  assert.equal(conflictRes.ok, false);
  assert.equal(conflictRes.reason, 'CONFLICT_DETECTED');
  assert.equal(conflictRes.conflicts.length, 1);
  assert.equal(conflictRes.conflicts[0].serverProject.school.principal, 'Müdür PC');

  // KEEP_BOTH ile iki değişiklik de kaybolmadan korunur
  const resolved = await phone.resolveConflict(conflictRes.conflicts[0].id, ConflictResolution.KEEP_BOTH);
  assert.equal(resolved.resolved, true);
  assert.notEqual(resolved.forkedProject.id, p.id);

  // Tombstone silme senkronizasyonu
  pc.enqueueDelete(p);
  const delPush = await pc.syncNow();
  assert.equal(delPush.ok, true);
  const phoneAfterDel = await phone.syncNow();
  const deletedItem = phoneAfterDel.pulled.find(x => x.id === p.id);
  assert.ok(deletedItem && deletedItem.deletedAt, 'Silinen kayıt tombstone olarak senkronize edilmeli');
});

test('Üyelik (accessToken) olmadan bulut senkronizasyonu AUTH_REQUIRED dönmeli', async () => {
  const cloud = new InMemorySyncServer();
  const anon = new SyncClient({ deviceId: 'anon-1', transport: cloud, getAccessToken: () => null });
  const res = await anon.syncNow();
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'AUTH_REQUIRED');
});
