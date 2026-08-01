<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Shared\Config;
use Kidepik\Shared\Logging\AppLogger;
use Kidepik\Shared\Logging\LogLevel;
use PHPUnit\Framework\TestCase;

final class AppLoggerTest extends TestCase
{
    private string $logDir;

    protected function setUp(): void
    {
        AppLogger::resetForTests();
        $this->logDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'kidepik-log-test-' . bin2hex(random_bytes(4));
        mkdir($this->logDir, 0775, true);
        putenv('APP_ENV=local');
        putenv('LOG_TO_FILES=true');
        putenv('LOG_DIR=' . $this->logDir);
        putenv('LOG_LEVEL=info');
        putenv('APP_DEBUG_AI=false');
        $_ENV['APP_ENV'] = 'local';
        $_ENV['LOG_TO_FILES'] = 'true';
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

    public function testWritesInfoWhenLevelAllows(): void
    {
        AppLogger::channel('api')->info('hello', ['n' => 1]);
        $files = glob($this->logDir . DIRECTORY_SEPARATOR . 'api-*.log');
        self::assertNotEmpty($files);
        $content = file_get_contents($files[0]);
        self::assertIsString($content);
        self::assertStringContainsString('hello', $content);
        self::assertStringContainsString('"level":"info"', $content);
    }

    public function testSkipsDebugUnlessDebugAi(): void
    {
        AppLogger::channel('ai')->debug('hidden');
        self::assertSame([], glob($this->logDir . DIRECTORY_SEPARATOR . 'ai-*.log') ?: []);

        $_ENV['APP_DEBUG_AI'] = 'true';
        putenv('APP_DEBUG_AI=true');
        AppLogger::resetForTests();
        AppLogger::channel('ai')->debug('visible');
        $files = glob($this->logDir . DIRECTORY_SEPARATOR . 'ai-*.log');
        self::assertNotEmpty($files);
        $content = file_get_contents($files[0]);
        self::assertIsString($content);
        self::assertStringContainsString('visible', $content);
    }

    public function testRedactsSensitiveContext(): void
    {
        AppLogger::channel('api')->warning('auth', ['authorization' => 'Bearer secret-token']);
        $files = glob($this->logDir . DIRECTORY_SEPARATOR . 'api-*.log');
        self::assertNotEmpty($files);
        $content = file_get_contents($files[0]);
        self::assertIsString($content);
        self::assertStringContainsString('[redacted]', $content);
        self::assertStringNotContainsString('secret-token', $content);
    }

    public function testLogLevelNormalize(): void
    {
        self::assertSame('info', LogLevel::normalize('INFO'));
        self::assertSame('info', LogLevel::normalize('unknown'));
    }
}
