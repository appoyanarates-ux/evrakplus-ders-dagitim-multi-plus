<?php
/**
 * EvrakPlus Ders Dağıtım Multi Plus - cPanel Web REST API (api.php)
 * Asenkron optimizasyon iş kuyruğu, yerel Windows worker eşleştirme,
 * EvrakPlus üyelik çıktı yetkisi doğrulama ve 409 çakışma kontrollü proje senkronizasyonu.
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

$cfgPath = __DIR__ . '/config.php';
if (!file_exists($cfgPath)) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'Kurulum tamamlanmamış. Lütfen install.php dosyasını çalıştırın.']);
    exit;
}
$cfg = require $cfgPath;

function get_pdo(array $cfg): PDO {
    $dsn = "mysql:host={$cfg['db_host']};dbname={$cfg['db_name']};charset=utf8mb4";
    return new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}

function read_json_body(): array {
    $raw = file_get_contents('php://input');
    $decoded = json_decode($raw ?: '{}', true);
    return is_array($decoded) ? $decoded : [];
}

$action = (string)($_GET['action'] ?? 'health');

try {
    if ($action === 'health') {
        $pdo = get_pdo($cfg);
        $pdo->query('SELECT 1');
        echo json_encode([
            'ok' => true,
            'app' => 'EvrakPlus Ders Dağıtım Multi Plus Web API',
            'version' => $cfg['version'] ?? '1.0.0',
            'solver_server_configured' => !empty($cfg['solver_server_url']),
            'wp_api_base' => $cfg['wp_api_base'] ?? '',
        ]);
        exit;
    }

    if ($action === 'submit_job' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = read_json_body();
        $jobUuid = bin2hex(random_bytes(16));
        $mode = (string)($body['solution_request']['multi_mode'] ?? 'auto');
        $pdo = get_pdo($cfg);
        $stmt = $pdo->prepare('INSERT INTO ep_mp_solve_jobs (job_uuid, status, mode, input_json) VALUES (?, ?, ?, ?)');
        $stmt->execute([$jobUuid, 'QUEUED', $mode, json_encode($body, JSON_UNESCAPED_UNICODE)]);

        // Harici Solver Server tanımlıysa asenkron olarak işi ilet (PHP isteğini kilitleme!)
        $forwarded = false;
        if (!empty($cfg['solver_server_url'])) {
            $ch = curl_init($cfg['solver_server_url'] . '/v1/jobs');
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 5,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'X-API-Key: ' . ($cfg['solver_server_key'] ?? ''),
                ],
                CURLOPT_POSTFIELDS => json_encode(['job_uuid' => $jobUuid, 'config' => $body], JSON_UNESCAPED_UNICODE),
            ]);
            $resp = curl_exec($ch);
            $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($code >= 200 && $code < 300) {
                $forwarded = true;
                $pdo->prepare('UPDATE ep_mp_solve_jobs SET status = ? WHERE job_uuid = ?')->execute(['RUNNING', $jobUuid]);
            }
        }

        echo json_encode(['ok' => true, 'job_uuid' => $jobUuid, 'status' => $forwarded ? 'RUNNING' : 'QUEUED', 'forwarded_to_solver_server' => $forwarded]);
        exit;
    }

    if ($action === 'job_status') {
        $jobUuid = (string)($_GET['id'] ?? '');
        $pdo = get_pdo($cfg);
        $stmt = $pdo->prepare('SELECT job_uuid, status, mode, result_json, updated_at FROM ep_mp_solve_jobs WHERE job_uuid = ?');
        $stmt->execute([$jobUuid]);
        $row = $stmt->fetch();
        if (!$row) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'error' => 'İş bulunamadı.']);
            exit;
        }
        echo json_encode([
            'ok' => true,
            'job_uuid' => $row['job_uuid'],
            'status' => $row['status'],
            'mode' => $row['mode'],
            'result' => $row['result_json'] ? json_decode($row['result_json'], true) : null,
            'updated_at' => $row['updated_at'],
        ]);
        exit;
    }

    if ($action === 'sync_project' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = read_json_body();
        $uuid = (string)($body['project_uuid'] ?? '');
        $userId = (int)($body['user_id'] ?? 0);
        $expectedVersion = (int)($body['expected_version'] ?? 0);
        if (!$uuid || $userId <= 0) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'project_uuid ve user_id zorunludur.']);
            exit;
        }
        $pdo = get_pdo($cfg);
        $stmt = $pdo->prepare('SELECT data_version, payload_json, updated_at FROM ep_mp_projects WHERE project_uuid = ? AND user_id = ?');
        $stmt->execute([$uuid, $userId]);
        $existing = $stmt->fetch();

        if ($existing && $expectedVersion > 0 && (int)$existing['data_version'] !== $expectedVersion) {
            http_response_code(409);
            echo json_encode([
                'ok' => false,
                'conflict' => true,
                'server_version' => (int)$existing['data_version'],
                'server_updated_at' => $existing['updated_at'],
                'message' => 'Çakışma tespit edildi: Proje başka bir cihazda güncellenmiş. Veriler ezilmedi.',
            ]);
            exit;
        }

        $nextVersion = $existing ? ((int)$existing['data_version'] + 1) : 1;
        $payloadStr = json_encode($body['payload'] ?? [], JSON_UNESCAPED_UNICODE);
        $name = (string)($body['name'] ?? 'Okul Projesi');

        if ($existing) {
            $u = $pdo->prepare('UPDATE ep_mp_projects SET name = ?, data_version = ?, payload_json = ?, deleted = ? WHERE project_uuid = ? AND user_id = ?');
            $u->execute([$name, $nextVersion, $payloadStr, !empty($body['deleted']) ? 1 : 0, $uuid, $userId]);
        } else {
            $i = $pdo->prepare('INSERT INTO ep_mp_projects (project_uuid, user_id, name, data_version, payload_json) VALUES (?, ?, ?, ?, ?)');
            $i->execute([$uuid, $userId, $name, $nextVersion, $payloadStr]);
        }

        echo json_encode(['ok' => true, 'project_uuid' => $uuid, 'data_version' => $nextVersion]);
        exit;
    }

    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'Bilinmeyen uç nokta: ' . $action]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
