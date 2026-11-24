import crypto from 'node:crypto';
import { sanitizeBackupJson } from '../../core-schema/src/index.js';

export const ConflictResolution = Object.freeze({
  KEEP_SERVER: 'keep_server',
  KEEP_LOCAL: 'keep_local',
  KEEP_BOTH: 'keep_both'
});

/**
 * EvrakPlus Bulut Senkronizasyon Motoru (Masaüstü Electron + Web + Mobil PWA ortak)
 * - UUID, revision, updatedAt ve silme kayıtları (tombstones) tabanlı protokol
 * - Çevrimdışı işlem kuyruğu (outbox) — internet geldiğinde bekleyen işlemleri gönderir
 * - Çakışma tespiti (409 Conflict) — iki cihazda değişen veriyi ASLA sessizce ezmez
 * - Okul/kullanıcı bazlı veri izolasyonu
 */
export class SyncClient {
  constructor({ deviceId, deviceName = 'Cihaz', platform = 'desktop', transport, getAccessToken }) {
    this.deviceId = deviceId || crypto.randomUUID();
    this.deviceName = deviceName;
    this.platform = platform;
    this.transport = transport; // { push(token, payload), pull(token, since) }
    this.getAccessToken = getAccessToken || (() => null);

    this.online = true;
    this.lastSyncAt = null;
    this.pendingQueue = []; // [{ op: 'upsert'|'delete', projectId, baseRevision, project, queuedAt }]
    this.localRevisions = new Map(); // projectId -> last synced server revision
    this.conflicts = [];
  }

  setOnline(isOnline) {
    this.online = Boolean(isOnline);
  }

  getStatus() {
    return {
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      platform: this.platform,
      online: this.online,
      lastSyncAt: this.lastSyncAt,
      pendingCount: this.pendingQueue.length,
      conflictCount: this.conflicts.length
    };
  }

  /** Yerel değişiklik veya silme kaydını senkronizasyon kuyruğuna ekler */
  enqueueUpsert(project) {
    const clean = sanitizeBackupJson(structuredClone(project));
    const baseRevision = this.localRevisions.get(clean.id) ?? 0;
    // Aynı proje için bekleyen eski kuyruk öğesini güncelle
    this.pendingQueue = this.pendingQueue.filter(q => q.projectId !== clean.id);
    this.pendingQueue.push({
      op: 'upsert',
      projectId: clean.id,
      baseRevision,
      project: clean,
      queuedAt: new Date().toISOString()
    });
  }

  enqueueDelete(project) {
    const tombstone = sanitizeBackupJson(structuredClone(project));
    tombstone.deletedAt = new Date().toISOString();
    const baseRevision = this.localRevisions.get(tombstone.id) ?? 0;
    this.pendingQueue = this.pendingQueue.filter(q => q.projectId !== tombstone.id);
    this.pendingQueue.push({
      op: 'delete',
      projectId: tombstone.id,
      baseRevision,
      project: tombstone,
      queuedAt: tombstone.deletedAt
    });
  }

  /**
   * Çevrimdışı kuyruğu sunucuya gönderir ve ardından sunucudaki yeni değişiklikleri çeker.
   * Bulut senkronizasyonu için geçerli kullanıcı hesabı (accessToken) zorunludur.
   */
  async syncNow() {
    const token = this.getAccessToken();
    if (!token) {
      return { ok: false, reason: 'AUTH_REQUIRED', pushed: 0, pulled: [], conflicts: [] };
    }
    if (!this.online) {
      return { ok: false, reason: 'OFFLINE', pushed: 0, pulled: [], conflicts: [], pendingCount: this.pendingQueue.length };
    }

    let pushed = 0;
    const remaining = [];
    const newConflicts = [];

    for (const item of this.pendingQueue) {
      try {
        const res = await this.transport.push(token, {
          deviceId: this.deviceId,
          baseRevision: item.baseRevision,
          project: item.project
        });
        if (res.status === 409 && res.conflict) {
          const conflictEntry = {
            id: crypto.randomUUID(),
            projectId: item.projectId,
            localProject: item.project,
            localBaseRevision: item.baseRevision,
            serverRevision: res.serverRevision,
            serverUpdatedAt: res.serverUpdatedAt,
            serverProject: res.serverProject,
            detectedAt: new Date().toISOString()
          };
          newConflicts.push(conflictEntry);
          this.conflicts.push(conflictEntry);
        } else if (res.ok || res.pushed) {
          this.localRevisions.set(item.projectId, res.revision);
          pushed++;
        } else {
          remaining.push(item);
        }
      } catch {
        // Ağ kesintisi: kuyruk korunur, veri kaybolmaz
        remaining.push(item);
      }
    }
    this.pendingQueue = remaining;

    // Sunucudaki yeni değişiklikleri çek
    let pulled = [];
    try {
      const pullRes = await this.transport.pull(token, this.lastSyncAt || '');
      pulled = pullRes.items || [];
      for (const item of pulled) {
        // Çakışma bekleyen projelerin yerel revizyonunu ezme
        if (!this.conflicts.some(c => c.projectId === item.id)) {
          this.localRevisions.set(item.id, item.revision);
        }
      }
      this.lastSyncAt = pullRes.serverTime || new Date().toISOString();
    } catch {
      return { ok: false, reason: 'NETWORK_ERROR', pushed, pulled: [], conflicts: newConflicts };
    }

    return {
      ok: newConflicts.length === 0,
      reason: newConflicts.length ? 'CONFLICT_DETECTED' : 'SYNCED',
      pushed,
      pulled,
      conflicts: newConflicts
    };
  }

  /**
   * Çakışmayı kullanıcı seçimine göre güvenli biçimde çözer (sıfır sessiz ezme).
   */
  async resolveConflict(conflictId, strategy) {
    const idx = this.conflicts.findIndex(c => c.id === conflictId);
    if (idx < 0) throw new Error('Çakışma kaydı bulunamadı.');
    const c = this.conflicts[idx];
    const token = this.getAccessToken();

    if (strategy === ConflictResolution.KEEP_SERVER) {
      this.localRevisions.set(c.projectId, c.serverRevision);
      this.conflicts.splice(idx, 1);
      return { resolved: true, strategy, winningProject: c.serverProject };
    }

    if (strategy === ConflictResolution.KEEP_LOCAL) {
      const res = await this.transport.push(token, {
        deviceId: this.deviceId,
        baseRevision: c.serverRevision, // Kullanıcı onayıyla yeni revizyon olarak üzerine yaz
        project: c.localProject
      });
      if (!res.pushed) throw new Error('Yerel sürüm sunucuya gönderilemedi.');
      this.localRevisions.set(c.projectId, res.revision);
      this.conflicts.splice(idx, 1);
      return { resolved: true, strategy, revision: res.revision, winningProject: c.localProject };
    }

    if (strategy === ConflictResolution.KEEP_BOTH) {
      // Sunucu sürümünü koru + yerel sürümü yeni UUID ile kopya olarak buluta kaydet
      const copy = structuredClone(c.localProject);
      copy.id = crypto.randomUUID();
      copy.school.name = `${copy.school.name} (Çakışma Kopyası)`;
      copy.revision = 1;
      const res = await this.transport.push(token, {
        deviceId: this.deviceId,
        baseRevision: 0,
        project: copy
      });
      this.localRevisions.set(c.projectId, c.serverRevision);
      this.localRevisions.set(copy.id, res.revision);
      this.conflicts.splice(idx, 1);
      return { resolved: true, strategy, serverProject: c.serverProject, forkedProject: copy };
    }

    throw new Error(`Geçersiz çakışma çözüm stratejisi: ${strategy}`);
  }
}

/**
 * WordPress `/sync/push` ve `/sync/pull` REST uç noktalarıyla birebir aynı protokolü
 * uygulayan bellek-içi test/simülasyon taşıyıcısı (çoklu cihaz entegrasyon testleri için).
 */
export class InMemorySyncServer {
  constructor() {
    this.byUser = new Map(); // token -> Map(projectId -> { revision, updatedAt, deletedAt, project })
  }

  _userStore(token) {
    if (!this.byUser.has(token)) this.byUser.set(token, new Map());
    return this.byUser.get(token);
  }

  async push(token, { baseRevision, project }) {
    const store = this._userStore(token);
    const existing = store.get(project.id);
    if (existing && existing.revision > baseRevision) {
      return {
        ok: false,
        status: 409,
        conflict: true,
        serverRevision: existing.revision,
        serverUpdatedAt: existing.updatedAt,
        serverProject: structuredClone(existing.project)
      };
    }
    const nextRev = existing ? existing.revision + 1 : 1;
    const now = new Date(Date.now() + nextRev).toISOString();
    const storedProj = structuredClone(project);
    storedProj.revision = nextRev;
    storedProj.updatedAt = now;
    store.set(project.id, {
      id: project.id,
      revision: nextRev,
      updatedAt: now,
      deletedAt: storedProj.deletedAt || null,
      project: storedProj
    });
    return { ok: true, pushed: true, projectId: project.id, revision: nextRev, updatedAt: now };
  }

  async pull(token, since = '') {
    const store = this._userStore(token);
    const items = [...store.values()]
      .filter(it => !since || it.updatedAt > since)
      .map(it => structuredClone(it));
    return { serverTime: new Date().toISOString(), items };
  }
}
