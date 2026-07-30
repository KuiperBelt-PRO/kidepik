<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Shared\Config;
use PHPUnit\Framework\TestCase;

final class ConfigTest extends TestCase
{
    public function testDefaultsWhenEnvMissing(): void
    {
        self::assertSame('kidepik-api', Config::appName());
        self::assertSame('local', Config::appEnv());
        self::assertSame('local', Config::storageDriver());
        self::assertSame('/media', Config::mediaPublicBaseUrl());
        self::assertNotSame('', Config::publicApiUrl());
        self::assertSame(900, Config::uploadTokenTtl());
    }

    public function testRunMigrationsOnRequestLocalDefaultFalse(): void
    {
        self::assertFalse(Config::runMigrationsOnRequest());
    }
}
