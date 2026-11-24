'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const OFFLINE_UPDATE_MESSAGE =
  'İnternet bağlantısı bulunamadı. Ders programınızı çevrimdışı kullanmaya devam edebilirsiniz.';
const UNCONFIGURED_OWNER_SENTINEL = 'REPLACE_WITH_AUTHORIZED_GITHUB_OWNER';

function loadUpdateSecurityConfig(customPath = null) {
  const cfgPath = customPath || path.join(__dirname, 'update_security.json');
  try {
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    return {
      githubOwner: String(raw.githubOwner || '').trim(),
      githubRepo: String(raw.githubRepo || 'evrakplus-ders-dagitim').trim(),
      expectedPublisherName: String(raw.expectedPublisherName || '').trim(),
      ed25519ManifestPublicKeyPem: String(raw.ed25519ManifestPublicKeyPem || '').trim()
    };
  } catch (_e) {
    return {
      githubOwner: '',
      githubRepo: 'evrakplus-ders-dagitim',
      expectedPublisherName: '',
      ed25519ManifestPublicKeyPem: ''
    };
  }
}

function compareSemver(a, b) {
  const pa = String(a || '0.0.0').replace(/^v/i, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '0.0.0').replace(/^v/i, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

/**
 * Ed25519 güncelleme manifesti (latest.yml) imzalama ve doğrulama yardımcıları.
 * Görev ayrımı:
 *  - Ed25519 anahtarı: latest.yml manifestinin bütünlüğünü ve yayıncı kaynağını doğrular.
 *  - Windows Kod İmzalama Sertifikası (Authenticode): indirilen .exe kurulum dosyasını doğrular.
 */
function signManifestEd25519(manifestBuffer, privateKeyPem) {
  const data = Buffer.isBuffer(manifestBuffer) ? manifestBuffer : Buffer.from(String(manifestBuffer), 'utf8');
  return crypto.sign(null, data, privateKeyPem).toString('base64');
}

function verifyManifestEd25519(manifestBuffer, signatureBase64, publicKeyPem) {
  if (!signatureBase64 || !publicKeyPem) return false;
  try {
    const data = Buffer.isBuffer(manifestBuffer) ? manifestBuffer : Buffer.from(String(manifestBuffer), 'utf8');
    const sig = Buffer.from(String(signatureBase64).trim(), 'base64');
    return crypto.verify(null, data, publicKeyPem, sig);
  } catch (_e) {
    return false;
  }
}

class UpdaterService {
  constructor({
    appVersion = '1.0.0',
    isPackaged = false,
    autoUpdater = null,
    onStatus = null,
    backupService = null,
    securityConfig = null,
    fetchImpl = null
  } = {}) {
    this.appVersion = appVersion;
    this.isPackaged = Boolean(isPackaged);
    this.onStatus = typeof onStatus === 'function' ? onStatus : () => {};
    this.backupService = backupService || null;
    this.autoUpdater = autoUpdater;
    this.fetchImpl = fetchImpl || globalThis.fetch;
    this.sec = securityConfig || loadUpdateSecurityConfig();

    const ownerConfigured = Boolean(this.sec.githubOwner && this.sec.githubOwner !== UNCONFIGURED_OWNER_SENTINEL);
    const publisherConfigured = Boolean(this.sec.expectedPublisherName);
    const ed25519Configured = Boolean(this.sec.ed25519ManifestPublicKeyPem && this.sec.ed25519ManifestPublicKeyPem.includes('BEGIN PUBLIC KEY'));
    // Kullanıcı tercihi: Windows kod imzalama sertifikası olmadan da GitHub Releases + SHA-512 ile güncelleme aktif
    this.ed25519Required = ed25519Configured;
    this.updateEnabled = ownerConfigured;

    this.state = {
      status: 'idle', // idle | checking | up-to-date | available | downloading | downloaded | offline | unconfigured | error
      currentVersion: appVersion,
      availableVersion: null,
      releaseNotes: '',
      releaseDate: null,
      progressPercent: 0,
      transferredBytes: 0,
      totalBytes: 0,
      message: '',
      lastCheckedAt: null,
      downloadedReady: false,
      manifestSignatureVerified: false,
      securityConfig: {
        autoDownload: false,
        autoInstallOnAppQuit: false,
        allowPrerelease: false,
        allowDowngrade: false,
        disableWebInstaller: true,
        verifyUpdateCodeSignature: publisherConfigured,
        provider: 'github',
        ownerConfigured,
        publisherConfigured,
        ed25519Configured,
        updateEnabled: this.updateEnabled,
        repo: this.sec.githubRepo || 'ders-dagitim-ultimate'
      }
    };

    this._configureAutoUpdater();
  }

  _emit(partial) {
    this.state = { ...this.state, ...(partial || {}) };
    try {
      this.onStatus(this.getState());
    } catch (_e) {}
  }

  _configureAutoUpdater() {
    if (!this.autoUpdater) return;
    // Kullanıcı onayı olmadan ASLA otomatik indirme veya kurulum yapma
    this.autoUpdater.autoDownload = false;
    this.autoUpdater.autoInstallOnAppQuit = false;
    this.autoUpdater.allowPrerelease = false;
    this.autoUpdater.allowDowngrade = false;
    this.autoUpdater.disableWebInstaller = true;

    this.autoUpdater.on('checking-for-update', () => {
      this._emit({ status: 'checking', message: 'Yeni sürüm kontrol ediliyor...' });
    });

    this.autoUpdater.on('update-available', (info) => {
      const notes = Array.isArray(info && info.releaseNotes)
        ? info.releaseNotes.map((r) => (typeof r === 'string' ? r : (r.note || ''))).join('\n')
        : String((info && info.releaseNotes) || '');
      this._emit({
        status: 'available',
        availableVersion: (info && info.version) || null,
        releaseNotes: notes,
        releaseDate: (info && info.releaseDate) || null,
        lastCheckedAt: new Date().toISOString(),
        manifestSignatureVerified: false,
        message: 'Yeni bir EvrakPlus Ders Dağıtım sürümü mevcut.'
      });
    });

    this.autoUpdater.on('update-not-available', () => {
      this._emit({
        status: 'up-to-date',
        availableVersion: null,
        lastCheckedAt: new Date().toISOString(),
        message: 'Programınız güncel.'
      });
    });

    this.autoUpdater.on('download-progress', (p) => {
      this._emit({
        status: 'downloading',
        progressPercent: Math.round(Number(p && p.percent) || 0),
        transferredBytes: Number(p && p.transferred) || 0,
        totalBytes: Number(p && p.total) || 0,
        message: `Güncelleme indiriliyor (%${Math.round(Number(p && p.percent) || 0)})...`
      });
    });

    this.autoUpdater.on('update-downloaded', (info) => {
      this._emit({
        status: 'downloaded',
        availableVersion: (info && info.version) || this.state.availableVersion,
        progressPercent: 100,
        downloadedReady: true,
        message: 'Güncelleme hazır. Programı kapatıp yeni sürümü yüklemek ister misiniz?'
      });
    });

    this.autoUpdater.on('error', (err) => {
      const rawMsg = String((err && err.message) || err || '');
      const isOffline = /ERR_INTERNET_DISCONNECTED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_CERT_|net::/i.test(rawMsg);
      if (isOffline) {
        this._emit({
          status: 'offline',
          lastCheckedAt: new Date().toISOString(),
          message: OFFLINE_UPDATE_MESSAGE
        });
      } else {
        this._emit({
          status: 'error',
          lastCheckedAt: new Date().toISOString(),
          message: `Güncelleme servisi şu anda yanıt vermiyor (${rawMsg.slice(0, 140)}). Programı çevrimdışı kullanmaya devam edebilirsiniz.`
        });
      }
    });
  }

  getState() {
    return { ...this.state };
  }

  /**
   * GitHub Releases'tan latest.yml ve latest.yml.sig dosyalarını çekip Ed25519 ile doğrular.
   * electron-updater v6.x Windows'ta Authenticode (.exe) doğrulaması yapar;
   * Ed25519 manifest doğrulaması ise indirmeden önce bu metotla fail-closed biçimde zorunlu tutulur.
   */
  async verifyRemoteManifestSignature(targetVersion) {
    if (!this.ed25519Required) {
      return { verified: false, skipped: true };
    }
    if (typeof this.fetchImpl !== 'function') {
      throw new Error('Manifest doğrulaması için HTTP istemcisi kullanılamıyor.');
    }
    const tag = `v${String(targetVersion || '').replace(/^v/i, '')}`;
    const base = `https://github.com/${encodeURIComponent(this.sec.githubOwner)}/${encodeURIComponent(this.sec.githubRepo)}/releases/download/${encodeURIComponent(tag)}`;

    const [manifestRes, sigRes] = await Promise.all([
      this.fetchImpl(`${base}/latest.yml`),
      this.fetchImpl(`${base}/latest.yml.sig`)
    ]);
    if (!manifestRes.ok || !sigRes.ok) {
      throw new Error('İmzalı güncelleme manifesti (latest.yml / latest.yml.sig) doğrulanamadı.');
    }
    const manifestBuf = Buffer.from(await manifestRes.arrayBuffer());
    const sigText = (await sigRes.text()).trim();
    const ok = verifyManifestEd25519(manifestBuf, sigText, this.sec.ed25519ManifestPublicKeyPem);
    if (!ok) {
      throw new Error('Güncelleme manifestinin Ed25519 dijital imzası geçersiz! İndirme güvenlik nedeniyle durduruldu.');
    }
    const manifestStr = manifestBuf.toString('utf8');
    if (!manifestStr.includes(`version: ${String(targetVersion).replace(/^v/i, '')}`)) {
      throw new Error('Manifest sürüm numarası hedef sürümle uyuşmuyor.');
    }
    return { verified: true, manifestText: manifestStr };
  }

  async checkForUpdates() {
    const nowIso = new Date().toISOString();
    if (this.backupService) {
      try { this.backupService.savePrefs({ lastUpdateCheckAt: nowIso }); } catch (_e) {}
    }

    if (!this.isPackaged || !this.autoUpdater || !this.updateEnabled) {
      this._emit({
        status: 'unconfigured',
        lastCheckedAt: nowIso,
        message: 'Güncelleme kontrolü yalnızca kurulu masaüstü uygulamasında etkindir.'
      });
      return this.getState();
    }

    try {
      await this.autoUpdater.checkForUpdates();
      return this.getState();
    } catch (err) {
      const rawMsg = String((err && err.message) || err || '');
      const isOffline = /ERR_INTERNET_DISCONNECTED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|net::/i.test(rawMsg);
      this._emit({
        status: isOffline ? 'offline' : 'error',
        lastCheckedAt: nowIso,
        message: isOffline
          ? OFFLINE_UPDATE_MESSAGE
          : `Güncelleme kontrolü tamamlanamadı: ${rawMsg.slice(0, 160)}`
      });
      return this.getState();
    }
  }

  async downloadUpdate() {
    if (!this.isPackaged || !this.autoUpdater || !this.updateEnabled) {
      throw new Error('Güncelleme indirme yalnızca kurulu masaüstü uygulamasında desteklenir.');
    }
    if (this.state.status !== 'available' || !this.state.availableVersion) {
      throw new Error('İndirilecek yeni bir kararlı sürüm bulunmuyor.');
    }
    // Ed25519 açık anahtarı tanımlıysa indirmeden önce manifest imzasını doğrula
    let sigVerified = false;
    if (this.ed25519Required) {
      await this.verifyRemoteManifestSignature(this.state.availableVersion);
      sigVerified = true;
    }
    this._emit({
      status: 'downloading',
      manifestSignatureVerified: sigVerified,
      progressPercent: 0,
      message: 'Güncelleme indiriliyor...'
    });
    // electron-updater HTTPS üzerinden .exe dosyasını indirir ve SHA-512 bütünlüğünü doğrular
    await this.autoUpdater.downloadUpdate();
    return this.getState();
  }

  installDownloadedUpdate(currentProjectSnapshot = null) {
    if (!this.state.downloadedReady || !this.autoUpdater) {
      throw new Error('Kuruluma hazır indirilmiş bir güncelleme bulunamadı.');
    }
    if (this.backupService && currentProjectSnapshot) {
      this.backupService.createBackup(currentProjectSnapshot, {
        reason: 'pre_update',
        label: `v${this.appVersion} -> v${this.state.availableVersion || '?'} Güncelleme Öncesi Yedek`
      });
      const prefs = this.backupService.getPrefs();
      const history = Array.isArray(prefs.updateHistory) ? prefs.updateHistory : [];
      history.unshift({
        fromVersion: this.appVersion,
        toVersion: this.state.availableVersion,
        startedAt: new Date().toISOString()
      });
      this.backupService.savePrefs({ updateHistory: history.slice(0, 20) });
    }
    this.autoUpdater.quitAndInstall(false, true);
    return { installing: true };
  }
}

module.exports = {
  UpdaterService,
  loadUpdateSecurityConfig,
  compareSemver,
  signManifestEd25519,
  verifyManifestEd25519,
  OFFLINE_UPDATE_MESSAGE,
  UNCONFIGURED_OWNER_SENTINEL
};
