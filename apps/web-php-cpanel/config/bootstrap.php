<?php
declare(strict_types=1);

/**
 * Ortak PHP Bootstrap:
 * 1) Hassas yapilandirmayi once public_html disindan okur
 * 2) Guvenli oturum ve CSRF korumasi baslatir
 * 3) PDO (prepared statements) baglantisi ve rate limit saglar
 */
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/ders-dagitim-multi-plus/',
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function ep_load_config(): ?array {
    $externalPath = dirname(__DIR__, 2) . '/evrakplus_multiplus_config.php';
    $localPath = __DIR__ . '/config.php';
    if (is_file($externalPath)) {
        return require $externalPath;
    }
    if (is_file($localPath)) {
        return require $localPath;
    }
    return null;
}

function ep_csrf_token(): string {
    if (empty($_SESSION['ep_csrf_token'])) {
        $_SESSION['ep_csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['ep_csrf_token'];
}

function ep_verify_csrf(): bool {
    $hdr = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $tok = $_SESSION['ep_csrf_token'] ?? '';
    return is_string($hdr) && is_string($tok) && $tok !== '' && hash_equals($tok, $hdr);
}

function ep_pdo(array $cfg): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $db = $cfg['db'];
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $db['host'],
        (int)($db['port'] ?? 3306),
        $db['name'],
        $db['charset'] ?? 'utf8mb4'
    );
    $pdo = new PDO($dsn, $db['user'], $db['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function ep_rate_limit(int $maxPerMin = 120): bool {
    $now = time();
    $bucket = $_SESSION['ep_rl'] ?? ['start' => $now, 'count' => 0];
    if ($now - $bucket['start'] >= 60) {
        $bucket = ['start' => $now, 'count' => 0];
    }
    $bucket['count']++;
    $_SESSION['ep_rl'] = $bucket;
    return $bucket['count'] <= $maxPerMin;
}

function ep_json(array $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function ep_http_json(string $method, string $url, ?array $body = null, array $headers = [], int $timeout = 15): array {
    $ch = curl_init($url);
    $hdrs = array_merge(['Accept: application/json'], $headers);
    if ($body !== null) {
        $hdrs[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE));
    }
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $hdrs,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($raw === false) {
        return ['ok' => false, 'status' => 0, 'error' => $err];
    }
    $decoded = json_decode($raw, true);
    return ['ok' => ($code >= 200 && $code < 300), 'status' => $code, 'data' => $decoded, 'raw' => $raw];
}
