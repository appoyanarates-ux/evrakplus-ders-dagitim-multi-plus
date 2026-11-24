'use strict';

/**
 * EvrakPlus Web & Mobil PWA Bulut Senkronizasyon Köprüsü
 * Masaüstü (Electron) ortamında window.dersDagitimAPI kullanılır;
 * Web tarayıcı ve Android/iOS PWA ortamlarında bu modül aynı
 * /wp-json/evrakplus-dd/v1/ REST API uç noktaları üzerinden tam
 * çift yönlü senkronizasyon sağlar.
 */
(function (root) {
  const SESSION_STORAGE_KEY = 'evrakplus_dd_web_session_v1';
  const DEFAULT_BASE_URL = 'https://www.evrakplus.com';
  const API_PREFIX = '/wp-json/evrakplus-dd/v1';

  function resolveBaseUrl(customBaseUrl) {
    if (customBaseUrl) return String(customBaseUrl).replace(/\/+$/, '');
    try {
      const loc = root.location;
      if (loc && loc.protocol === 'https:' && /(^|\.)evrakplus\.com$/i.test(loc.hostname)) {
        return loc.origin.replace(/\/+$/, '');
      }
    } catch (_e) {}
    return DEFAULT_BASE_URL;
  }

  function detectWebDeviceName() {
    const ua = (root.navigator && root.navigator.userAgent) || '';
    const isStandalone = Boolean(
      (root.matchMedia && root.matchMedia('(display-mode: standalone)').matches)
      || (root.navigator && root.navigator.standalone === true)
    );
    const suffix = isStandalone ? 'PWA' : 'Web';
    if (/android/i.test(ua)) return `Android Mobil (${suffix})`;
    if (/iphone|ipad|ipod/i.test(ua)) return `iOS Mobil (${suffix})`;
    if (/windows/i.test(ua)) return `Windows Tarayıcı (${suffix})`;
    if (/macintosh|mac os/i.test(ua)) return `macOS Tarayıcı (${suffix})`;
    return `Web / Mobil (${suffix})`;
  }

  function isAllowedExternalUrl(targetUrl, baseUrl) {
    try {
      const target = new URL(targetUrl);
      if (target.protocol !== 'https:') return false;
      const base = new URL(baseUrl);
      if (target.origin === base.origin) return true;
      // evrakplus.com <-> www.evrakplus.com geçişlerine izin ver
      return /(^|\.)evrakplus\.com$/i.test(target.hostname);
    } catch (_e) {
      return false;
    }
  }

  function createWebEvrakPlusBridge(options = {}) {
    const baseUrl = resolveBaseUrl(options.baseUrl);
    const storage = options.storage || (typeof root.localStorage !== 'undefined' ? root.localStorage : null);
    const fetchImpl = options.fetchImpl || (typeof root.fetch === 'function' ? root.fetch.bind(root) : null);
    const openWindow = options.openWindow || ((url) => {
      if (typeof root.open === 'function') {
        return root.open(url, '_blank', 'noopener');
      }
      return null;
    });

    let session = null;

    function loadSession() {
      if (!storage) return null;
      try {
        const raw = storage.getItem(SESSION_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.user) {
          session = parsed;
          return session;
        }
      } catch (_e) {}
      session = null;
      return null;
    }

    function saveSession(data) {
      session = data;
      if (!storage) return;
      try {
        storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
      } catch (_e) {}
    }

    function clearSession() {
      session = null;
      if (!storage) return;
      try {
        storage.removeItem(SESSION_STORAGE_KEY);
      } catch (_e) {}
    }

    loadSession();

    function evaluateEntitlement(nowMs = Date.now()) {
      if (!session || !session.user || !session.entitlement) {
        return {
          exportAllowed: false,
          status: 'unauthenticated',
          offlineValid: false,
          offlineExpired: false,
          offlineRemainingDays: 0,
          expiresAt: null
        };
      }
      const entWrap = session.entitlement;
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

    function getPublicSession(nowMs = Date.now()) {
      const entStatus = evaluateEntitlement(nowMs);
      if (!session || !session.user) {
        return {
          loggedIn: false,
          isWebBridge: true,
          baseUrl,
          registerUrl: `${baseUrl}/giris/`,
          accountUrl: `${baseUrl}/hesabim/`,
          user: null,
          deviceId: null,
          entitlement: entStatus
        };
      }
      return {
        loggedIn: true,
        isWebBridge: true,
        baseUrl,
        registerUrl: `${baseUrl}/giris/`,
        accountUrl: session.user.account_url || `${baseUrl}/hesabim/`,
        user: {
          id: session.user.id,
          first_name: session.user.first_name || '',
          last_name: session.user.last_name || '',
          full_name: session.user.full_name || session.user.email || 'EvrakPlus Üyesi',
          email: session.user.email || '',
          membership_tier: session.user.membership_tier || 'free_member',
          membership_label: session.user.membership_label || 'Ücretsiz EvrakPlus Üyesi'
        },
        deviceId: session.deviceId || null,
        lastSyncedAt: session.lastSyncedAt || null,
        entitlement: entStatus
      };
    }

    async function request(method, endpoint, { body = null, auth = false, retryOn401 = true } = {}) {
      if (typeof fetchImpl !== 'function') {
        throw new Error('Tarayıcı ağ istemcisi kullanılamıyor.');
      }
      const url = `${baseUrl}${API_PREFIX}${endpoint}`;
      const headers = { 'Accept': 'application/json' };
      if (body !== null) {
        headers['Content-Type'] = 'application/json';
      }
      if (auth) {
        if (!session || !session.accessToken) {
          const err = new Error('Oturum açık değil.');
          err.status = 401;
          throw err;
        }
        headers['Authorization'] = `Bearer ${session.accessToken}`;
      }

      let response;
      try {
        response = await fetchImpl(url, {
          method,
          headers,
          body: body !== null ? JSON.stringify(body) : undefined,
          credentials: 'omit'
        });
      } catch (_netErr) {
        const err = new Error('EvrakPlus sunucusuna bağlanılamadı. İnternet bağlantınızı kontrol edin.');
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

      if (response.status === 401 && auth && retryOn401 && session && session.refreshToken) {
        try {
          await refreshSession();
          return request(method, endpoint, { body, auth, retryOn401: false });
        } catch (_refreshErr) {
          clearSession();
          const err = new Error('Oturumunuzun süresi doldu. Lütfen yeniden giriş yapın.');
          err.status = 401;
          err.code = 'SESSION_EXPIRED';
          throw err;
        }
      }

      return { status: response.status, ok: response.ok, data };
    }

    async function refreshSession() {
      if (!session || !session.refreshToken) {
        throw new Error('Yenilenecek aktif oturum bulunamadı.');
      }
      const res = await request('POST', '/auth/token', {
        body: { grant_type: 'refresh_token', refresh_token: session.refreshToken },
        auth: false
      });
      if (!res.ok || !res.data || !res.data.access_token) {
        clearSession();
        throw new Error((res.data && res.data.message) || 'Oturum yenilenemedi.');
      }
      saveSession({
        deviceId: res.data.device_id || session.deviceId,
        accessToken: res.data.access_token,
        refreshToken: res.data.refresh_token || session.refreshToken,
        expiresAt: res.data.expires_at,
        user: res.data.user || session.user,
        entitlement: res.data.entitlement || session.entitlement,
        lastSyncedAt: new Date().toISOString()
      });
      return getPublicSession();
    }

    return {
      isWebBridge: true,
      baseUrl,

      async evrakplusGetSession() {
        loadSession();
        return getPublicSession();
      },

      async evrakplusStartLogin(opts = {}) {
        const res = await request('POST', '/auth/device', {
          body: {
            device_name: (opts && opts.deviceName) || detectWebDeviceName(),
            app_version: '1.0.7-pwa'
          },
          auth: false
        });
        if (!res.ok || !res.data || !res.data.device_code || !res.data.verification_url) {
          const hint = res.status === 404
            ? 'EvrakPlus WordPress köprü eklentisi henüz sitede etkinleştirilmemiş (404). Lütfen WordPress admin panelinden "EvrakPlus Ders Dağıtım Köprüsü" eklentisini etkinleştirin.'
            : ((res.data && res.data.message) || 'Cihaz eşleştirme kodu oluşturulamadı.');
          throw new Error(hint);
        }
        if (!isAllowedExternalUrl(res.data.verification_url, baseUrl)) {
          throw new Error('Doğrulama adresi güvenilir EvrakPlus alan adıyla eşleşmiyor.');
        }

        let popupBlocked = false;
        if (!opts || opts.openBrowser !== false) {
          const win = openWindow(res.data.verification_url);
          if (!win) popupBlocked = true;
        }

        return {
          deviceCode: res.data.device_code,
          userCode: res.data.user_code,
          verificationUrl: res.data.verification_url,
          expiresIn: res.data.expires_in || 600,
          interval: res.data.interval || 3,
          popupBlocked
        };
      },

      async evrakplusPollLogin(deviceCode) {
        const res = await request('POST', '/auth/token', {
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

        saveSession({
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
          session: getPublicSession()
        };
      },

      async evrakplusRefreshEntitlements() {
        const res = await request('GET', '/entitlements', { auth: true });
        if (!res.ok || !res.data) {
          throw new Error((res.data && res.data.message) || 'Üyelik yetkisi doğrulanamadı.');
        }
        saveSession({
          ...session,
          entitlement: res.data,
          lastSyncedAt: new Date().toISOString()
        });
        return getPublicSession();
      },

      async evrakplusLogout() {
        if (session && session.accessToken) {
          try {
            await request('POST', '/auth/logout', { auth: true, retryOn401: false });
          } catch (_e) {}
        }
        clearSession();
        return { loggedOut: true, session: getPublicSession() };
      },

      async evrakplusListProjects() {
        const res = await request('GET', '/projects', { auth: true });
        if (!res.ok) {
          throw new Error((res.data && res.data.message) || 'Bulut projeleri alınamadı.');
        }
        return (res.data && res.data.projects) || [];
      },

      async evrakplusGetProject(projectUuid) {
        const res = await request('GET', `/projects/${encodeURIComponent(projectUuid)}`, { auth: true });
        if (!res.ok) {
          const err = new Error((res.data && res.data.message) || 'Bulut projesi yüklenemedi.');
          err.status = res.status;
          throw err;
        }
        return res.data;
      },

      async evrakplusDeleteProject(projectUuid) {
        const res = await request('DELETE', `/projects/${encodeURIComponent(projectUuid)}`, { auth: true });
        if (!res.ok) {
          const err = new Error((res.data && res.data.message) || 'Bulut projesi silinemedi.');
          err.status = res.status;
          throw err;
        }
        return res.data;
      },

      async evrakplusSyncProject(payload) {
        const {
          projectUuid,
          baseVersion = 0,
          title,
          schoolName,
          academicYear,
          schoolType,
          payload: projectPayload,
          force = false,
          changeNote = `${detectWebDeviceName()} senkronizasyonu`
        } = payload || {};

        const res = await request('POST', `/projects/${encodeURIComponent(projectUuid)}/sync`, {
          auth: true,
          body: {
            project_uuid: projectUuid,
            base_version: Number(baseVersion) || 0,
            title: title || 'Adsız Ders Programı',
            school_name: schoolName || '',
            academic_year: academicYear || '',
            school_type: schoolType || '',
            payload: projectPayload,
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
      },

      async evrakplusProjectHistory(projectUuid) {
        const res = await request('GET', `/projects/${encodeURIComponent(projectUuid)}/history`, { auth: true });
        if (!res.ok) {
          throw new Error((res.data && res.data.message) || 'Proje geçmişi alınamadı.');
        }
        return (res.data && res.data.history) || [];
      },

      async evrakplusOpenUrl(url) {
        if (!isAllowedExternalUrl(url, baseUrl)) {
          throw new Error('Yalnızca güvenli EvrakPlus bağlantıları açılabilir.');
        }
        openWindow(url);
        return { opened: true };
      }
    };
  }

  // Tarayıcı / PWA ortamında (Electron köprüsü yoksa) otomatik olarak bağla
  if (typeof root.window !== 'undefined') {
    root.EvrakPlusWebBridge = createWebEvrakPlusBridge();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      createWebEvrakPlusBridge,
      resolveBaseUrl,
      detectWebDeviceName,
      isAllowedExternalUrl
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
