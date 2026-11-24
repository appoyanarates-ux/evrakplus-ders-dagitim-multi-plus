<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * EvrakPlus cihaz eşleştirme, JWT erişim belirteci, yenileme belirteci ve çevrimdışı çıktı yetkisi.
 */
class EPDD_Auth {

    public static function init() {
        add_action('init', array(__CLASS__, 'register_rewrite_rules'));
        add_filter('query_vars', array(__CLASS__, 'register_query_vars'));
        add_action('template_redirect', array(__CLASS__, 'handle_device_approval_page'));
        add_shortcode('evrakplus_dd_device_pair', array(__CLASS__, 'render_shortcode'));
    }

    public static function register_rewrite_rules() {
        add_rewrite_rule('^evrakplus-ders-dagitim-giris/?$', 'index.php?epdd_device_pair=1', 'top');
    }

    public static function register_query_vars($vars) {
        $vars[] = 'epdd_device_pair';
        return $vars;
    }

    public static function ensure_signing_secret() {
        $secret = get_option('epdd_signing_secret');
        if (!is_string($secret) || strlen($secret) < 32) {
            try {
                $secret = bin2hex(random_bytes(32));
            } catch (Exception $e) {
                $secret = hash('sha256', wp_generate_password(64, true, true) . microtime(true));
            }
            update_option('epdd_signing_secret', $secret, false);
        }
        return $secret;
    }

    private static function get_signing_key() {
        return hash_hmac('sha256', self::ensure_signing_secret(), wp_salt('auth'));
    }

    public static function base64url_encode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    public static function base64url_decode($data) {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }
        return base64_decode(strtr($data, '-_', '+/'));
    }

    public static function hash_token($raw_token) {
        return hash('sha256', (string) $raw_token);
    }

    public static function check_rate_limit($bucket, $max_requests = 30, $window_sec = 60) {
        $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : 'unknown';
        $key = 'epdd_rl_' . md5($bucket . '|' . $ip);
        $count = (int) get_transient($key);
        if ($count >= $max_requests) {
            return false;
        }
        set_transient($key, $count + 1, $window_sec);
        return true;
    }

    public static function generate_user_code() {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $len = strlen($alphabet);
        $part1 = '';
        $part2 = '';
        for ($i = 0; $i < 4; $i++) {
            $part1 .= $alphabet[random_int(0, $len - 1)];
            $part2 .= $alphabet[random_int(0, $len - 1)];
        }
        return 'EP-' . $part1 . '-' . $part2;
    }

    /**
     * Yeni tek kullanımlık cihaz eşleştirme kodu oluşturur.
     */
    public static function create_device_code($device_name = 'Windows Masaüstü', $app_version = '') {
        global $wpdb;
        $settings = EPDD_DB::get_settings();
        $ttl = max(120, min(1800, (int) $settings['device_code_ttl_sec']));

        $device_code = bin2hex(random_bytes(32));
        $device_code_hash = self::hash_token($device_code);
        $user_code = self::generate_user_code();

        $now = time();
        $created_at = gmdate('Y-m-d H:i:s', $now);
        $expires_at = gmdate('Y-m-d H:i:s', $now + $ttl);
        $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : '';

        $wpdb->insert(
            EPDD_DB::table('device_codes'),
            array(
                'device_code_hash' => $device_code_hash,
                'user_code'        => $user_code,
                'device_name'      => substr(sanitize_text_field($device_name), 0, 120),
                'app_version'      => substr(sanitize_text_field($app_version), 0, 32),
                'status'           => 'pending',
                'ip_address'       => substr($ip, 0, 64),
                'created_at'       => $created_at,
                'expires_at'       => $expires_at,
            ),
            array('%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s')
        );

        $verification_url = add_query_arg(
            array('code' => $user_code),
            home_url('/evrakplus-ders-dagitim-giris/')
        );

        return array(
            'device_code'      => $device_code,
            'user_code'        => $user_code,
            'verification_url' => $verification_url,
            'expires_in'       => $ttl,
            'interval'         => 3,
        );
    }

    /**
     * Kısa ömürlü erişim JWT belirteci üretir.
     */
    public static function issue_access_token($user_id, $device_id) {
        $settings = EPDD_DB::get_settings();
        $ttl = max(300, min(3600, (int) $settings['access_token_ttl_sec']));
        $now = time();

        $header = self::base64url_encode(wp_json_encode(array('alg' => 'HS256', 'typ' => 'JWT')));
        $payload = self::base64url_encode(wp_json_encode(array(
            'iss' => home_url('/'),
            'sub' => (int) $user_id,
            'dev' => (string) $device_id,
            'iat' => $now,
            'exp' => $now + $ttl,
            'jti' => bin2hex(random_bytes(12)),
        )));
        $sig = self::base64url_encode(hash_hmac('sha256', $header . '.' . $payload, self::get_signing_key(), true));
        return array(
            'token'      => $header . '.' . $payload . '.' . $sig,
            'expires_in' => $ttl,
            'expires_at' => gmdate('c', $now + $ttl),
        );
    }

    /**
     * JWT erişim belirtecini doğrular.
     */
    public static function verify_access_token($jwt) {
        if (!is_string($jwt) || substr_count($jwt, '.') !== 2) {
            return new WP_Error('epdd_invalid_token', 'Geçersiz erişim belirteci.', array('status' => 401));
        }
        list($header_b64, $payload_b64, $sig_b64) = explode('.', $jwt);
        $expected = self::base64url_encode(hash_hmac('sha256', $header_b64 . '.' . $payload_b64, self::get_signing_key(), true));
        if (!hash_equals($expected, $sig_b64)) {
            return new WP_Error('epdd_invalid_signature', 'Erişim belirteci imzası doğrulanamadı.', array('status' => 401));
        }
        $payload = json_decode(self::base64url_decode($payload_b64), true);
        if (!is_array($payload) || empty($payload['sub']) || empty($payload['exp'])) {
            return new WP_Error('epdd_malformed_token', 'Erişim belirteci bozuk.', array('status' => 401));
        }
        if ((int) $payload['exp'] < time()) {
            return new WP_Error('epdd_token_expired', 'Erişim belirtecinin süresi doldu.', array('status' => 401));
        }

        // Cihaz oturumu sunucuda iptal edilmiş mi kontrol et
        global $wpdb;
        $device_id = isset($payload['dev']) ? sanitize_text_field($payload['dev']) : '';
        $active_session = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT id FROM " . EPDD_DB::table('tokens') . " WHERE user_id = %d AND device_id = %s AND revoked_at IS NULL AND expires_at > %s LIMIT 1",
                (int) $payload['sub'],
                $device_id,
                gmdate('Y-m-d H:i:s')
            )
        );
        if (!$active_session) {
            return new WP_Error('epdd_session_revoked', 'Bu cihazın oturumu sonlandırılmış.', array('status' => 401));
        }

        $user = get_userdata((int) $payload['sub']);
        if (!$user) {
            return new WP_Error('epdd_user_not_found', 'WordPress kullanıcısı bulunamadı.', array('status' => 401));
        }

        return array(
            'user_id'   => (int) $user->ID,
            'device_id' => $device_id,
            'user'      => $user,
        );
    }

    /**
     * Sunucu imzalı çevrimdışı çıktı yetkisi (varsayılan 7 gün) üretir.
     */
    public static function build_entitlement($user_id, $device_id = '') {
        $user = get_userdata((int) $user_id);
        if (!$user) {
            return null;
        }
        $settings = EPDD_DB::get_settings();
        $days = max(1, min(30, (int) $settings['offline_entitlement_days']));
        $now = time();
        $exp = $now + ($days * DAY_IN_SECONDS);

        $claims = array(
            'iss'              => home_url('/'),
            'sub'              => (int) $user->ID,
            'email'            => $user->user_email,
            'device_id'        => (string) $device_id,
            'membership_tier'  => 'free_member',
            'membership_label' => 'Ücretsiz EvrakPlus Üyesi',
            'can_export_pdf'   => true,
            'can_export_excel' => true,
            'can_print'        => true,
            'can_cloud_sync'   => true,
            'issued_at'        => gmdate('c', $now),
            'expires_at'       => gmdate('c', $exp),
            'offline_days'     => $days,
        );

        $payload_b64 = self::base64url_encode(wp_json_encode($claims));
        $sig = self::base64url_encode(hash_hmac('sha256', 'entitlement.' . $payload_b64, self::get_signing_key(), true));

        return array(
            'entitlement' => $claims,
            'signed_token' => $payload_b64 . '.' . $sig,
        );
    }

    /**
     * Kullanıcı özet profilini döndürür (şifre veya hassas meta içermez).
     */
    public static function format_user_profile($user) {
        if (!$user instanceof WP_User) {
            $user = get_userdata((int) $user);
        }
        if (!$user) {
            return null;
        }
        $first = get_user_meta($user->ID, 'first_name', true);
        $last  = get_user_meta($user->ID, 'last_name', true);
        $full_name = trim($first . ' ' . $last);
        if ($full_name === '') {
            $full_name = $user->display_name ?: $user->user_login;
        }
        return array(
            'id'               => (int) $user->ID,
            'first_name'       => (string) $first,
            'last_name'        => (string) $last,
            'full_name'        => $full_name,
            'email'            => $user->user_email,
            'membership_tier'  => 'free_member',
            'membership_label' => 'Ücretsiz EvrakPlus Üyesi',
            'account_url'      => home_url('/hesabim/'),
        );
    }

    /**
     * Yeni yenileme belirteci oluşturur (yalnızca SHA-256 hash saklanır).
     */
    public static function create_session_tokens($user_id, $device_name = 'Windows Masaüstü', $app_version = '') {
        global $wpdb;
        $settings = EPDD_DB::get_settings();
        $days = max(1, min(90, (int) $settings['refresh_token_ttl_days']));

        $device_id = 'dev_' . bin2hex(random_bytes(16));
        $refresh_token = 'eprt_' . bin2hex(random_bytes(32));
        $refresh_hash = self::hash_token($refresh_token);

        $now = time();
        $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : '';

        $wpdb->insert(
            EPDD_DB::table('tokens'),
            array(
                'user_id'            => (int) $user_id,
                'device_id'          => $device_id,
                'device_name'        => substr(sanitize_text_field($device_name), 0, 120),
                'app_version'        => substr(sanitize_text_field($app_version), 0, 32),
                'refresh_token_hash' => $refresh_hash,
                'last_ip'            => substr($ip, 0, 64),
                'created_at'         => gmdate('Y-m-d H:i:s', $now),
                'last_used_at'       => gmdate('Y-m-d H:i:s', $now),
                'expires_at'         => gmdate('Y-m-d H:i:s', $now + ($days * DAY_IN_SECONDS)),
            ),
            array('%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s')
        );

        $access = self::issue_access_token($user_id, $device_id);
        $entitlement = self::build_entitlement($user_id, $device_id);

        return array(
            'device_id'    => $device_id,
            'access_token' => $access['token'],
            'expires_in'   => $access['expires_in'],
            'expires_at'   => $access['expires_at'],
            'refresh_token'=> $refresh_token,
            'user'         => self::format_user_profile($user_id),
            'entitlement'  => $entitlement,
        );
    }

    /**
     * Yenileme belirtecini döndürür (rotation) ve yeni erişim belirteci verir.
     */
    public static function rotate_refresh_token($raw_refresh_token) {
        global $wpdb;
        $hash = self::hash_token($raw_refresh_token);
        $table = EPDD_DB::table('tokens');

        $row = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$table} WHERE refresh_token_hash = %s AND revoked_at IS NULL AND expires_at > %s LIMIT 1",
                $hash,
                gmdate('Y-m-d H:i:s')
            )
        );
        if (!$row) {
            return new WP_Error('epdd_invalid_refresh', 'Oturum yenileme belirteci geçersiz veya iptal edilmiş.', array('status' => 401));
        }

        $settings = EPDD_DB::get_settings();
        $days = max(1, min(90, (int) $settings['refresh_token_ttl_days']));
        $new_refresh = 'eprt_' . bin2hex(random_bytes(32));
        $new_hash = self::hash_token($new_refresh);
        $now = time();
        $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : '';

        $wpdb->update(
            $table,
            array(
                'refresh_token_hash' => $new_hash,
                'last_used_at'       => gmdate('Y-m-d H:i:s', $now),
                'last_ip'            => substr($ip, 0, 64),
                'expires_at'         => gmdate('Y-m-d H:i:s', $now + ($days * DAY_IN_SECONDS)),
            ),
            array('id' => (int) $row->id),
            array('%s', '%s', '%s', '%s'),
            array('%d')
        );

        $access = self::issue_access_token((int) $row->user_id, $row->device_id);
        $entitlement = self::build_entitlement((int) $row->user_id, $row->device_id);

        return array(
            'device_id'     => $row->device_id,
            'access_token'  => $access['token'],
            'expires_in'    => $access['expires_in'],
            'expires_at'    => $access['expires_at'],
            'refresh_token' => $new_refresh,
            'user'          => self::format_user_profile((int) $row->user_id),
            'entitlement'   => $entitlement,
        );
    }

    public static function revoke_device_session($user_id, $device_id) {
        global $wpdb;
        $wpdb->update(
            EPDD_DB::table('tokens'),
            array('revoked_at' => gmdate('Y-m-d H:i:s')),
            array('user_id' => (int) $user_id, 'device_id' => sanitize_text_field($device_id)),
            array('%s'),
            array('%d', '%s')
        );
        EPDD_DB::log_audit($user_id, 'device_logout', 'ok', 'Cihaz oturumu kapatıldı: ' . $device_id);
    }

    public static function revoke_all_user_tokens($user_id) {
        global $wpdb;
        $wpdb->update(
            EPDD_DB::table('tokens'),
            array('revoked_at' => gmdate('Y-m-d H:i:s')),
            array('user_id' => (int) $user_id),
            array('%s'),
            array('%d')
        );
        EPDD_DB::log_audit($user_id, 'user_sessions_revoked', 'ok', 'Kullanıcının tüm cihaz oturumları iptal edildi.');
    }

    /**
     * Tarayıcı cihaz eşleştirme onay sayfası (/evrakplus-ders-dagitim-giris/).
     */
    public static function handle_device_approval_page() {
        if ((int) get_query_var('epdd_device_pair') !== 1) {
            return;
        }
        status_header(200);
        nocache_headers();
        echo '<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
        echo '<title>EvrakPlus – Ders Dağıtım Cihaz Eşleştirme</title>';
        echo '<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:32px 16px;}';
        echo '.card{max-width:460px;margin:24px auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;box-shadow:0 10px 25px rgba(15,23,42,.06);}';
        echo '.btn{display:inline-block;padding:10px 18px;border-radius:10px;border:none;font-weight:600;cursor:pointer;text-decoration:none;font-size:14px;}';
        echo '.btn-primary{background:#4f46e5;color:#fff;} .btn-secondary{background:#e2e8f0;color:#1e293b;}';
        echo '.code{font-size:24px;letter-spacing:3px;font-weight:800;color:#312e81;background:#eef2ff;padding:12px;border-radius:10px;text-align:center;margin:14px 0;}';
        echo '.alert{padding:12px 14px;border-radius:10px;margin-bottom:14px;font-size:14px;}';
        echo '.alert-ok{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;} .alert-err{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;}';
        echo '</style></head><body><div class="card">';
        echo self::render_shortcode();
        echo '</div></body></html>';
        exit;
    }

    public static function render_shortcode() {
        $code = isset($_REQUEST['code']) ? strtoupper(sanitize_text_field(wp_unslash($_REQUEST['code']))) : '';
        if (!is_user_logged_in()) {
            $redirect_to = add_query_arg(array('code' => $code), home_url('/evrakplus-ders-dagitim-giris/'));
            $login_url = wp_login_url($redirect_to);
            $reg_url = wp_registration_url();
            ob_start();
            ?>
            <h2 style="margin-top:0;">EvrakPlus Masaüstü Girişi</h2>
            <p style="font-size:14px;color:#475569;">Okul Ders Dağıtım Programı ile eşleştirme yapmak için mevcut EvrakPlus hesabınızla oturum açın.</p>
            <?php if ($code !== ''): ?>
                <div class="code"><?php echo esc_html($code); ?></div>
            <?php endif; ?>
            <p style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px;">
                <a class="btn btn-primary" href="<?php echo esc_url($login_url); ?>">EvrakPlus ile Giriş Yap</a>
                <a class="btn btn-secondary" href="<?php echo esc_url($reg_url); ?>">Ücretsiz Üye Ol</a>
            </p>
            <?php
            return ob_get_clean();
        }

        $user = wp_get_current_user();
        $message = '';
        $is_error = false;

        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['epdd_action'])) {
            check_admin_referer('epdd_approve_device');
            $posted_code = isset($_POST['user_code']) ? strtoupper(sanitize_text_field(wp_unslash($_POST['user_code']))) : '';
            $action = sanitize_key($_POST['epdd_action']);

            global $wpdb;
            $table = EPDD_DB::table('device_codes');
            $row = $wpdb->get_row(
                $wpdb->prepare(
                    "SELECT * FROM {$table} WHERE user_code = %s AND status = 'pending' AND expires_at > %s LIMIT 1",
                    $posted_code,
                    gmdate('Y-m-d H:i:s')
                )
            );

            if (!$row) {
                $is_error = true;
                $message = 'Eşleştirme kodu geçersiz veya süresi dolmuş. Masaüstü uygulamasından yeni kod oluşturun.';
            } elseif ($action === 'approve') {
                $wpdb->update(
                    $table,
                    array(
                        'status'      => 'approved',
                        'user_id'     => (int) $user->ID,
                        'approved_at' => gmdate('Y-m-d H:i:s'),
                    ),
                    array('id' => (int) $row->id),
                    array('%s', '%d', '%s'),
                    array('%d')
                );
                EPDD_DB::log_audit($user->ID, 'device_approved', 'ok', 'Cihaz onaylandı: ' . $row->device_name);
                $message = 'Cihaz eşleştirme onaylandı! Şimdi Okul Ders Dağıtım Programı penceresine dönebilirsiniz.';
            } elseif ($action === 'deny') {
                $wpdb->update(
                    $table,
                    array('status' => 'denied'),
                    array('id' => (int) $row->id),
                    array('%s'),
                    array('%d')
                );
                EPDD_DB::log_audit($user->ID, 'device_denied', 'ok', 'Cihaz eşleştirme reddedildi.');
                $message = 'Eşleştirme isteği reddedildi.';
            }
        }

        ob_start();
        ?>
        <h2 style="margin-top:0;">EvrakPlus Cihaz Eşleştirme</h2>
        <p style="font-size:13px;color:#475569;">Oturum açık hesap: <strong><?php echo esc_html($user->display_name . ' (' . $user->user_email . ')'); ?></strong></p>
        <?php if ($message !== ''): ?>
            <div class="alert <?php echo $is_error ? 'alert-err' : 'alert-ok'; ?>"><?php echo esc_html($message); ?></div>
        <?php endif; ?>
        <form method="post">
            <?php wp_nonce_field('epdd_approve_device'); ?>
            <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">Eşleştirme Kodu</label>
            <input type="text" name="user_code" value="<?php echo esc_attr($code); ?>" required
                   placeholder="EP-XXXX-XXXX"
                   style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:18px;letter-spacing:2px;font-weight:700;text-align:center;margin-bottom:16px;" />
            <div style="display:flex;gap:10px;">
                <button type="submit" name="epdd_action" value="approve" class="btn btn-primary" style="flex:1;">Bu Cihazı Onayla</button>
                <button type="submit" name="epdd_action" value="deny" class="btn btn-secondary">Reddet</button>
            </div>
        </form>
        <?php
        return ob_get_clean();
    }
}
