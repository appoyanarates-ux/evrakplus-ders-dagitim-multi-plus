'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_BASE_URL = 'https://www.evrakplus.com';
const API_PREFIX = '/wp-json/evrakplus-dd/v1';

function isAllowedBaseUrl(urlStr, allowLocalHttp = false) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol === 'https:') return true;
    if (allowLocalHttp && parsed.protocol === 'http:' && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')) {
      return true;
    }
    return false;
  } catch (_e) {
    return false;
  }
}

class EvrakPlusClient {
  constructor(options = {}) {
    this.allowLocalHttp = Boolean(options.allowLocalHttp);
    const configuredUrl = String(options.baseUrl || process.env.EVRAKPLUS_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
    if (!isAllowedBaseUrl(configuredUrl, this.allowLocalHttp)) {
      throw new Error('EvrakPlus bağlantı adresi yalnızca güvenli HTTPS protokolünü destekler.');
    }
    this.baseUrl = configuredUrl;
    this.storageDir = options.storageDir || path.join(os.tmpdir(), 'evrakplus-dd');
    this.sessionFile = path.join(this.storageDir, 'evrakplus_session.enc');
    this.safeStorage = options.safeStorage || null;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.session = null;
    this._loadSession();
  }

  _encryptText(plainText) {
    if (this.safeStorage && typeof this.safeStorage.isEncryptionAvailable === 'function' && this.safeStorage.isEncryptionAvailable()) {
      const buf = this.safeStorage.encryptString(plainText);
      return JSON.stringify({ mode: 'dpapi', data: buf.toString('base64') });
    }
    // safeStorage yalnızca test ortamında veya DPAPI olmayan ortamlarda fallback kullanır
    return JSON.stringify({ mode: 'plain_test', data: Buffer.from(plainText, 'utf8').toString('base64') });
  }

  _decryptText(storedText) {
    const parsed = JSON.parse(storedText);
    if (parsed.mode === 'dpapi') {
      if (!this.safeStorage || typeof this.safeStorage.decryptString !== 'function') {
        throw new Error('İşletim sistemi güvenli depolama servisi kullanılamıyor.');
      }
      return this.safeStorage.decryptString(Buffer.from(parsed.data, 'base64'));
    }
    if (parsed.mode === 'plain_test') {
      return Buffer.from(parsed.data, 'base64').toString('utf8');
    }
    throw new Error('Bilinmeyen oturum depolama biçimi.');
  }

  _loadSession() {
    try {
      if (!fs.existsSync(this.sessionFile)) {
        this.session = null;
        return;
      }
      const raw = fs.readFileSync(this.sessionFile, 'utf8');
      const plain = this._decryptText(raw);
      const data = JSON.parse(plain);
      if (data && typeof data === 'object' && data.user) {
        this.session = data;
      } else {
        this.session = null;
      }
    } catch (_err) {
      this.session = null;
    }
  }

  _saveSession(data) {
    this.session = data;
    fs.mkdirSync(this.storageDir, { recursive: true });
    const encrypted = this._encryptText(JSON.stringify(data));
    fs.writeFileSync(this.sessionFile, encrypted, { encoding: 'utf8', mode: 0o600 });
  }

  _clearSession() {
    this.session = null;
    try {
      if (fs.existsSync(this.sessionFile)) {
        fs.unlinkSync(this.sessionFile);
      }
    } catch (_err) {}
  }

  isUrlAllowedForExternalOpen(targetUrl) {
    try {
      const target = new URL(targetUrl);
      const base = new URL(this.baseUrl);
      if (target.origin !== base.origin) return false;
      return target.protocol === 'https:' || (this.allowLocalHttp && target.protocol === 'http:');
    } catch (_e) {
      return false;
    }
  }

  evaluateEntitlement(nowMs = Date.now()) {
    if (!this.session || !this.session.user || !this.session.entitlement) {
      return {
        exportAllowed: false,
        status: 'unauthenticated',
        offlineValid: false,
        offlineExpired: false,
        offlineRemainingDays: 0,
        expiresAt: null
      };
    }

    const entWrap = this.session.entitlement;
    const claims = entWrap.entitlement || entWrap;
    const signedToken = entWrap.signed_token || '';
    const expiresAt = claims.expires_at || claims.expiresAt || null;

    if (!signedToken || !expiresAt) {
      return {
        exportAllowed: false,
        status: 'missing_entitlement',
        offlineValid: false,
        offlineExpired: false,
        offlineRemainingDays: 0,
        expiresAt: null
      };
    }

    const expMs = Date.parse(expiresAt);
    if (Number.isNaN(expMs) || expMs <= nowMs) {
      return {
        exportAllowed: false,
        status: 'entitlement_expired',
        offlineValid: false,
        offlineExpired: true,
        offlineRemainingDays: 0,
        expiresAt
      };
    }

    const remainingDays = Math.max(1, Math.ceil((expMs - nowMs) / (24 * 60 * 60 * 1000)));
    return {
      exportAllowed: Boolean(claims.can_export_pdf !== false && claims.can_export_excel !== false),
      status: 'active',
      offlineValid: true,
      offlineExpired: false,
      offlineRemainingDays: remainingDays,
      expiresAt,
      membershipLabel: claims.membership_label || 'Ücretsiz EvrakPlus Üyesi'
    };
  }

  /**
   * Renderer'a gönderilen güvenli oturum özeti (ASLA ham token içermez).
   */
  getPublicSession(nowMs = Date.now()) {
    const entStatus = this.evaluateEntitlement(nowMs);
    if (!this.session || !this.session.user) {
      return {
        loggedIn: false,
        baseUrl: this.baseUrl,
        registerUrl: `${this.baseUrl}/giris/`,
        accountUrl: `${this.baseUrl}/hesabim/`,
        user: null,
        deviceId: null,
        entitlement: entStatus
      };
    }

    return {
      loggedIn: true,
      baseUrl: this.baseUrl,
      registerUrl: `${this.baseUrl}/giris/`,
      accountUrl: this.session.user.account_url || `${this.baseUrl}/hesabim/`,
      user: {
        id: this.session.user.id,
        first_name: this.session.user.first_name || '',
        last_name: this.session.user.last_name || '',
        full_name: this.session.user.full_name || this.session.user.email || 'EvrakPlus Üyesi',
        email: this.session.user.email || '',
        membership_tier: this.session.user.membership_tier || 'free_member',
        membership_label: this.session.user.membership_label || 'Ücretsiz EvrakPlus Üyesi'
      },
      deviceId: this.session.deviceId || null,
      lastSyncedAt: this.session.lastSyncedAt || null,
      entitlement: entStatus
    };
  }

  async _request(method, endpoint, { body = null, auth = false, retryOn401 = true } = {}) {
    if (typeof this.fetchImpl !== 'function') {
      throw new Error('HTTP istemcisi kullanılamıyor.');
    }
    const url = `${this.baseUrl}${API_PREFIX}${endpoint}`;
    const headers = {
      'Accept': 'application/json',
      'User-Agent': 'EvrakPlus-DersDagitim-Desktop/1.4.0'
    };
    if (body !== null) {
      headers['Content-Type'] = 'application/json';
    }
    if (auth) {
      if (!this.session || !this.session.accessToken) {
        const err = new Error('Oturum açık değil.');
        err.status = 401;
        throw err;
      }
      headers['Authorization'] = `Bearer ${this.session.accessToken}`;
    }

    let response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        body: body !== null ? JSON.stringify(body) : undefined
      });
    } catch (netErr) {
      const detail = String((netErr && netErr.message) || '');
      const isCert = /CERT|SSL|TLS|UNABLE_TO_VERIFY/i.test(detail);
      const err = new Error(
        isCert
          ? 'Güvenli bağlantı sertifikası doğrulanamadı. MEB okul ağındaysanız Windows MEB Sertifikasının kurulu olduğundan emin olun.'
          : 'EvrakPlus sunucusuna bağlanılamadı. İnternet bağlantınızı veya MEB okul ağı filtresini kontrol edin.'
      );
      err.code = 'NETWORK_OFFLINE';
      throw err;
    }

    let data = null;
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (_e) {
        data = { message: text.slice(0, 200) };
      }
    }

    if (response.status === 401 && auth && retryOn401 && this.session && this.session.refreshToken) {
      try {
        await this.refreshSession();
        return this._request(method, endpoint, { body, auth, retryOn401: false });
      } catch (_refreshErr) {
        this._clearSession();
        const err = new Error('Oturumunuzun süresi doldu veya sonlandırıldı. Lütfen yeniden giriş yapın.');
        err.status = 401;
        err.code = 'SESSION_EXPIRED';
        throw err;
      }
    }

    return { status: response.status, ok: response.ok, data };
  }

  async startDeviceLogin({ deviceName = `${os.hostname()} (Windows)`, appVersion = '1.4.0' } = {}) {
    const res = await this._request('POST', '/auth/device', {
      body: { device_name: deviceName, app_version: appVersion },
      auth: false
    });
    if (!res.ok || !res.data || !res.data.device_code || !res.data.verification_url) {
      throw new Error((res.data && res.data.message) || 'Cihaz eşleştirme kodu oluşturulamadı.');
    }
    if (!this.isUrlAllowedForExternalOpen(res.data.verification_url)) {
      throw new Error('Doğrulama adresi güvenilir EvrakPlus alan adıyla eşleşmiyor.');
    }
    return {
      deviceCode: res.data.device_code,
      userCode: res.data.user_code,
      verificationUrl: res.data.verification_url,
      expiresIn: res.data.expires_in || 600,
      interval: res.data.interval || 3
    };
  }

  async pollDeviceLogin(deviceCode) {
    const res = await this._request('POST', '/auth/token', {
      body: { grant_type: 'device_code', device_code: deviceCode },
      auth: false
    });
    if (res.status === 202 || (res.data && res.data.status === 'authorization_pending')) {
      return { status: 'pending' };
    }
    if (res.status === 403) {
      return { status: 'denied', message: (res.data && res.data.message) || 'Eşleştirme reddedildi.' };
    }
    if (res.status === 410) {
      return { status: 'expired', message: (res.data && res.data.message) || 'Eşleştirme kodunun süresi doldu.' };
    }
    if (!res.ok || !res.data || !res.data.access_token) {
      return { status: 'error', message: (res.data && res.data.message) || 'Giriş doğrulanamadı.' };
    }

    this._saveSession({
      deviceId: res.data.device_id,
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
      expiresAt: res.data.expires_at,
      user: res.data.user,
      entitlement: res.data.entitlement,
      lastSyncedAt: new Date().toISOString()
    });

    return {
      status: 'approved',
      session: this.getPublicSession()
    };
  }

  async refreshSession() {
    if (!this.session || !this.session.refreshToken) {
      throw new Error('Yenilenecek aktif oturum bulunamadı.');
    }
    const res = await this._request('POST', '/auth/token', {
      body: { grant_type: 'refresh_token', refresh_token: this.session.refreshToken },
      auth: false
    });
    if (!res.ok || !res.data || !res.data.access_token) {
      this._clearSession();
      throw new Error((res.data && res.data.message) || 'Oturum yenilenemedi.');
    }
    this._saveSession({
      deviceId: res.data.device_id || this.session.deviceId,
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token || this.session.refreshToken,
      expiresAt: res.data.expires_at,
      user: res.data.user || this.session.user,
      entitlement: res.data.entitlement || this.session.entitlement,
      lastSyncedAt: new Date().toISOString()
    });
    return this.getPublicSession();
  }

  async refreshEntitlements() {
    const res = await this._request('GET', '/entitlements', { auth: true });
    if (!res.ok || !res.data) {
      throw new Error((res.data && res.data.message) || 'Üyelik yetkisi doğrulanamadı.');
    }
    this._saveSession({
      ...this.session,
      entitlement: res.data,
      lastSyncedAt: new Date().toISOString()
    });
    return this.getPublicSession();
  }

  async logout() {
    if (this.session && this.session.accessToken) {
      try {
        await this._request('POST', '/auth/logout', { auth: true, retryOn401: false });
      } catch (_err) {
        // Çevrimdışıyken bile yerel oturum mutlaka temizlenir
      }
    }
    this._clearSession();
    return { loggedOut: true, session: this.getPublicSession() };
  }

  async listProjects() {
    const res = await this._request('GET', '/projects', { auth: true });
    if (!res.ok) {
      throw new Error((res.data && res.data.message) || 'Bulut projeleri alınamadı.');
    }
    return res.data.projects || [];
  }

  async getProject(projectUuid) {
    const res = await this._request('GET', `/projects/${encodeURIComponent(projectUuid)}`, { auth: true });
    if (!res.ok) {
      const err = new Error((res.data && res.data.message) || 'Bulut projesi yüklenemedi.');
      err.status = res.status;
      throw err;
    }
    return res.data;
  }

  async deleteProject(projectUuid) {
    const res = await this._request('DELETE', `/projects/${encodeURIComponent(projectUuid)}`, { auth: true });
    if (!res.ok) {
      const err = new Error((res.data && res.data.message) || 'Bulut projesi silinemedi.');
      err.status = res.status;
      throw err;
    }
    return res.data;
  }

  async syncProject({ projectUuid, baseVersion = 0, title, schoolName, academicYear, schoolType, payload, force = false, changeNote = 'Masaüstü senkronizasyonu' }) {
    const res = await this._request('POST', `/projects/${encodeURIComponent(projectUuid)}/sync`, {
      auth: true,
      body: {
        project_uuid: projectUuid,
        base_version: Number(baseVersion) || 0,
        title: title || 'Adsız Ders Programı',
        school_name: schoolName || '',
        academic_year: academicYear || '',
        school_type: schoolType || '',
        payload,
        force: Boolean(force),
        change_note: changeNote
      }
    });

    if (res.status === 409) {
      return {
        status: 'conflict',
        message: (res.data && res.data.message) || 'Bulutta daha güncel bir sürüm var.',
        serverVersion: res.data && res.data.server_version,
        serverUpdatedAt: res.data && res.data.server_updated_at,
        serverProject: res.data && res.data.server_project
      };
    }

    if (!res.ok) {
      const err = new Error((res.data && res.data.message) || 'Bulut senkronizasyonu başarısız oldu.');
      err.status = res.status;
      throw err;
    }

    return {
      status: 'synced',
      id: res.data.id,
      projectUuid: res.data.project_uuid,
      version: res.data.version,
      updatedAt: res.data.updated_at,
      payloadSize: res.data.payload_size
    };
  }

  async getProjectHistory(projectUuid) {
    const res = await this._request('GET', `/projects/${encodeURIComponent(projectUuid)}/history`, { auth: true });
    if (!res.ok) {
      throw new Error((res.data && res.data.message) || 'Proje geçmişi alınamadı.');
    }
    return res.data.history || [];
  }
}

module.exports = {
  EvrakPlusClient,
  DEFAULT_BASE_URL,
  API_PREFIX,
  isAllowedBaseUrl
};
