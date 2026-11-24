<?php
/**
 * Plugin Name: EvrakPlus Multi Plus Connect
 * Plugin URI:  https://www.evrakplus.com/
 * Description: EvrakPlus Ders Dagitim Multi Plus uyelik dogrulama, cihaz eslestirme, cikti yetkisi ve 3-platform bulut senkronizasyon kopru eklentisi.
 * Version: 1.0.0
 * Author:      EvrakPlus
 * Author URI:  https://www.evrakplus.com/
 * Text Domain: evrakplus-dd
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * License:     GPLv2 or later
 */

if (!defined('ABSPATH')) {
    exit;
}

define('EPDD_VERSION', '1.0.0');
define('EPDD_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('EPDD_PLUGIN_URL', plugin_dir_url(__FILE__));
define('EPDD_REST_NAMESPACE', 'evrakplus-dd/v1');

require_once EPDD_PLUGIN_DIR . 'includes/class-db.php';
require_once EPDD_PLUGIN_DIR . 'includes/class-auth.php';
require_once EPDD_PLUGIN_DIR . 'includes/class-rest-api.php';
require_once EPDD_PLUGIN_DIR . 'includes/class-admin.php';

/**
 * Eklenti etkinleÅŸtirildiÄŸinde tablolarÄ± ve varsayÄ±lan ayarlarÄ± oluÅŸtur.
 */
function epdd_activate_plugin() {
    EPDD_DB::create_tables();
    EPDD_Auth::ensure_signing_secret();

    $defaults = array(
        'offline_entitlement_days' => 7,
        'max_project_size_mb'      => 10,
        'max_projects_per_user'    => 25,
        'access_token_ttl_sec'     => 900,      // 15 dakika
        'refresh_token_ttl_days'   => 30,
        'device_code_ttl_sec'      => 600,      // 10 dakika
        'remote_ortools_url'       => '',
        'require_email_verified'   => 0,
        'allow_pwa_origins'        => 'https://www.evrakplus.com,https://evrakplus.com',
    );
    if (get_option('epdd_settings') === false) {
        add_option('epdd_settings', $defaults);
    }

    EPDD_Auth::register_rewrite_rules();
    flush_rewrite_rules();
}
register_activation_hook(__FILE__, 'epdd_activate_plugin');

/**
 * Devre dÄ±ÅŸÄ± bÄ±rakÄ±ldÄ±ÄŸÄ±nda KULLANICI VERÄ°LERÄ° SÄ°LÄ°NMEZ; yalnÄ±zca rewrite kurallarÄ± yenilenir.
 */
function epdd_deactivate_plugin() {
    flush_rewrite_rules();
}
register_deactivation_hook(__FILE__, 'epdd_deactivate_plugin');

/**
 * Eklenti bileÅŸenlerini baÅŸlat.
 */
function epdd_init_plugin() {
    EPDD_Auth::init();
    EPDD_Rest_API::init();
    if (is_admin()) {
        EPDD_Admin::init();
    }
}
add_action('plugins_loaded', 'epdd_init_plugin');

/**
 * KullanÄ±cÄ± silindiÄŸinde veya yetkisi kaldÄ±rÄ±ldÄ±ÄŸÄ±nda tÃ¼m cihaz oturumlarÄ±nÄ± iptal et.
 */
add_action('delete_user', array('EPDD_Auth', 'revoke_all_user_tokens'), 10, 1);
add_action('remove_user_from_blog', array('EPDD_Auth', 'revoke_all_user_tokens'), 10, 1);

