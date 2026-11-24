<?php
declare(strict_types=1);

/**
 * EvrakPlus Ders Dagitim Multi Plus — cPanel Web Kurulum Sihirbazi
 * Kurulum tamamlandiginda INSTALL.LOCK dosyasi olusturur ve kendini devre disi birakir.
 */
$lockFile = __DIR__ . '/INSTALL.LOCK';
if (is_file($lockFile)) {
    http_response_code(403);
    echo '<!DOCTYPE html><html lang="tr"><meta charset="utf-8"><title>Kurulum Kilitli</title><body style="font-family:sans-serif;padding:32px"><h2>Kurulum zaten tamamlandı</h2><p>Güvenlik gereği kurulum sihirbazı devre dışı bırakıldı. Yeniden kurulum için sunucudan <code>installer/INSTALL.LOCK</code> dosyasını manuel kaldırın.</p></body></html>';
    exit;
}

$checks = [
    'php_version' => ['label' => 'PHP >= 8.1', 'ok' => version_compare(PHP_VERSION, '8.1.0', '>='), 'detail' => PHP_VERSION],
    'ext_pdo_mysql' => ['label' => 'PDO MySQL eklentisi', 'ok' => extension_loaded('pdo_mysql'), 'detail' => extension_loaded('pdo_mysql') ? 'Yüklü' : 'Eksik'],
    'ext_curl' => ['label' => 'cURL eklentisi', 'ok' => extension_loaded('curl'), 'detail' => extension_loaded('curl') ? 'Yüklü' : 'Eksik'],
    'ext_json' => ['label' => 'JSON eklentisi', 'ok' => extension_loaded('json'), 'detail' => 'Yüklü'],
    'ext_openssl' => ['label' => 'OpenSSL eklentisi', 'ok' => extension_loaded('openssl'), 'detail' => extension_loaded('openssl') ? 'Yüklü' : 'Eksik'],
    'dir_writable' => ['label' => 'config/ yazma izni', 'ok' => is_writable(dirname(__DIR__) . '/config'), 'detail' => dirname(__DIR__) . '/config'],
    'https' => ['label' => 'HTTPS bağlantısı', 'ok' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'), 'detail' => !empty($_SERVER['HTTPS']) ? 'Aktif' : 'HTTP (Üretimde HTTPS önerilir)'],
];

$message = '';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $host = trim((string)($_POST['db_host'] ?? 'localhost'));
    $port = (int)($_POST['db_port'] ?? 3306);
    $name = trim((string)($_POST['db_name'] ?? ''));
    $user = trim((string)($_POST['db_user'] ?? ''));
    $pass = (string)($_POST['db_pass'] ?? '');
    $solverUrl = trim((string)($_POST['solver_url'] ?? ''));
    $solverTok = trim((string)($_POST['solver_token'] ?? ''));

    try {
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host, $port, $name);
        $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $sql = file_get_contents(dirname(__DIR__) . '/database/schema.sql');
        if ($sql === false) {
            throw new RuntimeException('database/schema.sql okunamadı.');
        }
        $pdo->exec($sql);

        $configData = [
            'db' => ['host' => $host, 'port' => $port, 'name' => $name, 'user' => $user, 'pass' => $pass, 'charset' => 'utf8mb4'],
            'evrakplus' => [
                'site_url' => 'https://www.evrakplus.com',
                'login_url' => 'https://www.evrakplus.com/giris',
                'wp_api_base' => 'https://www.evrakplus.com/wp-json/evrakplus/v1',
            ],
            'solver_server' => [
                'enabled' => $solverUrl !== '',
                'base_url' => $solverUrl,
                'api_token' => $solverTok,
                'timeout_seconds' => 15,
            ],
            'security' => ['rate_limit_per_minute' => 120, 'force_https' => true],
        ];
        $phpExport = "<?php\nreturn " . var_export($configData, true) . ";\n";
        $targetCfg = dirname(__DIR__) . '/config/config.php';
        file_put_contents($targetCfg, $phpExport, LOCK_EX);
        chmod($targetCfg, 0600);
        file_put_contents($lockFile, 'INSTALLED_AT=' . gmdate('c') . "\n", LOCK_EX);
        $message = 'Kurulum başarıyla tamamlandı! Kurulum sihirbazı güvenlik amacıyla kilitlendi.';
    } catch (Throwable $e) {
        $error = 'Kurulum hatası: ' . $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>EvrakPlus Ders Dağıtım Multi Plus — Kurulum Sihirbazı</title>
  <style>body{font-family:Inter,system-ui,sans-serif;background:#f3f3f0;color:#14171c;margin:0;padding:24px}.box{max-width:680px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e0e2e6}label{display:block;margin-top:10px;font-size:13px;font-weight:600}input{width:100%;padding:9px;border:1px solid #ccc;border-radius:8px;margin-top:4px;box-sizing:border-box}button{margin-top:16px;background:#d42a38;color:#fff;border:0;padding:11px 20px;border-radius:8px;font-weight:600;cursor:pointer}.ok{color:#15754a}.err{color:#c01f2b}</style>
</head>
<body>
<div class="box">
  <h1>EvrakPlus Multi Plus v1.0.0 — cPanel Kurulumu</h1>
  <h3>1. Sistem Gereksinimleri</h3>
  <ul>
    <?php foreach ($checks as $c): ?>
      <li class="<?= $c['ok'] ? 'ok' : 'err' ?>"><b><?= htmlspecialchars($c['label']) ?>:</b> <?= htmlspecialchars($c['detail']) ?></li>
    <?php endforeach; ?>
  </ul>
  <?php if ($message): ?><p class="ok"><b><?= htmlspecialchars($message) ?></b> <a href="../index.php">Uygulamaya Git →</a></p><?php endif; ?>
  <?php if ($error): ?><p class="err"><b><?= htmlspecialchars($error) ?></b></p><?php endif; ?>
  <?php if (!$message): ?>
  <form method="post">
    <h3>2. MySQL / MariaDB Veri Tabanı</h3>
    <label>Sunucu<input name="db_host" value="localhost" required></label>
    <label>Port<input name="db_port" type="number" value="3306" required></label>
    <label>Veri Tabanı Adı<input name="db_name" required></label>
    <label>Kullanıcı Adı<input name="db_user" required></label>
    <label>Şifre<input name="db_pass" type="password"></label>
    <h3>3. Linux Optimizasyon Sunucusu (İsteğe Bağlı)</h3>
    <label>Solver Server URL<input name="solver_url" placeholder="https://solver.evrakplus.com"></label>
    <label>Solver API Token<input name="solver_token" type="password"></label>
    <button type="submit">Veri Tabanını Kur ve Sihirbazı Kilitle</button>
  </form>
  <?php endif; ?>
</div>
</body>
</html>
