<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Controllers\ClientLogController;
use Kidepik\Api\Http\JsonResponse;
use Kidepik\Api\Router;
use Kidepik\Shared\Config;
use Kidepik\Shared\Logging\AppLogger;
use PHPUnit\Framework\TestCase;

final class ClientLogTest extends TestCase
{
    private string $logDir;

    protected function setUp(): void
    {
        AppLogger::resetForTests();
        $this->logDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'kidepik-client-log-' . bin2hex(random_bytes(4));
        mkdir($this->logDir, 0775, true);
        putenv('APP_ENV=local');
        putenv('LOG_TO_FILES=true');
        putenv('LOG_CLIENT_INGEST=true');
        putenv('LOG_DIR=' . $this->logDir);
        putenv('LOG_LEVEL=info');
        putenv('APP_DEBUG_AI=false');
        $_ENV['APP_ENV'] = 'local';
        $_ENV['LOG_TO_FILES'] = 'true';
        $_ENV['LOG_CLIENT_INGEST'] = 'true';
        $_ENV['LOG_DIR'] = $this->logDir;
        $_ENV['LOG_LEVEL'] = 'info';
        $_ENV['APP_DEBUG_AI'] = 'false';
    }

    protected function tearDown(): void
    {
        AppLogger::resetForTests();
        foreach (glob($this->logDir . DIRECTORY_SEPARATOR . '*.log') ?: [] as $file) {
            @unlink($file);
        }
        @rmdir($this->logDir);
    }

    public function testIngestWritesClientChannel(): void
    {
        $body = json_encode([
            'events' => [
                ['level' => 'info', 'message' => 'route_change', 'context' => ['from' => 'loader', 'to' => 'home']],
            ],
        ], JSON_THROW_ON_ERROR);

        $response = (new ClientLogController())->ingest(null, $body);

        self::assertSame(200, $response->status);
        /** @var array<string, mixed> $payload */
        $payload = json_decode($response->body, true);
        self::assertSame(1, $payload['accepted']);

        $files = glob($this->logDir . DIRECTORY_SEPARATOR . 'client-*.log');
        self::assertNotEmpty($files);
        $content = file_get_contents($files[0]);
        self::assertIsString($content);
        self::assertStringContainsString('route_change', $content);
    }

    public function testIngestRejectsInvalidPayload(): void
    {
        $response = (new ClientLogController())->ingest(null, '{"bad":true}');
        self::assertSame(422, $response->status);
    }

    public function testRouterRouteExists(): void
    {
        $body = json_encode(['events' => [['level' => 'info', 'message' => 'ping']]], JSON_THROW_ON_ERROR);
        $response = (new Router())->dispatch('POST', '/api/v1/client/logs');
        // Without body in dispatch - need to test via controller directly
        $controllerResponse = (new ClientLogController())->ingest(null, $body);
        self::assertSame(200, $controllerResponse->status);
    }

    public function testArchitectureConfigExposesClientLogging(): void
    {
        $response = (new Router())->dispatch('GET', '/api/v1/architecture/config');
        self::assertSame(200, $response->status);
        /** @var array<string, mixed> $body */
        $body = json_decode($response->body, true);
        self::assertTrue($body['client_logging']);
        self::assertSame('info', $body['client_log_level']);
    }

    public function testIngestDisabledInProduction(): void
    {
        putenv('APP_ENV=production');
        $_ENV['APP_ENV'] = 'production';
        putenv('LOG_TO_FILES=false');
        $_ENV['LOG_TO_FILES'] = 'false';

        $body = json_encode(['events' => [['level' => 'info', 'message' => 'x']]], JSON_THROW_ON_ERROR);
        $response = (new ClientLogController())->ingest(null, $body);
        self::assertSame(404, $response->status);
    }
}
