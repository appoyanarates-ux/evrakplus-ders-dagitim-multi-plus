/**
 * EvrakPlus Mobil PWA — IndexedDB Çevrimdışı Veri Saklama ve Senkronizasyon Kuyruğu
 * İnternet bağlantısı olmadan proje düzenleme, kayıt ve bağlantı geldiğinde bekleyen
 * değişiklikleri (outbox) güvenli biçimde senkronize etme altyapısı.
 */
const DB_NAME = 'evrakplus_multiplus_db';
const DB_VERSION = 1;

export function openPwaDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Bu tarayıcı IndexedDB desteklemiyor.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'projectId' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut(storeName, value) {
  const db = await openPwaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbGetAll(storeName) {
  const db = await openPwaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function idbDelete(storeName, key) {
  const db = await openPwaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function queueOfflineChange(project) {
  const clean = JSON.parse(JSON.stringify(project));
  delete clean.auth;
  await idbPut('projects', clean);
  await idbPut('outbox', {
    projectId: clean.id,
    project: clean,
    queuedAt: new Date().toISOString()
  });
}

export async function flushOfflineOutbox(pushFn) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { flushed: 0, online: false };
  }
  const items = await idbGetAll('outbox');
  let flushed = 0;
  for (const item of items) {
    try {
      const ok = await pushFn(item.project);
      if (ok) {
        await idbDelete('outbox', item.projectId);
        flushed++;
      }
    } catch {
      // Ağ kesildi; kalanlar outbox içinde korunur
      break;
    }
  }
  return { flushed, remaining: items.length - flushed, online: true };
}
