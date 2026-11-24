'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CURRENT_SCHEMA_VERSION = '1.0.0';
const DEFAULT_MAX_BACKUPS = 10;

const SENSITIVE_KEYS = new Set([
  'evrakPlusSession',
  'accessToken',
  'refreshToken',
  'access_token',
  'refresh_token',
  'password',
  'passwd',
  'secret',
  'apiKey',
  'api_key',
  'signed_token',
  'deviceCode',
  'device_code'
]);

function stripSensitiveFields(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stripSensitiveFields(item));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(k)) continue;
      out[k] = stripSensitiveFields(v);
    }
    return out;
  }
  return value;
}

function scrubLogText(text) {
  let s = String(text || '');
  // E-posta, Bearer token, refresh token, sifre desenlerini temizle
  s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EPOSTA_GIZLENDI]');
  s = s.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [TOKEN_GIZLENDI]');
  s = s.replace(/eprt_[a-f0-9]+/gi, '[REFRESH_GIZLENDI]');
  s = s.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[JWT_GIZLENDI]');
  s = s.replace(/(password|sifre|token|secret)\s*[:=]\s*[^\s,;}"']+/gi, '$1=[GIZLENDI]');
  return s.slice(0, 500);
}

class StorageAndBackupService {
  constructor(userDataDir) {
    this.userDataDir = userDataDir;
    this.backupsDir = path.join(userDataDir, 'backups');
    this.recoveryDir = path.join(userDataDir, 'recovery');
    this.logsDir = path.join(userDataDir, 'logs');
    this.prefsFile = path.join(userDataDir, 'app_prefs.json');
    this.recoveryFile = path.join(this.recoveryDir, 'autosave_recovery.json');
    this.logFile = path.join(this.logsDir, 'app_errors.jsonl');
    this._ensureDirs();
  }

  _ensureDirs() {
    fs.mkdirSync(this.backupsDir, { recursive: true });
    fs.mkdirSync(this.recoveryDir, { recursive: true });
    fs.mkdirSync(this.logsDir, { recursive: true });
  }

  getPrefs() {
    try {
      if (fs.existsSync(this.prefsFile)) {
        const parsed = JSON.parse(fs.readFileSync(this.prefsFile, 'utf8'));
        return {
          maxBackups: Math.max(3, Math.min(50, Number(parsed.maxBackups) || DEFAULT_MAX_BACKUPS)),
          lastUpdateCheckAt: parsed.lastUpdateCheckAt || null,
          updateHistory: Array.isArray(parsed.updateHistory) ? parsed.updateHistory : []
        };
      }
    } catch (_e) {}
    return {
      maxBackups: DEFAULT_MAX_BACKUPS,
      lastUpdateCheckAt: null,
      updateHistory: []
    };
  }

  savePrefs(partial) {
    const merged = { ...this.getPrefs(), ...(partial || {}) };
    merged.maxBackups = Math.max(3, Math.min(50, Number(merged.maxBackups) || DEFAULT_MAX_BACKUPS));
    this._ensureDirs();
    fs.writeFileSync(this.prefsFile, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  }

  /**
   * Yerel proje yedeği oluşturur (hassas oturum/token alanları temizlenir).
   */
  createBackup(projectData, { reason = 'auto', label = '' } = {}) {
    this._ensureDirs();
    const sanitized = stripSensitiveFields(projectData || {});
    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    const safeReason = String(reason || 'auto').replace(/[^a-z0-9_-]/gi, '').slice(0, 24) || 'auto';
    const id = `bkp_${stamp}_${safeReason}_${crypto.randomBytes(3).toString('hex')}`;
    const filename = `${id}.json`;
    const filePath = path.join(this.backupsDir, filename);

    const envelope = {
      backupId: id,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      reason: safeReason,
      label: String(label || (sanitized.school && sanitized.school.name) || 'Ders Programı Yedeği').slice(0, 120),
      createdAt: now.toISOString(),
      payload: sanitized
    };

    const json = JSON.stringify(envelope);
    fs.writeFileSync(filePath, json, 'utf8');
    this._pruneBackups();

    return {
      backupId: id,
      filename,
      reason: envelope.reason,
      label: envelope.label,
      createdAt: envelope.createdAt,
      sizeBytes: Buffer.byteLength(json, 'utf8')
    };
  }

  _pruneBackups() {
    const maxBackups = this.getPrefs().maxBackups;
    const files = this._listBackupFiles();
    if (files.length <= maxBackups) return;
    // pre_update ve pre_migration yedeklerini mümkün olduğunca koru, en eskiden sil
    const removable = files.slice(maxBackups);
    for (const f of removable) {
      try { fs.unlinkSync(path.join(this.backupsDir, f.filename)); } catch (_e) {}
    }
  }

  _listBackupFiles() {
    this._ensureDirs();
    const entries = fs.readdirSync(this.backupsDir).filter((f) => f.endsWith('.json'));
    const list = [];
    for (const filename of entries) {
      const full = path.join(this.backupsDir, filename);
      try {
        const stat = fs.statSync(full);
        const raw = JSON.parse(fs.readFileSync(full, 'utf8'));
        list.push({
          backupId: raw.backupId || filename.replace(/\.json$/, ''),
          filename,
          reason: raw.reason || 'auto',
          label: raw.label || filename,
          schemaVersion: raw.schemaVersion || '1.0.0',
          createdAt: raw.createdAt || stat.mtime.toISOString(),
          sizeBytes: stat.size,
          mtimeMs: stat.mtimeMs
        });
      } catch (_e) {}
    }
    list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return list;
  }

  listBackups() {
    return this._listBackupFiles().map(({ mtimeMs, ...rest }) => rest);
  }

  restoreBackup(backupId) {
    const safeId = path.basename(String(backupId || ''));
    const target = this._listBackupFiles().find((b) => b.backupId === safeId || b.filename === safeId);
    if (!target) {
      throw new Error('Seçilen yerel yedek dosyası bulunamadı.');
    }
    const raw = JSON.parse(fs.readFileSync(path.join(this.backupsDir, target.filename), 'utf8'));
    const migrated = this.migrateProjectSchema(raw.payload || raw);
    return {
      backupId: target.backupId,
      createdAt: target.createdAt,
      label: target.label,
      schemaVersion: migrated.schemaVersion,
      payload: migrated.data
    };
  }

  /**
   * Sürümlü şema migrasyonu: Migrasyon öncesi otomatik yedek alır, hata durumunda eski veriyi korur.
   */
  migrateProjectSchema(rawData) {
    if (!rawData || typeof rawData !== 'object') {
      throw new Error('Proje verisi geçerli bir JSON nesnesi değil.');
    }
    const incomingVer = String(rawData.schemaVersion || '0.9.0');
    if (incomingVer === CURRENT_SCHEMA_VERSION) {
      return { migrated: false, schemaVersion: CURRENT_SCHEMA_VERSION, data: rawData };
    }

    // Migrasyon öncesi eski veriyi yedekle
    this.createBackup(rawData, { reason: 'pre_migration', label: `Şema ${incomingVer} -> ${CURRENT_SCHEMA_VERSION} Yedeği` });

    try {
      const cloned = JSON.parse(JSON.stringify(stripSensitiveFields(rawData)));
      cloned.schemaVersion = CURRENT_SCHEMA_VERSION;
      if (!cloned.cloudMeta || typeof cloned.cloudMeta !== 'object') {
        cloned.cloudMeta = {
          projectUuid: 'prj_' + Date.now().toString(36),
          version: 0,
          cloudSyncEnabled: false,
          lastSyncedAt: null,
          syncStatus: 'disabled'
        };
      }
      return { migrated: true, fromVersion: incomingVer, schemaVersion: CURRENT_SCHEMA_VERSION, data: cloned };
    } catch (err) {
      throw new Error(`Proje şeması güncellenemedi (eski veriniz yedeklenerek korundu): ${err.message}`);
    }
  }

  /**
   * Beklenmedik kapanma kurtarma (Crash Recovery)
   */
  writeCrashRecoverySnapshot(projectData) {
    this._ensureDirs();
    const sanitized = stripSensitiveFields(projectData || {});
    const rec = {
      savedAt: new Date().toISOString(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      payload: sanitized
    };
    fs.writeFileSync(this.recoveryFile, JSON.stringify(rec), 'utf8');
    return { saved: true, savedAt: rec.savedAt };
  }

  clearCrashRecoverySnapshot() {
    try {
      if (fs.existsSync(this.recoveryFile)) fs.unlinkSync(this.recoveryFile);
    } catch (_e) {}
  }

  getCrashRecoverySnapshot() {
    try {
      if (!fs.existsSync(this.recoveryFile)) return null;
      const parsed = JSON.parse(fs.readFileSync(this.recoveryFile, 'utf8'));
      if (parsed && parsed.payload) return parsed;
    } catch (_e) {}
    return null;
  }

  /**
   * Hassas verilerden arındırılmış yerel hata günlüğü
   */
  logError({ appVersion = '1.0.0', engineVersion = 'unknown', errorType = 'RuntimeError', section = 'general', code = 'ERR_GENERAL', message = '' } = {}) {
    this._ensureDirs();
    const entry = {
      timestamp: new Date().toISOString(),
      appVersion: String(appVersion),
      engineVersion: String(engineVersion),
      errorType: String(errorType).slice(0, 64),
      section: String(section).slice(0, 64),
      code: String(code).slice(0, 64),
      message: scrubLogText(message)
    };
    fs.appendFileSync(this.logFile, JSON.stringify(entry) + '\n', 'utf8');
    return entry;
  }

  buildSanitizedErrorReport({ appVersion = '1.0.0', engineInfo = null, startupChecks = null } = {}) {
    let recentErrors = [];
    try {
      if (fs.existsSync(this.logFile)) {
        const lines = fs.readFileSync(this.logFile, 'utf8').trim().split(/\r?\n/).filter(Boolean);
        recentErrors = lines.slice(-50).map((line) => {
          try { return JSON.parse(line); } catch (_e) { return { raw: scrubLogText(line) }; }
        });
      }
    } catch (_e) {}

    return {
      reportType: 'evrakplus_ders_dagitim_sanitized_diagnostics',
      generatedAt: new Date().toISOString(),
      privacyNotice: 'Bu rapor öğretmen isimleri, şifreler, erişim belirteçleri ve okul proje içeriklerini içermez.',
      appVersion,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron || null,
      engineInfo: engineInfo ? {
        available: Boolean(engineInfo.available),
        engine: engineInfo.engine || null,
        ortools_version: engineInfo.ortools_version || null,
        python_version: engineInfo.python_version || null,
        mode: engineInfo.mode || null
      } : null,
      startupChecks: startupChecks || null,
      recentErrors
    };
  }
}

module.exports = {
  StorageAndBackupService,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_MAX_BACKUPS,
  stripSensitiveFields,
  scrubLogText
};
