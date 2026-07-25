<?php

declare(strict_types=1);

use Kidepik\Api\Http\JsonResponse;
use Kidepik\Api\Router;
use Kidepik\Shared\Config;
use Kidepik\Shared\Database\MigrationException;
use Kidepik\Shared\Database\MigrationRunner;

require __DIR__ . '/../vendor/autoload.php';

$repoRoot = dirname(__DIR__, 2);
$envFile = $repoRoot . DIRECTORY_SEPARATOR . '.env.poc';
if (is_readable($envFile)) {
    Config::load($envFile);
} else {
    Config::load();
}

try {
    if (Config::runMigrationsOnRequest()) {
        MigrationRunner::fromEnv($repoRoot)->ensureApplied();
    }
} catch (MigrationException $e) {
    $payload = ['detail' => 'Migration failed'];
    if ($e->version !== null) {
        $payload['version'] = $e->version;
    }
    $response = JsonResponse::ok($payload, 503);
    http_response_code($response->status);
    foreach ($response->headers as $name => $value) {
        header($name . ': ' . $value);
    }
    echo $response->body;
    exit;
}

$response = (new Router())->dispatch($_SERVER['REQUEST_METHOD'] ?? 'GET', $_SERVER['REQUEST_URI'] ?? '/');

http_response_code($response->status);
foreach ($response->headers as $name => $value) {
    header($name . ': ' . $value);
}

echo $response->body;
