import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { sanitizeBackupJson, validateProjectSchema, migrateProject } from '../../../packages/core-schema/src/index.js';

/**
 * EvrakPlus Yerel SQLite Veri Tabanı Deposu (Node 24 yerleşik node:sqlite).
 * İnternet olmadan çevrimdışı veri girişi, proje saklama, çözüm geçmişi ve KVKK denetim kaydı sağlar.
 */
export class SqliteProjectStore {
  constructor(dbPath) {
    this.dbPath = dbPath;
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this._initSchema();
  }

  _initSchema() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS solution_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        engine TEXT NOT NULL,
        status TEXT NOT NULL,
        quality_score REAL NOT NULL DEFAULT 0,
        elapsed_ms INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        placements_json TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        detail TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  saveProject(rawProject) {
    const project = migrateProject(rawProject);
    const check = validateProjectSchema(project);
    if (!check.valid) {
      throw new Error(`Proje doğrulama hatası: ${check.errors.join('; ')}`);
    }
    // KVKK & güvenlik: hiçbir kimlik bilgisi veya token SQLite proje verisine kaydedilmez
    const clean = sanitizeBackupJson(project);
    const now = new Date().toISOString();
    clean.updatedAt = now;

    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, schema_version, revision, updated_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        schema_version = excluded.schema_version,
        revision = excluded.revision,
        updated_at = excluded.updated_at,
        payload_json = excluded.payload_json
    `);
    stmt.run(
      clean.id,
      clean.school.name || 'İsimsiz Okul',
      clean.schemaVersion,
      clean.revision || 1,
      now,
      JSON.stringify(clean)
    );
    this.logAudit('PROJECT_SAVE', `projectId=${clean.id} rev=${clean.revision}`);
    return clean;
  }

  loadProject(projectId) {
    const row = this.db.prepare('SELECT payload_json FROM projects WHERE id = ?').get(projectId);
    return row ? JSON.parse(row.payload_json) : null;
  }

  listProjects() {
    return this.db.prepare(
      'SELECT id, name, schema_version AS schemaVersion, revision, updated_at AS updatedAt FROM projects ORDER BY updated_at DESC'
    ).all();
  }

  deleteProject(projectId) {
    const info = this.db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
    this.logAudit('PROJECT_DELETE', `projectId=${projectId}`);
    return info.changes > 0;
  }

  saveSolutionHistory(projectId, { engine, status, qualityScore = 0, elapsedMs = 0, placements = {} }) {
    const now = new Date().toISOString();
    const info = this.db.prepare(`
      INSERT INTO solution_history (project_id, engine, status, quality_score, elapsed_ms, created_at, placements_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(projectId, engine, status, qualityScore, elapsedMs, now, JSON.stringify(placements));
    return Number(info.lastInsertRowid);
  }

  listSolutionHistory(projectId, limit = 20) {
    return this.db.prepare(`
      SELECT id, project_id AS projectId, engine, status, quality_score AS qualityScore,
             elapsed_ms AS elapsedMs, created_at AS createdAt, placements_json AS placementsJson
      FROM solution_history
      WHERE project_id = ?
      ORDER BY id DESC
      LIMIT ?
    `).all(projectId, limit).map(r => ({
      ...r,
      placements: JSON.parse(r.placementsJson),
      placementsJson: undefined
    }));
  }

  logAudit(action, detail = '') {
    this.db.prepare('INSERT INTO audit_logs (action, detail, created_at) VALUES (?, ?, ?)').run(
      action, detail, new Date().toISOString()
    );
  }

  setSyncMeta(key, value) {
    this.db.prepare(`
      INSERT INTO sync_state (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, String(value), new Date().toISOString());
  }

  getSyncMeta(key) {
    const row = this.db.prepare('SELECT value FROM sync_state WHERE key = ?').get(key);
    return row ? row.value : null;
  }

  close() {
    if (this.db) this.db.close();
  }
}
