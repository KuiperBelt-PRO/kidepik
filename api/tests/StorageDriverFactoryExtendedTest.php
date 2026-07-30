<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Shared\Config;
use Kidepik\Shared\Storage\StorageDriverFactory;
use PHPUnit\Framework\Attributes\RunInSeparateProcess;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\TestCase;

final class StorageDriverFactoryExtendedTest extends TestCase
{
    private static ?string $originalDriver = null;

    public static function setUpBeforeClass(): void
    {
        self::$originalDriver = $_ENV['STORAGE_DRIVER'] ?? getenv('STORAGE_DRIVER') ?: 'local';
    }

    public function tearDown(): void
    {
        if (self::$originalDriver !== null) {
            putenv('STORAGE_DRIVER=' . self::$originalDriver);
            $_ENV['STORAGE_DRIVER'] = self::$originalDriver;
        }
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testUnsupportedDriverThrows(): void
    {
        putenv('STORAGE_DRIVER=s3');
        $_ENV['STORAGE_DRIVER'] = 's3';

        $this->expectException(\RuntimeException::class);
        StorageDriverFactory::create();
    }

    public function testCreateUsesConfiguredMediaRoot(): void
    {
        $driver = StorageDriverFactory::create();
        $status = $driver->status();

        self::assertSame(Config::mediaRoot(), $status['root']);
    }
}
