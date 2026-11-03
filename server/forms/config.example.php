<?php
// Copy OUTSIDE the web root to norma-private/forms-config.php.
// Generate the secret on the server: php -r "echo bin2hex(random_bytes(32));"
return [
    'secret' => '',
    'smtp_password' => '', // Yandex application password for anton@norma-studio.ru
    'state_file' => __DIR__ . '/forms-state.json',
    'origins' => ['https://fearhammer.github.io', 'https://norma-studio.ru', 'https://www.norma-studio.ru'],
];
