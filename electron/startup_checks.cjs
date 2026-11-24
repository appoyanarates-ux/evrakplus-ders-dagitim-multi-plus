'use strict';

const fs = require('fs');
const path = require('path');
const { CURRENT_SCHEMA_VERSION } = require('./storage_and_backup.cjs');

/**
 * Bölüm 3: Program Başlangıç Kontrolleri (Arka planda, çevrimdışı uyumlu, engelleyici değil).
 */
async function runStartupChecks({
  appVersion,
  userDataDir,
  getEngineInfo,
  evrakplusClient,
  updaterService
}) {
  const checkedAt = new Date().toISOString();
  const checks = [];

  // 1. Uygulama sürümü ve şema sürümü
  checks.push({
    id: 'app_version',
    label: 'Uygulama ve Şema Sürümü',
    ok: true,
    detail: `v${appVersion} (Şema v${CURRENT_SCHEMA_VERSION})`
  });

  // 2. Python OR-Tools yardımcı motoru
  let engineInfo = null;
  try {
    engineInfo = await getEngineInfo();
    checks.push({
      id: 'ortools_engine',
      label: 'Otomatik Dağıtım Motoru',
      ok: Boolean(engineInfo && engineInfo.available),
      detail: engineInfo && engineInfo.available
        ? `Hazır (v${engineInfo.ortools_version || '1.0'})`
        : ((engineInfo && engineInfo.error) || 'Dağıtım motoru başlatılamadı.')
    });
  } catch (err) {
    checks.push({
      id: 'ortools_engine',
      label: 'Otomatik Dağıtım Motoru',
      ok: false,
      detail: `Motor kontrolü başarısız: ${err.message}`
    });
  }

  // 3. Yerel veri klasörü & 4. Proje kaydetme izinleri
  let writable = false;
  let writeDetail = '';
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    const probePath = path.join(userDataDir, '.write_probe.tmp');
    fs.writeFileSync(probePath, 'ok', 'utf8');
    fs.unlinkSync(probePath);
    writable = true;
    writeDetail = `Yazılabilir (${userDataDir})`;
  } catch (err) {
    writeDetail = `Yerel veri klasörüne yazma izni yok: ${err.message}`;
  }
  checks.push({
    id: 'local_storage',
    label: 'Yerel Veri Klasörü ve Kayıt İzinleri',
    ok: writable,
    detail: writeDetail
  });

  // 5. JSON şema uyumluluğu
  checks.push({
    id: 'json_schema',
    label: 'JSON Proje Şema Uyumluluğu',
    ok: true,
    detail: `Sürümlü migrasyon aktif (v${CURRENT_SCHEMA_VERSION})`
  });

  // 6 & 7. EvrakPlus oturum ve çevrimdışı çıktı yetkisi durumu
  const session = evrakplusClient ? evrakplusClient.getPublicSession() : null;
  checks.push({
    id: 'evrakplus_session',
    label: 'EvrakPlus Üyelik ve Oturum Durumu',
    ok: true,
    detail: session && session.loggedIn
      ? `Oturum açık (${session.user.full_name} · Çevrimdışı yetki: ${session.entitlement.offlineRemainingDays || 0} gün)`
      : 'Misafir modu (Ders dağıtımı ve düzenleme ücretsiz kullanılabilir)'
  });

  // 8. Güncelleme servisi durumu
  const updState = updaterService ? updaterService.getState() : null;
  checks.push({
    id: 'updater_service',
    label: 'GitHub Güncelleme Servisi',
    ok: true,
    detail: updState
      ? `Hazır (Onaylı indirme/kurulum · Durum: ${updState.status})`
      : 'Yapılandırılmadı'
  });

  const allOk = checks.every((c) => c.ok);
  return {
    checkedAt,
    allOk,
    appVersion,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    engineInfo,
    checks
  };
}

module.exports = {
  runStartupChecks
};
