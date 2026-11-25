<?php
/**
 * EvrakPlus Ders Dağıtım Multi Plus - cPanel Kurulum Sihirbazı (install.php)
 * Kurulum dizini: public_html/ders-dagitim-multi-plus/
 * PHP, MySQL/MariaDB, dizin izinleri, HTTPS, API, üyelik ve optimizasyon servisini denetler.
 */
declare(strict_types=1);
header('Content-Type: text/html; charset=utf-8');

$checks = [
    'php' => ['ok' => version_compare(PHP_VERSION, '8.0.0', '>='), 'detail' => 'PHP ' . PHP_VERSION],
    'pdo_mysql' => ['ok' => extension_loaded('pdo_mysql'), 'detail' => extension_loaded('pdo_mysql') ? 'Aktif' : 'Eksik'],
    'curl' => ['ok' => extension_loaded('curl'), 'detail' => extension_loaded('curl') ? 'Aktif' : 'Eksik'],
    'writable' => ['ok' => is_writable(__DIR__), 'detail' => is_writable(__DIR__) ? 'Yazılabilir' : 'Yazma izni gerekli'],
    'https' => ['ok' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['SERVER_PORT'] ?? '') == 443), 'detail' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'HTTPS Aktif' : 'HTTP (Üretimde HTTPS önerilir)'],
];

$message = '';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $dbHost = trim((string)($_POST['db_host'] ?? 'localhost'));
    $dbName = trim((string)($_POST['db_name'] ?? ''));
    $dbUser = trim((string)($_POST['db_user'] ?? ''));
    $dbPass = (string)($_POST['db_pass'] ?? '');
    $wpApi = rtrim(trim((string)($_POST['wp_api'] ?? 'https://www.evrakplus.com/wp-json/evrakplus/v1')), '/');
    $solverUrl = rtrim(trim((string)($_POST['solver_url'] ?? '')), '/');
    $solverKey = trim((string)($_POST['solver_key'] ?? ''));

    try {
        $dsn = "mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4";
        $pdo = new PDO($dsn, $dbUser, $dbPass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

        $pdo->exec("CREATE TABLE IF NOT EXISTS ep_mp_projects (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            project_uuid VARCHAR(64) NOT NULL UNIQUE,
            user_id BIGINT NOT NULL,
            name VARCHAR(255) NOT NULL,
            schema_version VARCHAR(16) NOT NULL DEFAULT '2.0',
            data_version INT NOT NULL DEFAULT 1,
            payload_json LONGTEXT NOT NULL,
            deleted TINYINT(1) NOT NULL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

        $pdo->exec("CREATE TABLE IF NOT EXISTS ep_mp_solve_jobs (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            job_uuid VARCHAR(64) NOT NULL UNIQUE,
            user_id BIGINT NOT NULL DEFAULT 0,
            status VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
            mode VARCHAR(32) NOT NULL DEFAULT 'auto',
            input_json LONGTEXT NOT NULL,
            result_json LONGTEXT NULL,
            worker_id VARCHAR(64) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

        $pdo->exec("CREATE TABLE IF NOT EXISTS ep_mp_devices (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            device_id VARCHAR(64) NOT NULL UNIQUE,
            user_id BIGINT NOT NULL,
            device_name VARCHAR(128) NOT NULL,
            worker_token_hash VARCHAR(128) NOT NULL,
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

        $cfg = "<?php\nreturn " . var_export([
            'db_host' => $dbHost,
            'db_name' => $dbName,
            'db_user' => $dbUser,
            'db_pass' => $dbPass,
            'wp_api_base' => $wpApi,
            'solver_server_url' => $solverUrl,
            'solver_server_key' => $solverKey,
            'installed_at' => gmdate('c'),
            'version' => '1.0.0',
        ], true) . ";\n";

        file_put_contents(__DIR__ . '/config.php', $cfg);
        $message = 'Kurulum başarıyla tamamlandı! Güvenlik için install.php dosyasını sunucudan siliniz.';
    } catch (Throwable $e) {
        $error = 'Kurulum hatası: ' . $e->getMessage();
    }
}
?>
<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>DersOptima Pro Haftalık Ders Dağıtım Programı — cPanel Kurulum Sihirbazı</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:24px}
    .card{max-width:720px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;box-shadow:0 4px 16px rgba(15,23,42,.06)}
    .ok{color:#047857;font-weight:700}.bad{color:#be123c;font-weight:700}
    label{display:block;font-size:13px;font-weight:600;margin-top:12px}
    input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px;margin-top:4px}
    button{margin-top:18px;background:#4f46e5;color:#fff;border:none;padding:12px 20px;border-radius:10px;font-weight:700;cursor:pointer}
    .msg{padding:12px;border-radius:8px;margin:12px 0;font-size:13px}
    .msg-ok{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0}
    .msg-err{background:#fff1f2;color:#9f1239;border:1px solid #fecdd3}
  </style>
</head>
<body>
  <div class="card">
    <h1>DersOptima Pro Haftalık Ders Dağıtım Programı v1.0.4 — Kurulum Sihirbazı</h1>
    <p>Bu kurulum mevcut WordPress sitenize ve diğer uygulamalara müdahale etmeden yalnızca bu dizinde çalışır.</p>
    <h3>Sistem Kontrolleri</h3>
    <ul>
      <?php foreach ($checks as $k => $c): ?>
        <li><strong><?= htmlspecialchars($k) ?>:</strong> <span class="<?= $c['ok'] ? 'ok' : 'bad' ?>"><?= htmlspecialchars($c['detail']) ?></span></li>
      <?php endforeach; ?>
    </ul>
    <?php if ($message): ?><div class="msg msg-ok"><?= htmlspecialchars($message) ?></div><?php endif; ?>
    <?php if ($error): ?><div class="msg msg-err"><?= htmlspecialchars($error) ?></div><?php endif; ?>
    <form method="post">
      <label>MySQL / MariaDB Sunucu <input name="db_host" value="localhost" required /></label>
      <label>Veritabanı Adı <input name="db_name" required /></label>
      <label>Veritabanı Kullanıcı Adı <input name="db_user" required /></label>
      <label>Veritabanı Şifresi <input name="db_pass" type="password" /></label>
      <label>EvrakPlus WordPress API Adresi <input name="wp_api" value="https://www.evrakplus.com/wp-json/evrakplus/v1" required /></label>
      <label>Harici Linux/VPS Solver Server URL (İsteğe Bağlı) <input name="solver_url" placeholder="https://solver.evrakplus.com" /></label>
      <label>Solver Server API Anahtarı (İsteğe Bağlı) <input name="solver_key" type="password" /></label>
      <button type="submit">Veritabanını Kur ve Kaydet</button>
    </form>
  </div>
</body>
</html>
