<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WordPress Yönetim Paneli — "Ders Dağıtım Yönetimi"
 * 7 alt bölüm: Genel Durum, Üyelik ve Yetkiler, Bulut Projeleri, Cihaz Oturumları,
 * Senkronizasyon Durumu, Sistem Günlükleri, Ayarlar.
 */
class EPDD_Admin {

    public static function init() {
        add_action('admin_menu', array(__CLASS__, 'register_menu'));
        add_action('admin_post_epdd_save_settings', array(__CLASS__, 'handle_save_settings'));
        add_action('admin_post_epdd_revoke_session', array(__CLASS__, 'handle_revoke_session'));
    }

    public static function register_menu() {
        add_menu_page(
            'Ders Dağıtım Yönetimi',
            'Ders Dağıtım Yönetimi',
            'manage_options',
            'epdd-dashboard',
            array(__CLASS__, 'render_page'),
            'dashicons-calendar-alt',
            58
        );
    }

    public static function handle_save_settings() {
        if (!current_user_can('manage_options')) {
            wp_die('Yetkisiz erişim.');
        }
        check_admin_referer('epdd_save_settings');

        $current = EPDD_DB::get_settings();
        $updated = array(
            'offline_entitlement_days' => max(1, min(30, (int) ($_POST['offline_entitlement_days'] ?? 7))),
            'max_project_size_mb'      => max(1, min(50, (int) ($_POST['max_project_size_mb'] ?? 10))),
            'max_projects_per_user'    => max(1, min(200, (int) ($_POST['max_projects_per_user'] ?? 25))),
            'access_token_ttl_sec'     => max(300, min(3600, (int) ($_POST['access_token_ttl_sec'] ?? 900))),
            'refresh_token_ttl_days'   => max(1, min(90, (int) ($_POST['refresh_token_ttl_days'] ?? 30))),
            'device_code_ttl_sec'      => max(120, min(1800, (int) ($_POST['device_code_ttl_sec'] ?? 600))),
            'remote_ortools_url'       => esc_url_raw(trim((string) ($_POST['remote_ortools_url'] ?? ''))),
            'require_email_verified'   => !empty($_POST['require_email_verified']) ? 1 : 0,
            'allow_pwa_origins'        => sanitize_text_field((string) ($_POST['allow_pwa_origins'] ?? $current['allow_pwa_origins'])),
        );
        update_option('epdd_settings', $updated);
        EPDD_DB::log_audit(get_current_user_id(), 'admin_settings_saved', 'ok', 'Eklenti ayarları güncellendi.');

        wp_safe_redirect(admin_url('admin.php?page=epdd-dashboard&tab=ayarlar&saved=1'));
        exit;
    }

    public static function handle_revoke_session() {
        if (!current_user_can('manage_options')) {
            wp_die('Yetkisiz erişim.');
        }
        check_admin_referer('epdd_revoke_session');

        $token_id = absint($_POST['token_id'] ?? 0);
        if ($token_id > 0) {
            global $wpdb;
            $wpdb->update(
                EPDD_DB::table('tokens'),
                array('revoked_at' => gmdate('Y-m-d H:i:s')),
                array('id' => $token_id),
                array('%s'),
                array('%d')
            );
            EPDD_DB::log_audit(get_current_user_id(), 'admin_revoke_session', 'ok', 'Yönetici oturum iptal etti #' . $token_id);
        }

        wp_safe_redirect(admin_url('admin.php?page=epdd-dashboard&tab=cihazlar&revoked=1'));
        exit;
    }

    public static function render_page() {
        if (!current_user_can('manage_options')) {
            wp_die('Bu sayfaya erişim yetkiniz yok.');
        }

        $tabs = array(
            'genel'          => 'Genel Durum',
            'uyelik'         => 'Üyelik ve Yetkiler',
            'projeler'       => 'Bulut Projeleri',
            'cihazlar'       => 'Cihaz Oturumları',
            'senkronizasyon' => 'Senkronizasyon Durumu',
            'gunlukler'      => 'Sistem Günlükleri',
            'ayarlar'        => 'Ayarlar',
        );
        $active = isset($_GET['tab']) && isset($tabs[$_GET['tab']]) ? sanitize_key($_GET['tab']) : 'genel';

        echo '<div class="wrap">';
        echo '<h1>EvrakPlus — Ders Dağıtım Yönetimi <span style="font-size:12px;color:#64748b;font-weight:400;">v' . esc_html(EPDD_VERSION) . '</span></h1>';
        echo '<h2 class="nav-tab-wrapper">';
        foreach ($tabs as $key => $label) {
            $cls = ($active === $key) ? 'nav-tab nav-tab-active' : 'nav-tab';
            $url = admin_url('admin.php?page=epdd-dashboard&tab=' . $key);
            echo '<a href="' . esc_url($url) . '" class="' . esc_attr($cls) . '">' . esc_html($label) . '</a>';
        }
        echo '</h2><div style="margin-top:16px;">';

        switch ($active) {
            case 'uyelik':
                self::render_tab_uyelik();
                break;
            case 'projeler':
                self::render_tab_projeler();
                break;
            case 'cihazlar':
                self::render_tab_cihazlar();
                break;
            case 'senkronizasyon':
                self::render_tab_senkronizasyon();
                break;
            case 'gunlukler':
                self::render_tab_gunlukler();
                break;
            case 'ayarlar':
                self::render_tab_ayarlar();
                break;
            default:
                self::render_tab_genel();
                break;
        }

        echo '</div></div>';
    }

    private static function render_tab_genel() {
        global $wpdb;
        $active_sessions = (int) $wpdb->get_var(
            $wpdb->prepare("SELECT COUNT(*) FROM " . EPDD_DB::table('tokens') . " WHERE revoked_at IS NULL AND expires_at > %s", gmdate('Y-m-d H:i:s'))
        );
        $total_projects = (int) $wpdb->get_var("SELECT COUNT(*) FROM " . EPDD_DB::table('projects') . " WHERE deleted_at IS NULL");
        $total_bytes    = (int) $wpdb->get_var("SELECT COALESCE(SUM(payload_size), 0) FROM " . EPDD_DB::table('projects') . " WHERE deleted_at IS NULL");
        $total_users    = (int) $wpdb->get_var("SELECT COUNT(DISTINCT user_id) FROM " . EPDD_DB::table('tokens'));

        echo '<div style="display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:12px;max-width:960px;">';
        self::kpi_card('Aktif Cihaz Oturumu', $active_sessions);
        self::kpi_card('Bağlı Üye Sayısı', $total_users);
        self::kpi_card('Bulut Proje Sayısı', $total_projects);
        self::kpi_card('Toplam Depolama', size_format($total_bytes, 2));
        echo '</div>';

        echo '<div class="card" style="max-width:960px;margin-top:16px;padding:16px;">';
        echo '<h3>REST API Uç Noktaları</h3>';
        echo '<p>Taban adres: <code>' . esc_html(rest_url(EPDD_REST_NAMESPACE . '/')) . '</code></p>';
        echo '<p>Cihaz Eşleştirme Sayfası: <a href="' . esc_url(home_url('/evrakplus-ders-dagitim-giris/')) . '" target="_blank">' . esc_html(home_url('/evrakplus-ders-dagitim-giris/')) . '</a></p>';
        echo '</div>';
    }

    private static function kpi_card($title, $value) {
        echo '<div style="background:#fff;border:1px solid #dcdcde;border-radius:8px;padding:16px;">';
        echo '<div style="font-size:12px;color:#646970;">' . esc_html($title) . '</div>';
        echo '<div style="font-size:24px;font-weight:700;margin-top:6px;">' . esc_html((string) $value) . '</div>';
        echo '</div>';
    }

    private static function render_tab_uyelik() {
        $settings = EPDD_DB::get_settings();
        echo '<div class="card" style="max-width:860px;padding:16px;">';
        echo '<h3>Üyelik ve Çıktı Yetkisi Politikası</h3>';
        echo '<ul style="list-style:disc;padding-left:20px;">';
        echo '<li>Mevcut WordPress kullanıcı hesapları (<code>wp_users</code>) doğrudan kullanılır; ikinci kullanıcı veritabanı oluşturulmaz.</li>';
        echo '<li>Ücretsiz EvrakPlus üyeleri PDF, Excel, Toplu Çıktı ve Yazdırma yetkilerine sahiptir.</li>';
        echo '<li>Çevrimdışı çıktı yetkisi sunucu imzalı olarak <strong>' . (int) $settings['offline_entitlement_days'] . ' gün</strong> geçerlidir.</li>';
        echo '<li>WordPress şifreleri masaüstü uygulamasına veya eklenti tablolarına kesinlikle kaydedilmez.</li>';
        echo '</ul></div>';
    }

    private static function render_tab_projeler() {
        global $wpdb;
        $t_proj = EPDD_DB::table('projects');
        $rows = $wpdb->get_results(
            "SELECT p.id, p.project_uuid, p.user_id, p.title, p.academic_year, p.version, p.payload_size, p.updated_at, u.user_email
             FROM {$t_proj} p
             LEFT JOIN {$wpdb->users} u ON u.ID = p.user_id
             WHERE p.deleted_at IS NULL
             ORDER BY p.updated_at DESC
             LIMIT 100"
        );

        echo '<p class="description">KVKK ve gizlilik gereği bu listede yalnızca proje başlığı, kullanıcı, güncelleme tarihi ve depolama boyutu gösterilir. Öğretmen adları ve ders programı içerikleri yönetici ekranında görüntülenmez.</p>';
        echo '<table class="widefat striped"><thead><tr>';
        echo '<th>Proje Başlığı</th><th>Dönem</th><th>Kullanıcı</th><th>Sürüm</th><th>Boyut</th><th>Son Güncelleme (UTC)</th>';
        echo '</tr></thead><tbody>';
        if (empty($rows)) {
            echo '<tr><td colspan="6">Henüz bulut projesi bulunmuyor.</td></tr>';
        } else {
            foreach ($rows as $r) {
                echo '<tr>';
                echo '<td><strong>' . esc_html($r->title) . '</strong><br><code>' . esc_html($r->project_uuid) . '</code></td>';
                echo '<td>' . esc_html($r->academic_year ?: '—') . '</td>';
                echo '<td>' . esc_html($r->user_email ?: ('#' . $r->user_id)) . '</td>';
                echo '<td>v' . (int) $r->version . '</td>';
                echo '<td>' . esc_html(size_format((int) $r->payload_size, 1)) . '</td>';
                echo '<td>' . esc_html($r->updated_at) . '</td>';
                echo '</tr>';
            }
        }
        echo '</tbody></table>';
    }

    private static function render_tab_cihazlar() {
        global $wpdb;
        if (!empty($_GET['revoked'])) {
            echo '<div class="notice notice-success"><p>Cihaz oturumu başarıyla sonlandırıldı.</p></div>';
        }
        $t_tok = EPDD_DB::table('tokens');
        $rows = $wpdb->get_results(
            "SELECT t.id, t.user_id, t.device_id, t.device_name, t.app_version, t.last_ip, t.last_used_at, t.expires_at, t.revoked_at, u.user_email
             FROM {$t_tok} t
             LEFT JOIN {$wpdb->users} u ON u.ID = t.user_id
             ORDER BY t.last_used_at DESC
             LIMIT 100"
        );
        echo '<table class="widefat striped"><thead><tr>';
        echo '<th>Kullanıcı</th><th>Cihaz</th><th>Sürüm</th><th>Son Kullanım</th><th>Durum</th><th>İşlem</th>';
        echo '</tr></thead><tbody>';
        if (empty($rows)) {
            echo '<tr><td colspan="6">Kayıtlı cihaz oturumu yok.</td></tr>';
        } else {
            foreach ($rows as $r) {
                $is_revoked = !empty($r->revoked_at);
                echo '<tr>';
                echo '<td>' . esc_html($r->user_email ?: ('#' . $r->user_id)) . '</td>';
                echo '<td>' . esc_html($r->device_name) . '<br><code>' . esc_html($r->device_id) . '</code></td>';
                echo '<td>' . esc_html($r->app_version ?: '—') . '</td>';
                echo '<td>' . esc_html($r->last_used_at) . '</td>';
                echo '<td>' . ($is_revoked ? '<span style="color:#b91c1c;">İptal Edildi</span>' : '<span style="color:#047857;font-weight:600;">Aktif</span>') . '</td>';
                echo '<td>';
                if (!$is_revoked) {
                    echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '" style="display:inline;">';
                    wp_nonce_field('epdd_revoke_session');
                    echo '<input type="hidden" name="action" value="epdd_revoke_session" />';
                    echo '<input type="hidden" name="token_id" value="' . (int) $r->id . '" />';
                    echo '<button type="submit" class="button button-small">Oturumu Kapat</button></form>';
                } else {
                    echo '—';
                }
                echo '</td></tr>';
            }
        }
        echo '</tbody></table>';
    }

    private static function render_tab_senkronizasyon() {
        global $wpdb;
        $t_audit = EPDD_DB::table('audit_logs');
        $rows = $wpdb->get_results(
            "SELECT * FROM {$t_audit} WHERE action LIKE 'project_%' ORDER BY created_at DESC LIMIT 50"
        );
        echo '<table class="widefat striped"><thead><tr><th>Tarih (UTC)</th><th>Kullanıcı ID</th><th>İşlem</th><th>Durum</th><th>Detay</th></tr></thead><tbody>';
        if (empty($rows)) {
            echo '<tr><td colspan="5">Henüz senkronizasyon kaydı yok.</td></tr>';
        } else {
            foreach ($rows as $r) {
                echo '<tr><td>' . esc_html($r->created_at) . '</td><td>' . esc_html((string) ($r->user_id ?: '—')) . '</td>';
                echo '<td><code>' . esc_html($r->action) . '</code></td><td>' . esc_html($r->status) . '</td><td>' . esc_html($r->detail) . '</td></tr>';
            }
        }
        echo '</tbody></table>';
    }

    private static function render_tab_gunlukler() {
        global $wpdb;
        $t_audit = EPDD_DB::table('audit_logs');
        $rows = $wpdb->get_results("SELECT * FROM {$t_audit} ORDER BY created_at DESC LIMIT 100");
        echo '<table class="widefat striped"><thead><tr><th>Tarih (UTC)</th><th>Kullanıcı ID</th><th>İşlem</th><th>Durum</th><th>Detay</th><th>IP</th></tr></thead><tbody>';
        if (empty($rows)) {
            echo '<tr><td colspan="6">Günlük kaydı yok.</td></tr>';
        } else {
            foreach ($rows as $r) {
                echo '<tr><td>' . esc_html($r->created_at) . '</td><td>' . esc_html((string) ($r->user_id ?: '—')) . '</td>';
                echo '<td><code>' . esc_html($r->action) . '</code></td><td>' . esc_html($r->status) . '</td>';
                echo '<td>' . esc_html($r->detail) . '</td><td>' . esc_html($r->ip_address) . '</td></tr>';
            }
        }
        echo '</tbody></table>';
    }

    private static function render_tab_ayarlar() {
        $s = EPDD_DB::get_settings();
        if (!empty($_GET['saved'])) {
            echo '<div class="notice notice-success"><p>Ayarlar kaydedildi.</p></div>';
        }
        echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '" style="max-width:720px;">';
        wp_nonce_field('epdd_save_settings');
        echo '<input type="hidden" name="action" value="epdd_save_settings" />';
        echo '<table class="form-table">';
        echo '<tr><th>Çevrimdışı Çıktı Yetkisi (Gün)</th><td><input type="number" name="offline_entitlement_days" min="1" max="30" value="' . (int) $s['offline_entitlement_days'] . '" /> <p class="description">Varsayılan: 7 gün.</p></td></tr>';
        echo '<tr><th>Maksimum Proje Boyutu (MB)</th><td><input type="number" name="max_project_size_mb" min="1" max="50" value="' . (int) $s['max_project_size_mb'] . '" /></td></tr>';
        echo '<tr><th>Kullanıcı Başına Maks. Proje</th><td><input type="number" name="max_projects_per_user" min="1" max="200" value="' . (int) $s['max_projects_per_user'] . '" /></td></tr>';
        echo '<tr><th>Erişim Belirteci Süresi (Sn)</th><td><input type="number" name="access_token_ttl_sec" min="300" max="3600" value="' . (int) $s['access_token_ttl_sec'] . '" /></td></tr>';
        echo '<tr><th>Yenileme Belirteci Süresi (Gün)</th><td><input type="number" name="refresh_token_ttl_days" min="1" max="90" value="' . (int) $s['refresh_token_ttl_days'] . '" /></td></tr>';
        echo '<tr><th>Cihaz Kodu Geçerlilik (Sn)</th><td><input type="number" name="device_code_ttl_sec" min="120" max="1800" value="' . (int) $s['device_code_ttl_sec'] . '" /></td></tr>';
        echo '<tr><th>Uzak OR-Tools Servis URL (Web/PWA)</th><td><input type="url" class="regular-text" name="remote_ortools_url" value="' . esc_attr($s['remote_ortools_url']) . '" placeholder="https://ortools.evrakplus.com/solve" /><p class="description">İsteğe bağlı. Boş bırakılırsa web sürümünde otomatik dağıtım kapalı kalır (JS çözücü kullanılmaz).</p></td></tr>';
        echo '<tr><th>İzin Verilen Web/PWA Kökenleri</th><td><input type="text" class="large-text" name="allow_pwa_origins" value="' . esc_attr($s['allow_pwa_origins']) . '" /></td></tr>';
        echo '</table>';
        submit_button('Ayarları Kaydet');
        echo '</form>';
    }
}
