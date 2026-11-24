import crypto from 'node:crypto';

export const EVRAKPLUS_LOGIN_URL = 'https://www.evrakplus.com/giris';
export const EVRAKPLUS_API_BASE = 'https://www.evrakplus.com/wp-json/evrakplus/v1';

export function b64urlEncode(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(str) {
  let s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

/**
 * RFC 7636 PKCE (S256) doğrulayıcı ve challenge çifti üretir.
 */
export function generatePkcePair() {
  const codeVerifier = b64urlEncode(crypto.randomBytes(32));
  const codeChallenge = b64urlEncode(crypto.createHash('sha256').update(codeVerifier).digest());
  return { codeVerifier, codeChallenge, method: 'S256' };
}

export function verifyPkce(codeVerifier, expectedChallenge) {
  const computed = b64urlEncode(crypto.createHash('sha256').update(String(codeVerifier)).digest());
  const a = Buffer.from(computed);
  const b = Buffer.from(String(expectedChallenge || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Sunucu tarafı testleri ve imzalama yardımcısı için Ed25519 yetki belgesi imzalar.
 */
export function signOfflineEntitlement(payload, privateKeyPem) {
  const encoded = b64urlEncode(JSON.stringify(payload));
  const sig = crypto.sign(null, Buffer.from(encoded, 'utf8'), privateKeyPem);
  return `${encoded}.${b64urlEncode(sig)}`;
}

/**
 * Masaüstü uygulaması çevrimdışı çıktı yetkisi doğrulayıcısı.
 * Basit JS değişkenine güvenmez: Ed25519 asimetrik imza + cihaz ID + son geçerlilik tarihi (exp) doğrular.
 */
export function verifyOfflineEntitlement(signedToken, publicKeyPem, { expectedDeviceId = null, nowSec = Math.floor(Date.now() / 1000) } = {}) {
  if (!signedToken || typeof signedToken !== 'string' || !signedToken.includes('.')) {
    return { valid: false, reason: 'EXPIRED_OR_MISSING', message: 'İmzalı yetki belgesi eksik.' };
  }
  const [encoded, sigB64] = signedToken.split('.');
  if (!encoded || !sigB64) {
    return { valid: false, reason: 'MALFORMED', message: 'Yetki belgesi biçimi bozuk.' };
  }
  let sigOk = false;
  try {
    sigOk = crypto.verify(null, Buffer.from(encoded, 'utf8'), publicKeyPem, b64urlDecode(sigB64));
  } catch {
    sigOk = false;
  }
  if (!sigOk) {
    return { valid: false, reason: 'INVALID_SIGNATURE', message: 'Yetki belgesi imzası geçersiz.' };
  }
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(encoded).toString('utf8'));
  } catch {
    return { valid: false, reason: 'INVALID_PAYLOAD', message: 'Yetki belgesi okunamadı.' };
  }
  if (!payload.exp || nowSec > Number(payload.exp)) {
    return { valid: false, reason: 'EXPIRED', message: 'Çevrimdışı yetki süresi doldu; lütfen yeniden giriş yapın.' };
  }
  if (expectedDeviceId && payload.deviceId !== expectedDeviceId) {
    return { valid: false, reason: 'DEVICE_MISMATCH', message: 'Yetki belgesi başka bir cihaza aittir.' };
  }
  return {
    valid: true,
    payload,
    canExport: Boolean(payload.canExport),
    canCloudSync: Boolean(payload.canCloudSync),
    expiresAt: new Date(payload.exp * 1000).toISOString()
  };
}

/**
 * Üye olmayan kullanıcı çıktı almak istediğinde gösterilecek standart EvrakPlus bildirimi.
 */
export function getMembershipPromptSpec() {
  return {
    title: 'Ücretsiz üyelik gerekli',
    body: 'EvrakPlus Ders Dağıtım Multi Plus uygulamasını ücretsiz olarak kullanabilirsiniz. Oluşturduğunuz ders programlarını PDF, Excel ve diğer formatlarda indirmek veya yazdırmak için EvrakPlus hesabınızla giriş yapmanız gerekmektedir.',
    subBody: 'Henüz hesabınız yoksa ücretsiz üye olabilirsiniz.',
    buttons: [
      { id: 'login', label: 'Giriş Yap', url: EVRAKPLUS_LOGIN_URL },
      { id: 'register', label: 'Ücretsiz Üye Ol', url: EVRAKPLUS_LOGIN_URL },
      { id: 'later', label: 'Daha Sonra', url: null }
    ]
  };
}
