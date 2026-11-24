<?php
/**
 * EvrakPlus Ders Dagitim Multi Plus — Ornek Yapilandirma Dosyasi.
 * Guvenlik geregi uretimde bu dosyayi public_html disina:
 *   /home/<cpanel_user>/evrakplus_multiplus_config.php
 * olarak yerlestirmeniz onerilir.
 */
return [
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'evrakplus_multiplus',
        'user' => 'CHANGE_ME',
        'pass' => 'CHANGE_ME',
        'charset' => 'utf8mb4',
    ],
    'evrakplus' => [
        'site_url' => 'https://www.evrakplus.com',
        'login_url' => 'https://www.evrakplus.com/giris',
        'wp_api_base' => 'https://www.evrakplus.com/wp-json/evrakplus/v1',
    ],
    'solver_server' => [
        'enabled' => true,
        'base_url' => 'https://solver.evrakplus.com',
        'api_token' => 'CHANGE_ME_SOLVER_SERVER_TOKEN',
        'timeout_seconds' => 15,
    ],
    'security' => [
        'rate_limit_per_minute' => 120,
        'force_https' => true,
    ],
];
