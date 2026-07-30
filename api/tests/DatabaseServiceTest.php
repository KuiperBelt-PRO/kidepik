<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Services\DatabaseService;
use Kidepik\Shared\Config;
use Kidepik\Shared\Database\MigrationRunner;
use Kidepik\Shared\Database\PdoFactory;
use PHPUnit\Framework\TestCase;

final class DatabaseServiceTest extends TestCase
{
    public function testPocHealthAndLegalLatest(): void
    {
        $url = Config::databaseUrl();
        if ($url === null) {
            self::markTestSkipped('DATABASE_URL no configurada');
        }

        MigrationRunner::fromEnv(dirname(__DIR__, 2))->ensureApplied();

        $db = new DatabaseService();
        self::assertTrue($db->isReachable());
        self::assertNotNull($db->pocHealthMessage());

        $terms = $db->latestLegalDocument('terms');
        self::assertNotNull($terms);
        self::assertArrayHasKey('body_markdown', $terms);
    }
}
