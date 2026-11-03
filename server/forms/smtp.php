<?php
declare(strict_types=1);
namespace NormaForms;
foreach (['Exception', 'PHPMailer', 'SMTP'] as $class) require_once __DIR__ . '/vendor/PHPMailer/' . $class . '.php';

function smtpSend(array $message, array $config): bool
{
    $password = $config['smtp_password'] ?? '';
    if (!is_string($password) || $password === '') throw new \RuntimeException('SMTP not configured');
    $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
    $mail->isSMTP();
    $mail->Host = 'smtp.yandex.ru';
    $mail->Port = 465;
    $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
    $mail->SMTPAuth = true;
    $mail->Username = 'anton@norma-studio.ru';
    $mail->Password = $password;
    if (PHP_SAPI === 'cli-server' && isset($config['test_smtp_port'])) {
        $mail->Host = '127.0.0.1';
        $mail->Port = (int) $config['test_smtp_port'];
        $mail->SMTPSecure = '';
        $mail->SMTPAuth = false;
        $mail->SMTPAutoTLS = false;
    }
    $mail->Encoding = 'base64';
    $mail->Timeout = 10;
    $mail->CharSet = 'UTF-8';
    $mail->setFrom('anton@norma-studio.ru', 'Norma Studio');
    $mail->addAddress(RECIPIENT);
    $mail->addReplyTo($message['headers']['Reply-To']);
    $mail->Subject = SUBJECT;
    $mail->Body = base64_decode($message['body'], true);
    return $mail->send();
}
