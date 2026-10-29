<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';

use NormaForms\FormError;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Vary: Origin');
ini_set('display_errors', '0');
umask(0077);

try {
    // Configure this absolute path in the hosting environment; never put secrets in public/.
    $configPath = getenv('NORMA_FORMS_CONFIG') ?: dirname(__DIR__, 3) . '/norma-private/forms-config.php';
    if (!is_file($configPath)) throw new RuntimeException('Configuration unavailable');
    $config = require $configPath;
    if (!is_array($config) || strlen($config['secret'] ?? '') < 64 || empty($config['state_file']) || empty($config['origins'])) {
        throw new RuntimeException('Invalid configuration');
    }
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (!in_array($origin, $config['origins'], true)) throw new FormError(403, 'Отправка с этого сайта запрещена.');
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
    if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'], true)) throw new FormError(405, 'Метод не поддерживается.');
    // Do not trust X-Forwarded-For from visitors. Configure a trusted proxy separately if needed.
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if (!filter_var($ip, FILTER_VALIDATE_IP)) throw new FormError(403, 'Не удалось проверить запрос.');
    $now = time();
    NormaForms\requestLimit($config, $ip, $now);
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        echo json_encode(['token' => NormaForms\challenge($ip, $origin, $config['secret'], $now)], JSON_THROW_ON_ERROR);
        exit;
    }
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 8192) throw new FormError(413, 'Слишком большой запрос.');
    $type = strtolower(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]);
    if ($type !== 'application/json') throw new FormError(415, 'Неверный формат запроса.');
    $body = file_get_contents('php://input', false, null, 0, 8193);
    if (strlen($body) > 8192) throw new FormError(413, 'Слишком большой запрос.');
    $input = json_decode($body, true);
    if (!is_array($input)) throw new FormError(400, 'Неверный формат запроса.');
    NormaForms\submit($input, $config, $ip, $origin, $now, function (array $mail): bool {
        return mail($mail['to'], $mail['subject'], $mail['body'], $mail['headers']);
    });
    echo json_encode(['ok' => true]);
} catch (FormError $error) {
    http_response_code($error->status);
    if ($error->status === 429) header('Retry-After: 60');
    echo json_encode(['ok' => false, 'message' => $error->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    error_log('Norma forms: internal failure (' . get_class($error) . ')');
    http_response_code(503);
    echo json_encode(['ok' => false, 'message' => 'Форма временно недоступна. Напишите нам в Telegram.'], JSON_UNESCAPED_UNICODE);
}
