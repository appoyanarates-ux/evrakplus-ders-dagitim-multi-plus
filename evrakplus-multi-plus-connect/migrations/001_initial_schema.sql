-- EvrakPlus Ders Dağıtım Köprüsü - Başlangıç Veritabanı Şeması (v1.0.0)
-- Not: Eklenti etkinleştirildiğinde dbDelta ile otomatik oluşturulur.
-- Tablo ön eki (wp_) sitenizin $table_prefix değerine göre değişebilir.

CREATE TABLE IF NOT EXISTS `wp_epdd_device_codes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `device_code_hash` CHAR(64) NOT NULL,
    `user_code` VARCHAR(16) NOT NULL,
    `device_name` VARCHAR(120) NOT NULL DEFAULT 'Windows Masaüstü',
    `app_version` VARCHAR(32) NOT NULL DEFAULT '',
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `user_id` BIGINT UNSIGNED NULL,
    `ip_address` VARCHAR(64) NOT NULL DEFAULT '',
    `created_at` DATETIME NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `approved_at` DATETIME NULL,
    `consumed_at` DATETIME NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_device_code_hash` (`device_code_hash`),
    UNIQUE KEY `uk_user_code` (`user_code`),
    KEY `idx_status_expires` (`status`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_epdd_tokens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `device_id` VARCHAR(64) NOT NULL,
    `device_name` VARCHAR(120) NOT NULL DEFAULT 'Windows Masaüstü',
    `app_version` VARCHAR(32) NOT NULL DEFAULT '',
    `refresh_token_hash` CHAR(64) NOT NULL,
    `last_ip` VARCHAR(64) NOT NULL DEFAULT '',
    `created_at` DATETIME NOT NULL,
    `last_used_at` DATETIME NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `revoked_at` DATETIME NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_refresh_hash` (`refresh_token_hash`),
    KEY `idx_user_revoked` (`user_id`, `revoked_at`),
    KEY `idx_device` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_epdd_projects` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `project_uuid` VARCHAR(64) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `school_name` VARCHAR(200) NOT NULL DEFAULT '',
    `academic_year` VARCHAR(32) NOT NULL DEFAULT '',
    `school_type` VARCHAR(64) NOT NULL DEFAULT '',
    `version` INT UNSIGNED NOT NULL DEFAULT 1,
    `payload_encoding` VARCHAR(16) NOT NULL DEFAULT 'json',
    `payload_data` LONGBLOB NOT NULL,
    `payload_size` INT UNSIGNED NOT NULL DEFAULT 0,
    `payload_sha256` CHAR(64) NOT NULL DEFAULT '',
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    `deleted_at` DATETIME NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_uuid` (`user_id`, `project_uuid`),
    KEY `idx_user_updated` (`user_id`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_epdd_project_history` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `project_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `version` INT UNSIGNED NOT NULL,
    `payload_encoding` VARCHAR(16) NOT NULL DEFAULT 'json',
    `payload_data` LONGBLOB NOT NULL,
    `payload_size` INT UNSIGNED NOT NULL DEFAULT 0,
    `change_note` VARCHAR(255) NOT NULL DEFAULT '',
    `created_at` DATETIME NOT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_project_version` (`project_id`, `version`),
    KEY `idx_user_created` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_epdd_audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NULL,
    `action` VARCHAR(64) NOT NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'ok',
    `detail` VARCHAR(255) NOT NULL DEFAULT '',
    `ip_address` VARCHAR(64) NOT NULL DEFAULT '',
    `created_at` DATETIME NOT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_action_created` (`action`, `created_at`),
    KEY `idx_user_created` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
