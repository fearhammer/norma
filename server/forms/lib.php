<?php
declare(strict_types=1);

namespace NormaForms;

const RECIPIENT = 'mail@norma-studio.ru';
const SUBJECT = 'Заявка с сайта Norma';

final class FormError extends \RuntimeException
{
    public int $status;
    public function __construct(int $status, string $message)
    {
        parent::__construct($message);
        $this->status = $status;
    }
}

function field(array $input, string $key, int $limit, bool $required = false): string
{
    $value = $input[$key] ?? '';
    if (!is_string($value) || !preg_match('//u', $value) || preg_match('/[\x00-\x1F\x7F]/', $value)) {
        throw new FormError(422, 'Проверьте поля формы.');
    }
    $value = trim($value);
    preg_match_all('/./us', $value, $characters);
    if (count($characters[0]) > $limit || ($required && !preg_match('/\S/u', $value))) {
        throw new FormError(422, 'Проверьте поля формы.');
    }
    return $value;
}

function validate(array $input, array $origins): array
{
    $data = [];
    foreach (['name' => 120, 'email' => 254, 'telegram' => 100, 'website' => 300, 'service' => 200, 'page' => 1000] as $key => $limit) {
        $data[$key] = field($input, $key, $limit, in_array($key, ['name', 'email', 'page'], true));
    }
    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        throw new FormError(422, 'Укажите корректный email.');
    }
    $page = parse_url($data['page']);
    $origin = ($page['scheme'] ?? '') . '://' . ($page['host'] ?? '') . (isset($page['port']) ? ':' . $page['port'] : '');
    if (!in_array($origin, $origins, true) || isset($page['user']) || isset($page['pass'])) {
        throw new FormError(422, 'Не удалось определить страницу отправки.');
    }
    // The server uses only this allowlist; client-supplied recipients/headers are ignored.
    return $data;
}

function digest(string $value, string $secret): string
{
    return hash_hmac('sha256', $value, $secret);
}

function challenge(string $ip, string $origin, string $secret, int $now): string
{
    $payload = $now . '.' . bin2hex(random_bytes(24));
    return $payload . '.' . digest($payload . '|' . $ip . '|' . $origin, $secret);
}

function checkChallenge(string $token, string $ip, string $origin, string $secret, int $now): void
{
    if (!preg_match('/^(\d{10})\.([a-f0-9]{48})\.([a-f0-9]{64})$/D', $token, $parts)
        || !hash_equals(digest($parts[1] . '.' . $parts[2] . '|' . $ip . '|' . $origin, $secret), $parts[3])) {
        throw new FormError(403, 'Обновите форму и попробуйте ещё раз.');
    }
    $age = $now - (int) $parts[1];
    if ($age < 3) throw new FormError(429, 'Подождите несколько секунд и попробуйте ещё раз.');
    if ($age > 1800) throw new FormError(403, 'Время ожидания истекло. Отправьте форму ещё раз.');
}

/** Atomic, bounded storage; only keyed hashes and timestamps, no form contents/IP addresses. */
function transaction(string $path, callable $action)
{
    $handle = @fopen($path, 'c+');
    if (!$handle || !flock($handle, LOCK_EX)) throw new \RuntimeException('State unavailable');
    try {
        $raw = stream_get_contents($handle);
        $state = $raw === '' ? [] : json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($state)) throw new \RuntimeException('Invalid state');
        $result = $action($state);
        $encoded = json_encode($state, JSON_THROW_ON_ERROR);
        rewind($handle);
        if (!ftruncate($handle, 0) || fwrite($handle, $encoded) !== strlen($encoded) || !fflush($handle)) {
            throw new \RuntimeException('State write failed');
        }
        return $result;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function prune(array &$state, int $now): void
{
    foreach ($state as $key => $entries) {
        $state[$key] = array_values(array_filter($entries, fn($time) => $time > $now - 86400));
        if (!$state[$key]) unset($state[$key]);
    }
    if (count($state) > 20000) throw new FormError(503, 'Форма временно недоступна. Напишите нам в Telegram.');
}

function limit(array &$state, string $key, int $count, int $period, int $now): void
{
    $recent = array_filter($state[$key] ?? [], fn($time) => $time > $now - $period);
    if (count($recent) >= $count) throw new FormError(429, 'Слишком много попыток. Попробуйте позже или напишите в Telegram.');
}

function requestLimit(array $config, string $ip, int $now): void
{
    transaction($config['state_file'], function (&$state) use ($config, $ip, $now) {
        prune($state, $now);
        $key = 'requests:' . digest($ip, $config['secret']);
        limit($state, $key, 30, 600, $now);
        limit($state, 'requests:all', 2000, 3600, $now);
        // Keep request counters bounded to the longest request window.
        $state[$key] = array_values(array_filter($state[$key] ?? [], fn($t) => $t > $now - 600));
        $state['requests:all'] = array_values(array_filter($state['requests:all'] ?? [], fn($t) => $t > $now - 3600));
        $state[$key][] = $now;
        $state['requests:all'][] = $now;
    });
}

function message(array $data): array
{
    $lines = [SUBJECT, '', 'Имя: ' . $data['name'], 'Email: ' . $data['email'],
        'Telegram: ' . ($data['telegram'] ?: 'не указан'), 'Сайт компании: ' . ($data['website'] ?: 'не указан'),
        'Услуга: ' . ($data['service'] ?: 'не указана'), 'Страница: ' . $data['page']];
    return [
        'to' => RECIPIENT,
        'subject' => '=?UTF-8?B?' . base64_encode(SUBJECT) . '?=',
        'body' => chunk_split(base64_encode(implode("\r\n", $lines)), 76, "\r\n"),
        'headers' => ['From' => 'Norma Studio <' . RECIPIENT . '>', 'Reply-To' => $data['email'],
            'MIME-Version' => '1.0', 'Content-Type' => 'text/plain; charset=UTF-8', 'Content-Transfer-Encoding' => 'base64'],
    ];
}

function submit(array $input, array $config, string $ip, string $origin, int $now, callable $send): void
{
    if (field($input, 'company_fax', 200) !== '') throw new FormError(422, 'Не удалось отправить форму.');
    $data = validate($input, $config['origins']);
    $token = field($input, 'token', 200, true);
    checkChallenge($token, $ip, $origin, $config['secret'], $now);
    $tokenKey = 'token:' . digest($token, $config['secret']);
    $ipKey = 'sent-ip:' . digest($ip, $config['secret']);
    $emailKey = 'sent-email:' . digest(strtolower($data['email']), $config['secret']);
    $duplicateKey = 'duplicate:' . digest(json_encode($data), $config['secret']);
    $pendingKey = 'pending:' . $duplicateKey;
    $alreadySent = transaction($config['state_file'], function (&$state) use ($tokenKey, $ipKey, $emailKey, $duplicateKey, $pendingKey, $now) {
        prune($state, $now);
        // A retry after the response was lost must not send a second email.
        if (isset($state[$duplicateKey]) && end($state[$duplicateKey]) > $now - 600) return true;
        if (isset($state[$pendingKey]) && end($state[$pendingKey]) > $now - 120) throw new FormError(409, 'Заявка ещё отправляется. Подождите немного.');
        if (isset($state[$tokenKey])) throw new FormError(409, 'Эта форма уже отправлена. Обновите страницу.');
        limit($state, $ipKey, 3, 900, $now);
        limit($state, $ipKey, 10, 86400, $now);
        limit($state, $emailKey, 5, 3600, $now);
        limit($state, 'sent:all', 200, 86400, $now);
        foreach ([$tokenKey, $ipKey, $emailKey, 'sent:all'] as $key) $state[$key][] = $now;
        $state[$pendingKey] = [$now];
        return false;
    });
    if ($alreadySent) return;
    try {
        if (!$send(message($data))) throw new FormError(503, 'Не удалось передать письмо. Попробуйте позже или напишите в Telegram.');
        transaction($config['state_file'], function (&$state) use ($duplicateKey, $now) { $state[$duplicateKey] = [$now]; });
    } finally {
        transaction($config['state_file'], function (&$state) use ($pendingKey) { unset($state[$pendingKey]); });
    }
}
