<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * EvrakPlus Ders Dağıtım REST API Uç Noktaları (/wp-json/evrakplus-dd/v1/)
 */
class EPDD_Rest_API {

    public static function init() {
        add_action('rest_api_init', array(__CLASS__, 'register_routes'));
        add_action('rest_api_init', array(__CLASS__, 'register_cors_headers'), 15);
    }

    /**
     * Yalnızca /evrakplus-dd/v1/ uç noktaları ve ayarlardaki izinli kökenler için kesin CORS başlıkları ekler.
     */
    public static function register_cors_headers() {
        add_filter('rest_pre_serve_request', function ($value, $result, $request) {
            if (!$request instanceof WP_REST_Request) {
                return $value;
            }
            $route = (string) $request->get_route();
            if (strpos($route, '/' . EPDD_REST_NAMESPACE . '/') !== 0) {
                return $value;
            }
            $origin = isset($_SERVER['HTTP_ORIGIN']) ? trim((string) wp_unslash($_SERVER['HTTP_ORIGIN'])) : '';
            if ($origin === '') {
                return $value;
            }
            $settings = EPDD_DB::get_settings();
            $allowed_raw = array_map('trim', explode(',', (string) $settings['allow_pwa_origins']));
            if (in_array($origin, $allowed_raw, true)) {
                header('Access-Control-Allow-Origin: ' . $origin);
                header('Vary: Origin');
                header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
                header('Access-Control-Allow-Headers: Authorization, Content-Type');
            }
            return $value;
        }, 10, 3);
    }

    public static function register_routes() {
        $ns = EPDD_REST_NAMESPACE;

        // 1. Cihaz eşleştirme başlat
        register_rest_route($ns, '/auth/device', array(
            'methods'             => 'POST',
            'callback'            => array(__CLASS__, 'handle_auth_device'),
            'permission_callback' => '__return_true',
        ));

        // 2. Cihaz kodu -> belirteç veya refresh_token -> yeni belirteç
        register_rest_route($ns, '/auth/token', array(
            'methods'             => 'POST',
            'callback'            => array(__CLASS__, 'handle_auth_token'),
            'permission_callback' => '__return_true',
        ));

        // 3. Oturum açmış kullanıcı profili
        register_rest_route($ns, '/auth/me', array(
            'methods'             => 'GET',
            'callback'            => array(__CLASS__, 'handle_auth_me'),
            'permission_callback' => array(__CLASS__, 'require_bearer_auth'),
        ));

        // 4. Oturumu sunucuda kapat
        register_rest_route($ns, '/auth/logout', array(
            'methods'             => 'POST',
            'callback'            => array(__CLASS__, 'handle_auth_logout'),
            'permission_callback' => array(__CLASS__, 'require_bearer_auth'),
        ));

        // 5. Çıktı & çevrimdışı yetkiler (7 gün imzalı)
        register_rest_route($ns, '/entitlements', array(
            'methods'             => 'GET',
            'callback'            => array(__CLASS__, 'handle_entitlements'),
            'permission_callback' => array(__CLASS__, 'require_bearer_auth'),
        ));

        // 6. Bulut projeleri listele / oluştur
        register_rest_route($ns, '/projects', array(
            array(
                'methods'             => 'GET',
                'callback'            => array(__CLASS__, 'handle_list_projects'),
                'permission_callback' => array(__CLASS__, 'require_bearer_auth'),
            ),
            array(
                'methods'             => 'POST',
                'callback'            => array(__CLASS__, 'handle_create_project'),
                'permission_callback' => array(__CLASS__, 'require_bearer_auth'),
            ),
        ));

        // 7. Tekil proje oku / sil
        register_rest_route($ns, '/projects/(?P<id>[a-zA-Z0-9_-]+)', array(
            array(
                'methods'             => 'GET',
                'callback'            => array(__CLASS__, 'handle_get_project'),
                'permission_callback' => array(__CLASS__, 'require_bearer_auth'),
            ),
            array(
                'methods'             => 'DELETE',
                'callback'            => array(__CLASS__, 'handle_delete_project'),
                'permission_callback' => array(__CLASS__, 'require_bearer_auth'),
            ),
        ));

        // 8. Proje senkronizasyonu (optimistic locking / 409 conflict)
        register_rest_route($ns, '/projects/(?P<id>[a-zA-Z0-9_-]+)/sync', array(
            'methods'             => 'POST',
            'callback'            => array(__CLASS__, 'handle_sync_project'),
            'permission_callback' => array(__CLASS__, 'require_bearer_auth'),
        ));

        // 9. Proje sürüm geçmişi
        register_rest_route($ns, '/projects/(?P<id>[a-zA-Z0-9_-]+)/history', array(
            'methods'             => 'GET',
            'callback'            => array(__CLASS__, 'handle_project_history'),
            'permission_callback' => array(__CLASS__, 'require_bearer_auth'),
        ));
    }

    public static function require_bearer_auth(WP_REST_Request $request) {
        $auth_header = $request->get_header('authorization');
        if (!$auth_header || stripos($auth_header, 'Bearer ') !== 0) {
            return new WP_Error('epdd_unauthorized', 'Yetkilendirme başlığı (Bearer token) eksik.', array('status' => 401));
        }
        $jwt = trim(substr($auth_header, 7));
        $verified = EPDD_Auth::verify_access_token($jwt);
        if (is_wp_error($verified)) {
            return $verified;
        }
        $request->set_param('_epdd_auth', $verified);
        return true;
    }

    private static function get_auth(WP_REST_Request $request) {
        return $request->get_param('_epdd_auth');
    }

    public static function handle_auth_device(WP_REST_Request $request) {
        if (!EPDD_Auth::check_rate_limit('auth_device', 20, 60)) {
            return new WP_Error('epdd_rate_limited', 'Çok fazla istek. Lütfen kısa süre sonra tekrar deneyin.', array('status' => 429));
        }
        $device_name = sanitize_text_field($request->get_param('device_name') ?: 'Windows Masaüstü');
        $app_version = sanitize_text_field($request->get_param('app_version') ?: '');
        $data = EPDD_Auth::create_device_code($device_name, $app_version);
        return rest_ensure_response($data);
    }

    public static function handle_auth_token(WP_REST_Request $request) {
        if (!EPDD_Auth::check_rate_limit('auth_token', 60, 60)) {
            return new WP_Error('epdd_rate_limited', 'Çok fazla belirteç isteği.', array('status' => 429));
        }
        $grant_type = sanitize_key($request->get_param('grant_type') ?: '');

        if ($grant_type === 'device_code') {
            $device_code = (string) $request->get_param('device_code');
            if ($device_code === '') {
                return new WP_Error('epdd_missing_code', 'device_code gereklidir.', array('status' => 400));
            }
            global $wpdb;
            $table = EPDD_DB::table('device_codes');
            $hash = EPDD_Auth::hash_token($device_code);
            $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE device_code_hash = %s LIMIT 1", $hash));

            if (!$row) {
                return new WP_Error('epdd_invalid_code', 'Geçersiz cihaz eşleştirme kodu.', array('status' => 400));
            }
            if (strtotime($row->expires_at . ' UTC') < time()) {
                return new WP_Error('epdd_expired_code', 'Eşleştirme kodunun süresi doldu.', array('status' => 410));
            }
            if ($row->status === 'pending') {
                return new WP_REST_Response(array('status' => 'authorization_pending'), 202);
            }
            if ($row->status === 'denied') {
                return new WP_Error('epdd_access_denied', 'Eşleştirme kullanıcı tarafından reddedildi.', array('status' => 403));
            }
            if ($row->status === 'consumed') {
                return new WP_Error('epdd_code_used', 'Bu eşleştirme kodu daha önce kullanıldı.', array('status' => 400));
            }
            if ($row->status === 'approved' && !empty($row->user_id)) {
                $wpdb->update(
                    $table,
                    array('status' => 'consumed', 'consumed_at' => gmdate('Y-m-d H:i:s')),
                    array('id' => (int) $row->id),
                    array('%s', '%s'),
                    array('%d')
                );
                $session = EPDD_Auth::create_session_tokens((int) $row->user_id, $row->device_name, $row->app_version);
                EPDD_DB::log_audit((int) $row->user_id, 'device_login', 'ok', 'Masaüstü oturum açıldı: ' . $row->device_name);
                return rest_ensure_response($session);
            }
            return new WP_Error('epdd_invalid_state', 'Beklenmeyen eşleştirme durumu.', array('status' => 400));
        }

        if ($grant_type === 'refresh_token') {
            $refresh = (string) $request->get_param('refresh_token');
            if ($refresh === '') {
                return new WP_Error('epdd_missing_refresh', 'refresh_token gereklidir.', array('status' => 400));
            }
            $rotated = EPDD_Auth::rotate_refresh_token($refresh);
            if (is_wp_error($rotated)) {
                return $rotated;
            }
            return rest_ensure_response($rotated);
        }

        return new WP_Error('epdd_unsupported_grant', 'Desteklenmeyen grant_type.', array('status' => 400));
    }

    public static function handle_auth_me(WP_REST_Request $request) {
        $auth = self::get_auth($request);
        return rest_ensure_response(array(
            'user'      => EPDD_Auth::format_user_profile($auth['user']),
            'device_id' => $auth['device_id'],
        ));
    }

    public static function handle_auth_logout(WP_REST_Request $request) {
        $auth = self::get_auth($request);
        EPDD_Auth::revoke_device_session($auth['user_id'], $auth['device_id']);
        return rest_ensure_response(array('logged_out' => true));
    }

    public static function handle_entitlements(WP_REST_Request $request) {
        $auth = self::get_auth($request);
        $ent = EPDD_Auth::build_entitlement($auth['user_id'], $auth['device_id']);
        return rest_ensure_response($ent);
    }

    private static function find_user_project($user_id, $id_or_uuid) {
        global $wpdb;
        $table = EPDD_DB::table('projects');
        return $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$table} WHERE user_id = %d AND deleted_at IS NULL AND (project_uuid = %s OR CAST(id AS CHAR) = %s) LIMIT 1",
                (int) $user_id,
                (string) $id_or_uuid,
                (string) $id_or_uuid
            )
        );
    }

    private static function decode_project_payload($row) {
        $raw = $row->payload_data;
        if ($row->payload_encoding === 'gzip' && function_exists('gzdecode')) {
            $decoded = @gzdecode($raw);
            if ($decoded !== false) {
                $raw = $decoded;
            }
        }
        $json = json_decode($raw, true);
        return is_array($json) ? $json : null;
    }

    private static function encode_project_payload($payload) {
        $json = wp_json_encode($payload);
        $settings = EPDD_DB::get_settings();
        $max_bytes = max(1, (int) $settings['max_project_size_mb']) * 1024 * 1024;
        if (strlen($json) > $max_bytes) {
            return new WP_Error('epdd_payload_too_large', 'Proje verisi izin verilen boyut sınırını aşıyor.', array('status' => 413));
        }
        $sha = hash('sha256', $json);
        if (function_exists('gzencode') && strlen($json) > 8192) {
            $gz = gzencode($json, 6);
            if ($gz !== false) {
                return array('encoding' => 'gzip', 'data' => $gz, 'size' => strlen($gz), 'sha256' => $sha);
            }
        }
        return array('encoding' => 'json', 'data' => $json, 'size' => strlen($json), 'sha256' => $sha);
    }

    public static function handle_list_projects(WP_REST_Request $request) {
        global $wpdb;
        $auth = self::get_auth($request);
        $table = EPDD_DB::table('projects');
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT id, project_uuid, title, school_name, academic_year, school_type, version, payload_size, created_at, updated_at
                 FROM {$table}
                 WHERE user_id = %d AND deleted_at IS NULL
                 ORDER BY updated_at DESC",
                $auth['user_id']
            ),
            ARRAY_A
        );
        return rest_ensure_response(array('projects' => $rows ?: array()));
    }

    public static function handle_create_project(WP_REST_Request $request) {
        global $wpdb;
        $auth = self::get_auth($request);
        $settings = EPDD_DB::get_settings();
        $table = EPDD_DB::table('projects');

        $count = (int) $wpdb->get_var(
            $wpdb->prepare("SELECT COUNT(*) FROM {$table} WHERE user_id = %d AND deleted_at IS NULL", $auth['user_id'])
        );
        if ($count >= (int) $settings['max_projects_per_user']) {
            return new WP_Error('epdd_project_limit', 'Maksimum bulut proje sayısına ulaşıldı.', array('status' => 403));
        }

        $project_uuid = sanitize_text_field($request->get_param('project_uuid') ?: ('prj_' . bin2hex(random_bytes(12))));
        $title        = sanitize_text_field($request->get_param('title') ?: 'Adsız Ders Programı');
        $school_name  = sanitize_text_field($request->get_param('school_name') ?: '');
        $academic_yr  = sanitize_text_field($request->get_param('academic_year') ?: '');
        $school_type  = sanitize_text_field($request->get_param('school_type') ?: '');
        $payload      = $request->get_param('payload');

        if (!is_array($payload)) {
            return new WP_Error('epdd_invalid_payload', 'Proje verisi geçerli bir JSON nesnesi olmalıdır.', array('status' => 400));
        }

        $encoded = self::encode_project_payload($payload);
        if (is_wp_error($encoded)) {
            return $encoded;
        }

        $now = gmdate('Y-m-d H:i:s');
        $wpdb->insert(
            $table,
            array(
                'project_uuid'     => substr($project_uuid, 0, 64),
                'user_id'          => $auth['user_id'],
                'title'            => substr($title, 0, 200),
                'school_name'      => substr($school_name, 0, 200),
                'academic_year'    => substr($academic_yr, 0, 32),
                'school_type'      => substr($school_type, 0, 64),
                'version'          => 1,
                'payload_encoding' => $encoded['encoding'],
                'payload_data'     => $encoded['data'],
                'payload_size'     => $encoded['size'],
                'payload_sha256'   => $encoded['sha256'],
                'created_at'       => $now,
                'updated_at'       => $now,
            ),
            array('%s', '%d', '%s', '%s', '%s', '%s', '%d', '%s', '%s', '%d', '%s', '%s', '%s')
        );
        $project_id = (int) $wpdb->insert_id;

        $wpdb->insert(
            EPDD_DB::table('project_history'),
            array(
                'project_id'       => $project_id,
                'user_id'          => $auth['user_id'],
                'version'          => 1,
                'payload_encoding' => $encoded['encoding'],
                'payload_data'     => $encoded['data'],
                'payload_size'     => $encoded['size'],
                'change_note'      => 'İlk bulut kaydı',
                'created_at'       => $now,
            ),
            array('%d', '%d', '%d', '%s', '%s', '%d', '%s', '%s')
        );

        EPDD_DB::log_audit($auth['user_id'], 'project_create', 'ok', 'Proje oluşturuldu: ' . $project_uuid);

        return new WP_REST_Response(array(
            'id'           => $project_id,
            'project_uuid' => $project_uuid,
            'title'        => $title,
            'version'      => 1,
            'updated_at'   => $now,
            'payload_size' => $encoded['size'],
        ), 201);
    }

    public static function handle_get_project(WP_REST_Request $request) {
        $auth = self::get_auth($request);
        $row = self::find_user_project($auth['user_id'], $request->get_param('id'));
        if (!$row) {
            return new WP_Error('epdd_not_found', 'Proje bulunamadı veya erişim yetkiniz yok.', array('status' => 404));
        }
        return rest_ensure_response(array(
            'id'            => (int) $row->id,
            'project_uuid'  => $row->project_uuid,
            'title'         => $row->title,
            'school_name'   => $row->school_name,
            'academic_year' => $row->academic_year,
            'school_type'   => $row->school_type,
            'version'       => (int) $row->version,
            'updated_at'    => $row->updated_at,
            'payload_size'  => (int) $row->payload_size,
            'payload'       => self::decode_project_payload($row),
        ));
    }

    public static function handle_delete_project(WP_REST_Request $request) {
        global $wpdb;
        $auth = self::get_auth($request);
        $row = self::find_user_project($auth['user_id'], $request->get_param('id'));
        if (!$row) {
            return new WP_Error('epdd_not_found', 'Proje bulunamadı veya erişim yetkiniz yok.', array('status' => 404));
        }
        $wpdb->update(
            EPDD_DB::table('projects'),
            array('deleted_at' => gmdate('Y-m-d H:i:s')),
            array('id' => (int) $row->id, 'user_id' => $auth['user_id']),
            array('%s'),
            array('%d', '%d')
        );
        EPDD_DB::log_audit($auth['user_id'], 'project_delete', 'ok', 'Proje silindi: ' . $row->project_uuid);
        return rest_ensure_response(array('deleted' => true, 'project_uuid' => $row->project_uuid));
    }

    public static function handle_sync_project(WP_REST_Request $request) {
        global $wpdb;
        $auth = self::get_auth($request);
        $id_param = $request->get_param('id');
        $row = self::find_user_project($auth['user_id'], $id_param);

        if (!$row) {
            // Proje henüz yoksa create ile oluştur
            $request->set_param('project_uuid', $id_param);
            return self::handle_create_project($request);
        }

        $base_version = (int) $request->get_param('base_version');
        $force        = (bool) $request->get_param('force');
        $server_ver   = (int) $row->version;

        if (!$force && $base_version !== $server_ver) {
            EPDD_DB::log_audit($auth['user_id'], 'project_sync_conflict', 'conflict', 'Sürüm çakışması: yerel=' . $base_version . ', bulut=' . $server_ver);
            return new WP_REST_Response(array(
                'code'           => 'epdd_sync_conflict',
                'message'        => 'Bulut projesinde daha güncel bir sürüm bulunuyor. Çakışma çözümü gerekiyor.',
                'server_version' => $server_ver,
                'server_updated_at' => $row->updated_at,
                'server_project' => array(
                    'id'            => (int) $row->id,
                    'project_uuid'  => $row->project_uuid,
                    'title'         => $row->title,
                    'version'       => $server_ver,
                    'updated_at'    => $row->updated_at,
                    'payload'       => self::decode_project_payload($row),
                ),
            ), 409);
        }

        $payload = $request->get_param('payload');
        if (!is_array($payload)) {
            return new WP_Error('epdd_invalid_payload', 'Proje verisi geçerli bir JSON nesnesi olmalıdır.', array('status' => 400));
        }

        $encoded = self::encode_project_payload($payload);
        if (is_wp_error($encoded)) {
            return $encoded;
        }

        $new_ver     = $server_ver + 1;
        $now         = gmdate('Y-m-d H:i:s');
        $title       = sanitize_text_field($request->get_param('title') ?: $row->title);
        $school_name = sanitize_text_field($request->get_param('school_name') ?: $row->school_name);
        $academic_yr = sanitize_text_field($request->get_param('academic_year') ?: $row->academic_year);
        $school_type = sanitize_text_field($request->get_param('school_type') ?: $row->school_type);
        $change_note = sanitize_text_field($request->get_param('change_note') ?: 'Senkronizasyon');

        $wpdb->update(
            EPDD_DB::table('projects'),
            array(
                'title'            => substr($title, 0, 200),
                'school_name'      => substr($school_name, 0, 200),
                'academic_year'    => substr($academic_yr, 0, 32),
                'school_type'      => substr($school_type, 0, 64),
                'version'          => $new_ver,
                'payload_encoding' => $encoded['encoding'],
                'payload_data'     => $encoded['data'],
                'payload_size'     => $encoded['size'],
                'payload_sha256'   => $encoded['sha256'],
                'updated_at'       => $now,
            ),
            array('id' => (int) $row->id, 'user_id' => $auth['user_id']),
            array('%s', '%s', '%s', '%s', '%d', '%s', '%s', '%d', '%s', '%s'),
            array('%d', '%d')
        );

        $wpdb->insert(
            EPDD_DB::table('project_history'),
            array(
                'project_id'       => (int) $row->id,
                'user_id'          => $auth['user_id'],
                'version'          => $new_ver,
                'payload_encoding' => $encoded['encoding'],
                'payload_data'     => $encoded['data'],
                'payload_size'     => $encoded['size'],
                'change_note'      => substr($change_note, 0, 255),
                'created_at'       => $now,
            ),
            array('%d', '%d', '%d', '%s', '%s', '%d', '%s', '%s')
        );

        EPDD_DB::log_audit($auth['user_id'], 'project_sync', 'ok', 'Proje güncellendi v' . $new_ver . ': ' . $row->project_uuid);

        return rest_ensure_response(array(
            'id'           => (int) $row->id,
            'project_uuid' => $row->project_uuid,
            'version'      => $new_ver,
            'updated_at'   => $now,
            'payload_size' => $encoded['size'],
        ));
    }

    public static function handle_project_history(WP_REST_Request $request) {
        global $wpdb;
        $auth = self::get_auth($request);
        $row = self::find_user_project($auth['user_id'], $request->get_param('id'));
        if (!$row) {
            return new WP_Error('epdd_not_found', 'Proje bulunamadı.', array('status' => 404));
        }
        $table = EPDD_DB::table('project_history');
        $items = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT id, version, payload_size, change_note, created_at FROM {$table} WHERE project_id = %d AND user_id = %d ORDER BY version DESC LIMIT 30",
                (int) $row->id,
                $auth['user_id']
            ),
            ARRAY_A
        );
        return rest_ensure_response(array(
            'project_uuid' => $row->project_uuid,
            'history'      => $items ?: array(),
        ));
    }
}
