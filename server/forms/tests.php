<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';
use NormaForms\FormError;

$path = tempnam(sys_get_temp_dir(), 'norma-test-');
$config = ['secret' => bin2hex(random_bytes(32)), 'state_file' => $path, 'origins' => ['https://fearhammer.github.io']];
$now = 1800000000;
$ip = '192.0.2.1';
$origin = $config['origins'][0];
$mail = [];
$send = function (array $message) use (&$mail): bool { $mail[] = $message; return true; };
$base = ['name' => 'Тестовый клиент', 'email' => 'test@example.com', 'telegram' => '@test', 'website' => 'example.com',
    'service' => 'Ведение корпоративного блога', 'page' => $origin . '/norma/services/vedenie-korporativnogo-bloga/', 'company_fax' => ''];
$assertions = 0;
function check(bool $pass, string $name): void {
    global $assertions;
    if (!$pass) throw new RuntimeException('FAIL: ' . $name);
    $assertions++;
}
function reject(callable $run, int $status, string $name): void {
    try { $run(); } catch (FormError $error) { check($error->status === $status, $name); return; }
    throw new RuntimeException('FAIL (accepted): ' . $name);
}
function fresh(array $changes = []): array {
    global $base, $config, $ip, $origin, $now;
    return array_merge($base, ['token' => NormaForms\challenge($ip, $origin, $config['secret'], $now - 5)], $changes);
}
function submit(array $input): void {
    global $config, $ip, $origin, $now, $send;
    NormaForms\submit($input, $config, $ip, $origin, $now, $send);
}
try {
    $valid = fresh(['to' => 'attacker@example.com', 'subject' => 'Wrong subject']);
    submit($valid);
    check(count($mail) === 1, 'valid submission');
    check($mail[0]['to'] === 'mail@norma-studio.ru', 'fixed recipient');
    check(base64_decode(substr($mail[0]['subject'], 10, -2)) === 'Заявка с сайта Norma', 'fixed UTF-8 subject');
    $body = base64_decode($mail[0]['body']);
    foreach ($base as $key => $value) if ($value !== '') check(str_contains($body, $value), 'field in email: ' . $key);
    check($mail[0]['headers']['Reply-To'] === 'test@example.com', 'safe reply-to');
    submit($valid);
    submit(fresh());
    check(count($mail) === 1, 'duplicate retries do not resend');
    reject(fn() => submit(array_merge($valid, ['name' => 'Changed'])), 409, 'token replay');
    reject(fn() => submit(fresh(['company_fax' => 'spam'])), 422, 'honeypot');
    reject(fn() => submit(fresh(['name' => []])), 422, 'array input');
    reject(fn() => submit(fresh(['name' => "   "])), 422, 'empty name');
    reject(fn() => submit(fresh(['name' => str_repeat('я', 121)])), 422, 'Unicode size limit');
    reject(fn() => submit(fresh(['email' => "test@example.com\r\nBcc: attacker@example.com"])), 422, 'header injection');
    reject(fn() => submit(fresh(['email' => 'broken-address'])), 422, 'invalid email');
    reject(fn() => submit(fresh(['page' => 'https://evil.example/'])), 422, 'untrusted source page');
    reject(fn() => submit(fresh(['token' => 'forged'])), 403, 'forged token');
    reject(fn() => submit(fresh(['token' => NormaForms\challenge($ip, $origin, $config['secret'], $now)])), 429, 'too fast');
    reject(fn() => submit(fresh(['token' => NormaForms\challenge($ip, $origin, $config['secret'], $now - 1801)])), 403, 'expired token');
    reject(fn() => submit(fresh(['token' => NormaForms\challenge('192.0.2.2', $origin, $config['secret'], $now - 5)])), 403, 'IP binding');
    reject(fn() => submit(fresh(['token' => NormaForms\challenge($ip, 'https://evil.example', $config['secret'], $now - 5)])), 403, 'origin binding');
    submit(fresh(['name' => 'Second']));
    submit(fresh(['name' => 'Third']));
    reject(fn() => submit(fresh(['name' => 'Fourth'])), 429, 'submission rate limit');
    check(count($mail) === 3, 'rejected requests never send email');
    $raw = file_get_contents($path);
    check(!str_contains($raw, $ip) && !str_contains($raw, 'test@example.com') && !str_contains($raw, 'Тестовый'), 'state contains no raw personal data');
    file_put_contents($path, '');
    for ($i = 0; $i < 30; $i++) NormaForms\requestLimit($config, $ip, $now);
    reject(fn() => NormaForms\requestLimit($config, $ip, $now), 429, 'request rate limit');
    file_put_contents($path, '');
    reject(fn() => NormaForms\submit(fresh(), $config, $ip, $origin, $now, fn() => false), 503, 'mail failure is not success');
    file_put_contents($path, '');
    $parallel = fresh();
    NormaForms\submit($parallel, $config, $ip, $origin, $now, function ($message) use ($send) {
        reject(fn() => submit(fresh()), 409, 'concurrent duplicate blocked');
        return $send($message);
    });
    file_put_contents($path, 'invalid json');
    try { submit(fresh(['name' => 'Storage failure'])); throw new RuntimeException('Corrupt state accepted'); }
    catch (JsonException $error) { check(true, 'corrupt state fails closed'); }
    echo "PASS: $assertions assertions; no real email sent.\n";
} finally { unlink($path); }
