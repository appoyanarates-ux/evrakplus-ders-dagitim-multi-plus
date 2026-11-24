-- EvrakPlus Ders Dagitim Multi Plus v1.0.0 — MySQL / MariaDB Veri Tabani Semasi
-- Okul bazli veri izolasyonu, UUID + revision tabanli senkronizasyon ve asenkron optimizasyon is kuyrugu.

CREATE TABLE IF NOT EXISTS ep_projects (
  id CHAR(36) NOT NULL,
  wp_user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  school_name VARCHAR(255) NOT NULL,
  schema_version INT NOT NULL DEFAULT 3,
  revision INT NOT NULL DEFAULT 1,
  payload_json LONGTEXT NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  deleted_at DATETIME(3) NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_ep_projects_user (wp_user_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ep_sync_tombstones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  wp_user_id BIGINT UNSIGNED NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id CHAR(36) NOT NULL,
  revision INT NOT NULL DEFAULT 1,
  deleted_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_ep_tombstones_user (wp_user_id, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ep_solver_jobs (
  job_id CHAR(36) NOT NULL,
  wp_user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  project_id CHAR(36) NOT NULL,
  mode VARCHAR(32) NOT NULL DEFAULT 'smart',
  status VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
  solver_server_job_id VARCHAR(128) NULL,
  progress_json TEXT NULL,
  result_json LONGTEXT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (job_id),
  KEY idx_ep_jobs_project (project_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ep_devices (
  device_id CHAR(36) NOT NULL,
  wp_user_id BIGINT UNSIGNED NOT NULL,
  device_name VARCHAR(120) NOT NULL,
  platform VARCHAR(32) NOT NULL,
  last_sync_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (device_id),
  KEY idx_ep_devices_user (wp_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ep_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  wp_user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  action VARCHAR(64) NOT NULL,
  ip_hash CHAR(64) NULL,
  detail TEXT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_ep_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
