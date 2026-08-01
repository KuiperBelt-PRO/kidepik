<?php

declare(strict_types=1);

use Kidepik\Api\Http\JsonResponse;
use Kidepik\Api\Router;
use Kidepik\Shared\Config;
use Kidepik\Shared\Ai\FreeModelQueueSync;
use Kidepik\Shared\Database\MigrationException;
use Kidepik\Shared\Database\MigrationRunner;
use Kidepik\Shared\Logging\AppLogger;

require __DIR__ . '/../vendor/autoload.php';

$repoRoot = dirname(__DIR__, 2);
$envFile = $repoRoot . DIRECTORY_SEPARATOR . '.env.poc';
if (is_readable($envFile)) {
    Config::load($envFile);
} else {
    Config::load();
}

$requestStart = hrtime(true);
$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$requestPath = parse_url($requestUri, PHP_URL_PATH) ?? '/';
$apiLogger = AppLogger::channel('api');

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
    $apiLogger->error('migration_failed', [
        'path' => $requestPath,
        'version' => $e->version,
        'message' => $e->getMessage(),
    ]);
    http_response_code($response->status);
    foreach ($response->headers as $name => $value) {
        header($name . ': ' . $value);
    }
    echo $response->body;
    exit;
}

try {
    (new FreeModelQueueSync())->syncIfStale();
} catch (\Throwable) {
    // Discovery no debe tumbar requests API.
}

$response = (new Router())->dispatch($requestMethod, $requestUri);

$durationMs = (int) round((hrtime(true) - $requestStart) / 1_000_000);
$logLevel = $response->status >= 500 ? 'error' : ($response->status >= 400 ? 'warning' : 'info');
$apiLogger->{$logLevel}('http_request', [
    'method' => $requestMethod,
    'path' => $requestPath,
    'status' => $response->status,
    'duration_ms' => $durationMs,
    'debug_ai_header' => ($_SERVER['HTTP_X_KIDEPIK_DEBUG_AI'] ?? '') === '1',
]);

http_response_code($response->status);
foreach ($response->headers as $name => $value) {
    header($name . ': ' . $value);
}

echo $response->body;
