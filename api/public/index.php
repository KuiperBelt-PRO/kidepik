<?php

declare(strict_types=1);

use Kidepik\Api\Router;
use Kidepik\Shared\Config;

require __DIR__ . '/../vendor/autoload.php';

$repoRoot = dirname(__DIR__, 2);
$envFile = $repoRoot . DIRECTORY_SEPARATOR . '.env.poc';
if (is_readable($envFile)) {
    Config::load($envFile);
} else {
    Config::load();
}

$response = (new Router())->dispatch($_SERVER['REQUEST_METHOD'] ?? 'GET', $_SERVER['REQUEST_URI'] ?? '/');

http_response_code($response->status);
foreach ($response->headers as $name => $value) {
    header($name . ': ' . $value);
}

echo $response->body;
