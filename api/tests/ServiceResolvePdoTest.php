<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Services\CrewService;
use Kidepik\Api\Services\DatabaseService;
use Kidepik\Api\Services\ParentAccountService;
use Kidepik\Api\Services\ParentSettingsRepository;
use Kidepik\Shared\Config;
use Kidepik\Shared\Database\MigrationRunner;
use Kidepik\Shared\Database\PdoFactory;
use PDO;
use PHPUnit\Framework\TestCase;

final class ServiceResolvePdoTest extends TestCase
{
    private static ?string $originalDatabaseUrl = null;

    public static function setUpBeforeClass(): void
    {
        self::$originalDatabaseUrl = Config::databaseUrl();
    }

    public function tearDown(): void
    {
        TestDbSeeds::restorePocHealth();
        TestDbSeeds::restoreLegalDocumentsTable();
        if (self::$originalDatabaseUrl !== null && self::$originalDatabaseUrl !== '') {
            putenv('DATABASE_URL=' . self::$originalDatabaseUrl);
            $_ENV['DATABASE_URL'] = self::$originalDatabaseUrl;
        }
        PdoFactory::resetSharedForTests();
        MigrationRunner::fromEnv(dirname(__DIR__, 2))->ensureApplied();
    }

    public function testParentAccountServiceResolvePdo(): void
    {
        $url = Config::databaseUrl();
        if ($url === null) {
            self::markTestSkipped('DATABASE_URL no configurada');
        }

        $service = new ParentAccountService();
        $reflection = new \ReflectionClass($service);
        $method = $reflection->getMethod('resolvePdo');
        $method->setAccessible(true);

        $pdo = $method->invoke($service);

        self::assertInstanceOf(PDO::class, $pdo);
    }

    public function testParentSettingsRepositoryResolvePdo(): void
    {
        $url = Config::databaseUrl();
        if ($url === null) {
            self::markTestSkipped('DATABASE_URL no configurada');
        }

        $repo = new ParentSettingsRepository();
        $reflection = new \ReflectionClass($repo);
        $method = $reflection->getMethod('resolvePdo');
        $method->setAccessible(true);

        $pdo = $method->invoke($repo);

        self::assertInstanceOf(PDO::class, $pdo);
    }

    public function testCrewServiceResolvePdo(): void
    {
        $url = Config::databaseUrl();
        if ($url === null) {
            self::markTestSkipped('DATABASE_URL no configurada');
        }

        $crew = new CrewService();
        $reflection = new \ReflectionClass($crew);
        $method = $reflection->getMethod('resolvePdo');
        $method->setAccessible(true);

        $pdo = $method->invoke($crew);

        self::assertInstanceOf(PDO::class, $pdo);
    }

    public function testDatabaseServicePdoNullWithoutUrl(): void
    {
        $original = $_ENV['DATABASE_URL'] ?? getenv('DATABASE_URL');
        putenv('DATABASE_URL');
        $_ENV['DATABASE_URL'] = '';
        PdoFactory::resetSharedForTests();

        $db = new DatabaseService();
        self::assertNull($db->pdo());

        if (is_string($original) && $original !== '') {
            putenv('DATABASE_URL=' . $original);
            $_ENV['DATABASE_URL'] = $original;
        }
        PdoFactory::resetSharedForTests();
    }

    public function testDatabaseServicePocHealthHandlesMissingTable(): void
    {
        $url = Config::databaseUrl();
        if ($url === null) {
            self::markTestSkipped('DATABASE_URL no configurada');
        }

        PdoFactory::resetSharedForTests();
        $pdo = PdoFactory::fromDatabaseUrl($url);
        $pdo->exec('drop table if exists public.poc_health');

        $db = new DatabaseService();
        self::assertNull($db->pocHealthMessage());

        TestDbSeeds::restorePocHealth();
        PdoFactory::resetSharedForTests();
    }

    public function testParentAccountServiceResolvePdoFailsWithoutUrl(): void
    {
        $original = $_ENV['DATABASE_URL'] ?? getenv('DATABASE_URL');
        putenv('DATABASE_URL');
        $_ENV['DATABASE_URL'] = '';
        PdoFactory::resetSharedForTests();

        $service = new ParentAccountService();
        $reflection = new \ReflectionClass($service);
        $method = $reflection->getMethod('resolvePdo');
        $method->setAccessible(true);

        $this->expectException(\RuntimeException::class);
        $method->invoke($service);

        if (is_string($original) && $original !== '') {
            putenv('DATABASE_URL=' . $original);
            $_ENV['DATABASE_URL'] = $original;
        }
        PdoFactory::resetSharedForTests();
    }
}
