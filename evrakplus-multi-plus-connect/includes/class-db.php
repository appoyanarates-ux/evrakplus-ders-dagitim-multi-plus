<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * EvrakPlus Ders Dağıtım veritabanı şeması ve yardımcı metotlar.
 * Mevcut WordPress wp_users tablosunu kullanır; ikinci kullanıcı tablosu oluşturmaz.
 */
class EPDD_DB {

    public static function table($suffix) {
        global $wpdb;
        return $wpdb->prefix . 'epdd_' . $suffix;
    }

    public static function create_tables() {
        global $wpdb;
        $charset = $wpdb->get_charset_collate();

        $t_device_codes = self::table('device_codes');
        $t_tokens       = self::table('tokens');
        $t_projects     = self::table('projects');
        $t_history      = self::table('project_history');
        $t_audit        = self::table('audit_logs');

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $sql_device = "CREATE TABLE {$t_device_codes} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            device_code_hash CHAR(64) NOT NULL,
            user_code VARCHAR(16) NOT NULL,
            device_name VARCHAR(120) NOT NULL DEFAULT 'Windows Masaüstü',
            app_version VARCHAR(32) NOT NULL DEFAULT '',
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            user_id BIGINT UNSIGNED NULL,
            ip_address VARCHAR(64) NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL,
            expires_at DATETIME NOT NULL,
            approved_at DATETIME NULL,
            consumed_at DATETIME NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY uk_device_code_hash (device_code_hash),
            UNIQUE KEY uk_user_code (user_code),
            KEY idx_status_expires (status, expires_at)
        ) {$charset};";

        $sql_tokens = "CREATE TABLE {$t_tokens} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            device_id VARCHAR(64) NOT NULL,
            device_name VARCHAR(120) NOT NULL DEFAULT 'Windows Masaüstü',
            app_version VARCHAR(32) NOT NULL DEFAULT '',
            refresh_token_hash CHAR(64) NOT NULL,
            last_ip VARCHAR(64) NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL,
            last_used_at DATETIME NOT NULL,
            expires_at DATETIME NOT NULL,
            revoked_at DATETIME NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY uk_refresh_hash (refresh_token_hash),
            KEY idx_user_revoked (user_id, revoked_at),
            KEY idx_device (device_id)
        ) {$charset};";

        $sql_projects = "CREATE TABLE {$t_projects} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            project_uuid VARCHAR(64) NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            title VARCHAR(200) NOT NULL,
            school_name VARCHAR(200) NOT NULL DEFAULT '',
            academic_year VARCHAR(32) NOT NULL DEFAULT '',
            school_type VARCHAR(64) NOT NULL DEFAULT '',
            version INT UNSIGNED NOT NULL DEFAULT 1,
            payload_encoding VARCHAR(16) NOT NULL DEFAULT 'json',
            payload_data LONGBLOB NOT NULL,
            payload_size INT UNSIGNED NOT NULL DEFAULT 0,
            payload_sha256 CHAR(64) NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            deleted_at DATETIME NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY uk_user_uuid (user_id, project_uuid),
            KEY idx_user_updated (user_id, updated_at)
        ) {$charset};";

        $sql_history = "CREATE TABLE {$t_history} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            project_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            version INT UNSIGNED NOT NULL,
            payload_encoding VARCHAR(16) NOT NULL DEFAULT 'json',
            payload_data LONGBLOB NOT NULL,
            payload_size INT UNSIGNED NOT NULL DEFAULT 0,
            change_note VARCHAR(255) NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            KEY idx_project_version (project_id, version),
            KEY idx_user_created (user_id, created_at)
        ) {$charset};";

        $sql_audit = "CREATE TABLE {$t_audit} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NULL,
            action VARCHAR(64) NOT NULL,
            status VARCHAR(24) NOT NULL DEFAULT 'ok',
            detail VARCHAR(255) NOT NULL DEFAULT '',
            ip_address VARCHAR(64) NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            KEY idx_action_created (action, created_at),
            KEY idx_user_created (user_id, created_at)
        ) {$charset};";

        dbDelta($sql_device);
        dbDelta($sql_tokens);
        dbDelta($sql_projects);
        dbDelta($sql_history);
        dbDelta($sql_audit);

        update_option('epdd_db_version', EPDD_VERSION);
    }

    public static function log_audit($user_id, $action, $status = 'ok', $detail = '') {
        global $wpdb;
        $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : '';
        $wpdb->insert(
            self::table('audit_logs'),
            array(
                'user_id'    => $user_id ? absint($user_id) : null,
                'action'     => substr(sanitize_key($action), 0, 64),
                'status'     => substr(sanitize_key($status), 0, 24),
                'detail'     => substr(sanitize_text_field($detail), 0, 255),
                'ip_address' => substr($ip, 0, 64),
                'created_at' => current_time('mysql', true),
            ),
            array('%d', '%s', '%s', '%s', '%s', '%s')
        );
    }

    public static function get_settings() {
        $defaults = array(
            'offline_entitlement_days' => 7,
            'max_project_size_mb'      => 10,
            'max_projects_per_user'    => 25,
            'access_token_ttl_sec'     => 900,
            'refresh_token_ttl_days'   => 30,
            'device_code_ttl_sec'      => 600,
            'remote_ortools_url'       => '',
            'require_email_verified'   => 0,
            'allow_pwa_origins'        => 'https://www.evrakplus.com,https://evrakplus.com',
        );
        $saved = get_option('epdd_settings', array());
        if (!is_array($saved)) {
            $saved = array();
        }
        return array_merge($defaults, $saved);
    }
}
