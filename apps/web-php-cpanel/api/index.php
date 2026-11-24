<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/bootstrap.php';

$cfg = ep_load_config();
if (!$cfg) {
    ep_json(['error' => 'Uygulama kurulmamis. Lutfen installer/ sihirbazini calistirin.'], 503);
}

if (!ep_rate_limit((int)($cfg['security']['rate_limit_per_minute'] ?? 120))) {
    ep_json(['error' => 'Cok fazla istek gonderildi. Lutfen kisa bir sure bekleyin.'], 429);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$route = $_GET['route'] ?? 'health';

if (in_array($method, ['POST', 'PUT', 'DELETE'], true) && !ep_verify_csrf()) {
    ep_json(['error' => 'Gecersiz veya eksik CSRF dogrulama belirteci.'], 403);
}

$rawBody = file_get_contents('php://input') ?: '';
$body = $rawBody !== '' ? (json_decode($rawBody, true) ?: []) : [];
$wpUserId = (int)($_SESSION['ep_wp_user_id'] ?? 0);

switch ($route) {
    case 'health':
        ep_json([
            'ok' => true,
            'app' => 'EvrakPlus Ders Dagitim Multi Plus Web',
            'version' => '1.0.0',
            'php' => PHP_VERSION,
            'solverServerConfigured' => !empty($cfg['solver_server']['enabled']) && !empty($cfg['solver_server']['base_url']),
            'modes' => [
                'vps_server' => 'Ayrilmis Linux VPS Optimizasyon Sunucusu (6 Gercek Motor)',
                'desktop_bridge' => 'Eslesmis Windows Masaustu Uygulamasi (Yerel 6 Motor)',
                'browser_limited' => 'Tarayici Tabanli Temel Cozum (Sinirli - 6 motor yerine gecmez)',
            ],
        ]);

    case 'projects':
        $pdo = ep_pdo($cfg);
        $stmt = $pdo->prepare('SELECT id, school_name, schema_version, revision, updated_at FROM ep_projects WHERE wp_user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC');
        $stmt->execute([$wpUserId]);
        ep_json(['projects' => $stmt->fetchAll()]);

    case 'projects/save':
        if (empty($body['id']) || empty($body['school']['name'])) {
            ep_json(['error' => 'Gecersiz proje verisi.'], 400);
        }
        // Hassas anahtarlari kaydetmeden temizle
        unset($body['auth'], $body['access_token'], $body['refresh_token']);
        $pdo = ep_pdo($cfg);
        $now = gmdate('Y-m-d H:i:s.v');
        $stmt = $pdo->prepare('
            INSERT INTO ep_projects (id, wp_user_id, school_name, schema_version, revision, payload_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              school_name = VALUES(school_name),
              schema_version = VALUES(schema_version),
              revision = VALUES(revision),
              payload_json = VALUES(payload_json),
              updated_at = VALUES(updated_at),
              deleted_at = NULL
        ');
        $stmt->execute([
            (string)$body['id'],
            $wpUserId,
            (string)$body['school']['name'],
            (int)($body['schemaVersion'] ?? 3),
            (int)($body['revision'] ?? 1),
            json_encode($body, JSON_UNESCAPED_UNICODE),
            $now,
        ]);
        ep_json(['saved' => true, 'id' => $body['id'], 'updatedAt' => $now]);

    case 'jobs/submit':
        // ONEMLI: PHP HTTP istegi icinde sahte veya uzun sureli optimizasyon ASLA calistirilmaz!
        $srv = $cfg['solver_server'] ?? [];
        if (empty($srv['enabled']) || empty($srv['base_url'])) {
            ep_json([
                'error' => 'Optimizasyon sunucusu yapilandirilmamis.',
                'fallbackModes' => ['vps_server', 'desktop_bridge', 'browser_limited'],
            ], 503);
        }
        $resp = ep_http_json(
            'POST',
            rtrim($srv['base_url'], '/') . '/jobs',
            $body,
            ['Authorization: Bearer ' . ($srv['api_token'] ?? '')],
            (int)($srv['timeout_seconds'] ?? 15)
        );
        if (!$resp['ok']) {
            ep_json([
                'error' => 'Optimizasyon sunucusuna erisilemiyor: ' . ($resp['error'] ?? ('HTTP ' . $resp['status'])),
                'fallbackModes' => ['desktop_bridge', 'browser_limited'],
            ], 502);
        }
        ep_json($resp['data'] ?? ['status' => 'QUEUED'], 202);

    case 'jobs/status':
    case 'jobs/result':
        $jobId = preg_replace('/[^a-zA-Z0-9\-_]/', '', (string)($_GET['id'] ?? ''));
        if ($jobId === '') {
            ep_json(['error' => 'Gecersiz is kimligi.'], 400);
        }
        $srv = $cfg['solver_server'];
        $endpoint = $route === 'jobs/result' ? "/jobs/{$jobId}/result" : "/jobs/{$jobId}/progress";
        $resp = ep_http_json('GET', rtrim($srv['base_url'], '/') . $endpoint, null, [
            'Authorization: Bearer ' . ($srv['api_token'] ?? ''),
        ]);
        ep_json($resp['data'] ?? ['error' => 'Durum alinamadi'], $resp['ok'] ? 200 : 502);

    case 'jobs/cancel':
        $jobId = preg_replace('/[^a-zA-Z0-9\-_]/', '', (string)($body['id'] ?? ''));
        $srv = $cfg['solver_server'];
        $resp = ep_http_json('POST', rtrim($srv['base_url'], '/') . "/jobs/{$jobId}/cancel", [], [
            'Authorization: Bearer ' . ($srv['api_token'] ?? ''),
        ]);
        ep_json($resp['data'] ?? ['cancelled' => $resp['ok']], $resp['ok'] ? 200 : 502);

    case 'export/authorize':
        // Web cikti yetkisi YALNIZCA sunucu tarafinda EvrakPlus WP API ile dogrulanir
        $accessToken = (string)($_SESSION['ep_access_token'] ?? '');
        if ($accessToken === '') {
            ep_json([
                'authorized' => false,
                'title' => 'Ücretsiz üyelik gerekli',
                'loginUrl' => $cfg['evrakplus']['login_url'] ?? 'https://www.evrakplus.com/giris',
            ], 401);
        }
        $wpBase = rtrim($cfg['evrakplus']['wp_api_base'], '/');
        $check = ep_http_json('GET', $wpBase . '/entitlements', null, [
            'Authorization: Bearer ' . $accessToken,
        ]);
        if (!$check['ok'] || empty($check['data']['canExport'])) {
            ep_json([
                'authorized' => false,
                'title' => 'Ücretsiz üyelik gerekli',
                'loginUrl' => $cfg['evrakplus']['login_url'] ?? 'https://www.evrakplus.com/giris',
            ], 403);
        }
        ep_json(['authorized' => true, 'entitlements' => $check['data']]);

    default:
        ep_json(['error' => 'Bilinmeyen API rotasi.'], 404);
}
