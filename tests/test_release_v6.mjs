import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const {
  StorageAndBackupService,
  stripSensitiveFields,
  scrubLogText,
  CURRENT_SCHEMA_VERSION
} = require('../electron/storage_and_backup.cjs');
const {
  UpdaterService,
  compareSemver,
  signManifestEd25519,
  verifyManifestEd25519,
  OFFLINE_UPDATE_MESSAGE
} = require('../electron/updater_service.cjs');
const { runStartupChecks } = require('../electron/startup_checks.cjs');

test('Aşama 6.1: Ed25519 güncelleme manifesti imzalama, doğrulama ve sahte manifest reddi', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

  const manifest = 'version: 1.1.0\npath: EvrakPlus-Ders-Dagitim-Setup-1.1.0.exe\nsha512: abc123\n';
  const sig = signManifestEd25519(manifest, privPem);

  assert.equal(verifyManifestEd25519(manifest, sig, pubPem), true);
  assert.equal(verifyManifestEd25519(manifest.replace('1.1.0', '1.1.1'), sig, pubPem), false);
  assert.equal(verifyManifestEd25519(manifest, 'gecersiz_imza', pubPem), false);
});

test('Aşama 6.2: UpdaterService fail-closed Ed25519 manifest kapısı, kullanıcı onayı kuralları ve güncelleme öncesi yedek', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'epdd-upd-'));
  const backupSvc = new StorageAndBackupService(tmpDir);
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

  const validManifest = 'version: 1.1.0\npath: EvrakPlus-Ders-Dagitim-Setup-1.1.0.exe\nsha512: deadbeef\n';
  const validSig = signManifestEd25519(validManifest, privPem);

  class FakeAutoUpdater extends EventEmitter {
    constructor() {
      super();
      this.autoDownload = true;
      this.autoInstallOnAppQuit = true;
      this.allowPrerelease = true;
      this.allowDowngrade = true;
      this.disableWebInstaller = false;
      this.downloadCalled = false;
      this.quitAndInstallCalled = false;
    }
    async checkForUpdates() {
      this.emit('checking-for-update');
      this.emit('update-available', { version: '1.1.0', releaseNotes: 'Performans artışı' });
    }
    async downloadUpdate() {
      this.downloadCalled = true;
      this.emit('download-progress', { percent: 55, transferred: 5500, total: 10000 });
      this.emit('update-downloaded', { version: '1.1.0' });
    }
    quitAndInstall() {
      this.quitAndInstallCalled = true;
    }
  }

  try {
    // 1) Yapılandırılmamış / imzasız aday derlemesi fail-closed olmalı
    const unconfSvc = new UpdaterService({
      appVersion: '1.0.0',
      isPackaged: true,
      autoUpdater: new FakeAutoUpdater(),
      securityConfig: { githubOwner: '', githubRepo: 'evrakplus-ders-dagitim', expectedPublisherName: '', ed25519ManifestPublicKeyPem: '' }
    });
    const unconfState = await unconfSvc.checkForUpdates();
    assert.equal(unconfState.status, 'unconfigured');

    // 1b) Kod imzalama sertifikası olmadan (yalnızca githubOwner ile) güncelleme kontrolü ve onaylı indirme çalışmalı
    const fakeNoCert = new FakeAutoUpdater();
    const noCertSvc = new UpdaterService({
      appVersion: '1.0.2',
      isPackaged: true,
      autoUpdater: fakeNoCert,
      backupService: backupSvc,
      securityConfig: { githubOwner: 'appoyanarates-ux', githubRepo: 'ders-dagitim-ultimate', expectedPublisherName: '', ed25519ManifestPublicKeyPem: '' }
    });
    const ncSt1 = await noCertSvc.checkForUpdates();
    assert.equal(ncSt1.status, 'available');
    const ncSt2 = await noCertSvc.downloadUpdate();
    assert.equal(fakeNoCert.downloadCalled, true);
    assert.equal(ncSt2.status, 'downloaded');

    // 2) Sahte/bozuk Ed25519 imzalı manifest indirmeyi engellemeli (downloadUpdate çağrılmamalı!)
    const fakeBad = new FakeAutoUpdater();
    const badFetch = async (url) => ({
      ok: true,
      arrayBuffer: async () => Buffer.from(validManifest, 'utf8'),
      text: async () => (url.endsWith('.sig') ? 'TAMPERED_SIG' : validManifest)
    });
    const badSvc = new UpdaterService({
      appVersion: '1.0.0',
      isPackaged: true,
      autoUpdater: fakeBad,
      backupService: backupSvc,
      fetchImpl: badFetch,
      securityConfig: { githubOwner: 'authorized-org', githubRepo: 'evrakplus-ders-dagitim', expectedPublisherName: 'CN=EvrakPlus', ed25519ManifestPublicKeyPem: pubPem }
    });
    await badSvc.checkForUpdates();
    await assert.rejects(() => badSvc.downloadUpdate(), /Ed25519 dijital imzası geçersiz/);
    assert.equal(fakeBad.downloadCalled, false);

    // 3) Geçerli Ed25519 imzalı manifest ile onaylı indirme ve kurulum öncesi yedek
    const fakeOk = new FakeAutoUpdater();
    const goodFetch = async (url) => ({
      ok: true,
      arrayBuffer: async () => Buffer.from(validManifest, 'utf8'),
      text: async () => (url.endsWith('.sig') ? validSig : validManifest)
    });
    const svc = new UpdaterService({
      appVersion: '1.0.0',
      isPackaged: true,
      autoUpdater: fakeOk,
      backupService: backupSvc,
      fetchImpl: goodFetch,
      securityConfig: { githubOwner: 'authorized-org', githubRepo: 'evrakplus-ders-dagitim', expectedPublisherName: 'CN=EvrakPlus', ed25519ManifestPublicKeyPem: pubPem }
    });

    assert.equal(fakeOk.autoDownload, false);
    assert.equal(fakeOk.autoInstallOnAppQuit, false);
    assert.equal(fakeOk.allowPrerelease, false);
    assert.equal(fakeOk.allowDowngrade, false);
    assert.equal(fakeOk.disableWebInstaller, true);

    assert.equal(compareSemver('1.1.0', '1.0.0'), 1);
    const st1 = await svc.checkForUpdates();
    assert.equal(st1.status, 'available');
    assert.equal(st1.message, 'Yeni bir EvrakPlus Ders Dağıtım sürümü mevcut.');

    const st2 = await svc.downloadUpdate();
    assert.equal(fakeOk.downloadCalled, true);
    assert.equal(st2.manifestSignatureVerified, true);
    assert.equal(st2.status, 'downloaded');
    assert.equal(st2.downloadedReady, true);

    svc.installDownloadedUpdate({ school: { name: 'Atatürk Ortaokulu' }, teachers: [{ id: 't1', name: 'Ali' }] });
    assert.equal(fakeOk.quitAndInstallCalled, true);

    const backups = backupSvc.listBackups();
    assert.equal(backups.length, 1);
    assert.equal(backups[0].reason, 'pre_update');

    fakeOk.emit('error', new Error('net::ERR_INTERNET_DISCONNECTED'));
    assert.equal(svc.getState().status, 'offline');
    assert.equal(svc.getState().message, OFFLINE_UPDATE_MESSAGE);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Aşama 6.3: Otomatik yerel yedekleme, şema migrasyonu, kurtarma ve arındırılmış hata raporu', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'epdd-bkp-'));
  try {
    const svc = new StorageAndBackupService(tmpDir);
    svc.savePrefs({ maxBackups: 4 });

    for (let i = 1; i <= 6; i++) {
      svc.createBackup({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        school: { name: `Okul ${i}` },
        evrakPlusSession: { accessToken: 'SECRET_JWT', refreshToken: 'eprt_12345' },
        password: 'MySecretPassword'
      }, { reason: 'auto', label: `Yedek ${i}` });
    }

    const list = svc.listBackups();
    assert.equal(list.length, 4);

    const rawFile = fs.readFileSync(path.join(tmpDir, 'backups', list[0].filename), 'utf8');
    assert.equal(rawFile.includes('SECRET_JWT'), false);
    assert.equal(rawFile.includes('eprt_12345'), false);
    assert.equal(rawFile.includes('MySecretPassword'), false);

    const mig = svc.migrateProjectSchema({ school: { name: 'Eski Proje' } });
    assert.equal(mig.migrated, true);
    assert.equal(mig.schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.ok(mig.data.cloudMeta && mig.data.cloudMeta.cloudSyncEnabled === false);

    svc.writeCrashRecoverySnapshot({ school: { name: 'Kurtarma Testi' } });
    assert.equal(svc.getCrashRecoverySnapshot().payload.school.name, 'Kurtarma Testi');
    svc.clearCrashRecoverySnapshot();
    assert.equal(svc.getCrashRecoverySnapshot(), null);

    svc.logError({
      appVersion: '1.0.0',
      engineVersion: '9.14.6206',
      errorType: 'SyncError',
      section: 'cloud_sync',
      code: 'E_NET',
      message: 'Kullanıcı ahmet@okul.k12.tr Bearer eyJhbGciOi.payload.sig eprt_abcdef123456 password=12345678'
    });
    const report = svc.buildSanitizedErrorReport({ appVersion: '1.0.0' });
    const serialized = JSON.stringify(report);
    assert.equal(serialized.includes('ahmet@okul.k12.tr'), false);
    assert.equal(serialized.includes('eprt_abcdef123456'), false);
    assert.equal(serialized.includes('12345678'), false);
    assert.ok(serialized.includes('[EPOSTA_GIZLENDI]'));
    assert.equal(stripSensitiveFields({ a: 1, token: 'x', refreshToken: 'y' }).refreshToken, undefined);
    assert.ok(scrubLogText('test@domain.com').includes('[EPOSTA_GIZLENDI]'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Aşama 6.4: Başlangıç kontrolleri, .gitignore, POSIX WP ZIP ve boş PATH gömülü solver uçtan uca çözüm+doğrulama', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'epdd-start-'));
  try {
    const res = await runStartupChecks({
      appVersion: '1.0.0',
      userDataDir: tmpDir,
      getEngineInfo: async () => ({ available: true, engine: 'google_ortools_cp_sat', ortools_version: '9.14.6206', python_version: '3.12.10' }),
      evrakplusClient: { getPublicSession: () => ({ loggedIn: false, entitlement: {} }) },
      updaterService: { getState: () => ({ status: 'unconfigured' }) }
    });
    assert.equal(res.allOk, true);
    assert.equal(res.checks.length, 6);

    const gitignore = fs.readFileSync(path.join(projectRoot, '.gitignore'), 'utf8');
    for (const pattern of ['*.pfx', '*.p12', '*.pem', '*.key', 'evrakplus_session.enc', '.env']) {
      assert.ok(gitignore.includes(pattern), `.gitignore içinde eksik kural: ${pattern}`);
    }

    const builderYml = fs.readFileSync(path.join(projectRoot, 'electron-builder.yml'), 'utf8');
    assert.ok(builderYml.includes('EvrakPlus-Ders-Dagitim-Multi-Plus-${version}-Setup.${ext}'));
    assert.ok(builderYml.includes('deleteAppDataOnUninstall: false'));
    assert.ok(builderYml.includes('owner: appoyanarates-ux'));
    assert.ok(builderYml.includes('repo: evrakplus-ders-dagitim-multi-plus'));

    // Boş PATH/PYTHONHOME/PYTHONPATH ile paketlenmiş solver_ortools.exe gerçek çözüm + doğrulama testi
    const bundledSolver = path.join(projectRoot, 'release', 'win-unpacked', 'resources', 'solver_ortools', 'solver_ortools.exe');
    if (fs.existsSync(bundledSolver)) {
      const cleanEnv = { SystemRoot: process.env.SystemRoot || 'C:\\Windows', TEMP: tmpDir, TMP: tmpDir, PATH: '', PYTHONHOME: '', PYTHONPATH: '' };
      const inPath = path.join(tmpDir, 'model.json');
      const outPath = path.join(tmpDir, 'solution.json');
      const valInPath = path.join(tmpDir, 'val_in.json');
      const valOutPath = path.join(tmpDir, 'val_out.json');

      const model = {
        schema_version: '4.0-meb-2026-2027',
        solver_target: 'google_ortools_cp_sat',
        school: { name: 'Temiz PATH Test', academic_year: '2026-2027', meb_school_type: 'ortaokul', shift_mode: 'single', weekly_target_hours: 10 },
        time_grid: {
          num_days: 2,
          days: [{ index: 0, name: 'Pazartesi' }, { index: 1, name: 'Salı' }],
          periods_per_day: 5,
          lunch_break: { after_period: 3, duration_min: 40 },
          teaching_day_indices: [0, 1],
          bell_schedule: [1, 2, 3, 4, 5].map((p) => ({ period: p, start: `${7 + p}:30`, end: `${8 + p}:10` })),
          blocked_slots: [],
          common_elective_slots: []
        },
        classes: [{ id: 'c1', name: '5/A', grade_key: '5', shift: 'full_day' }],
        teachers: [{ id: 't1', name: 'Öğrt 1', branch: 'Matematik', min_weekly_hours: 0, max_weekly_hours: 20, max_daily_hours: 5, unavailable_slots: [{ day_index: 1, period: 1 }], prefer_avoid_slots: [] }],
        rooms: [],
        assignments: [
          { assignment_id: 'a1', class_id: 'c1', class_name: '5/A', course_id: 'mat', course_code: 'MAT', course_name: 'Matematik', hours: 4, blocks: [2, 2], teacher_ids: ['t1'], room_id: null, room_type: 'standard', max_blocks_per_day: 1, use_common_elective_slot: false }
        ],
        fixed_assignments: [{ assignment_id: 'a1', block_index: 0, day_index: 0, start_period: 1, length: 2 }],
        solution_request: { mode: 'respect_locks', preference: 'balanced' },
        solver_config: { engine: 'google_ortools_cp_sat', max_time_seconds: 10 }
      };
      fs.writeFileSync(inPath, JSON.stringify(model), 'utf8');
      execFileSync(bundledSolver, ['--input', inPath, '--output', outPath], { env: cleanEnv, timeout: 20000 });
      const sol = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      assert.equal(sol.engine, 'google_ortools_cp_sat');
      assert.ok(sol.status === 'OPTIMAL' || sol.status === 'FEASIBLE');
      assert.equal(sol.placed_blocks, 2);
      // Kilitli blok Pazartesi 1. saatte kalmalı
      const lockedPl = sol.placements.find((pl) => pl.assignment_id === 'a1' && pl.block_index === 0);
      assert.equal(lockedPl.day_index, 0);
      assert.equal(lockedPl.start_period, 1);

      // Bağımsız --validate doğrulaması da boş PATH ile çalışmalı
      fs.writeFileSync(valInPath, JSON.stringify({ config: model, solution: sol }), 'utf8');
      execFileSync(bundledSolver, ['--validate', '--input', valInPath, '--output', valOutPath], { env: cleanEnv, timeout: 15000 });
      const valRes = JSON.parse(fs.readFileSync(valOutPath, 'utf8'));
      assert.equal(valRes.valid, true);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
