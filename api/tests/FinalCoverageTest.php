<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Controllers\CrewController;
use Kidepik\Api\Controllers\LegalController;
use Kidepik\Api\Services\CrewService;
use Kidepik\Api\Services\ParentAccountService;
use Kidepik\Api\Services\ParentSettingsRepository;
use Kidepik\Api\Services\SupabaseAuthService;
use Kidepik\Shared\Config;
use Kidepik\Shared\Database\PdoFactory;
use Kidepik\Api\Services\DatabaseService;
use PHPUnit\Framework\TestCase;
use RuntimeException;

final class FinalCoverageTest extends TestCase
{
    private static ?string $originalDatabaseUrl = null;

    public static function setUpBeforeClass(): void
    {
        self::$originalDatabaseUrl = Config::databaseUrl();
    }

    public function tearDown(): void
    {
        if (self::$originalDatabaseUrl !== null && self::$originalDatabaseUrl !== '') {
            putenv('DATABASE_URL=' . self::$originalDatabaseUrl);
            $_ENV['DATABASE_URL'] = self::$originalDatabaseUrl;
        }
        PdoFactory::resetSharedForTests();
        TestDbSeeds::restorePocHealth();
        TestDbSeeds::restoreLegalDocumentsTable();
    }

    public function testLegalController404WhenDocumentMissing(): void
    {
        $url = Config::databaseUrl();
        if ($url === null) {
            self::markTestSkipped('DATABASE_URL no configurada');
        }

        $pdo = PdoFactory::fromDatabaseUrl($url);
        $pdo->exec('delete from public.legal_documents where slug = \'privacy\'');

        try {
            $response = (new LegalController(new DatabaseService()))->show('privacy');
            self::assertSame(404, $response->status);
        } finally {
            TestDbSeeds::restoreLegalDocumentsTable();
            PdoFactory::resetSharedForTests();
        }
    }

    public function testDatabaseServicePdoCatchOnBadConnection(): void
    {
        $original = Config::databaseUrl();
        putenv('DATABASE_URL=postgres://127.0.0.1:9/invalid');
        $_ENV['DATABASE_URL'] = 'postgres://127.0.0.1:9/invalid';
        PdoFactory::resetSharedForTests();

        $db = new DatabaseService();
        self::assertNull($db->pdo());

        if ($original !== null && $original !== '') {
            putenv('DATABASE_URL=' . $original);
            $_ENV['DATABASE_URL'] = $original;
        }
        PdoFactory::resetSharedForTests();
    }

    public function testParentSettingsRepositoryResolvePdoDatabaseUnavailable(): void
    {
        $original = Config::databaseUrl();
        putenv('DATABASE_URL');
        $_ENV['DATABASE_URL'] = '';
        PdoFactory::resetSharedForTests();

        $repo = new ParentSettingsRepository();
        $reflection = new \ReflectionClass($repo);
        $method = $reflection->getMethod('resolvePdo');
        $method->setAccessible(true);

        $this->expectException(RuntimeException::class);
        $method->invoke($repo);

        if ($original !== null && $original !== '') {
            putenv('DATABASE_URL=' . $original);
            $_ENV['DATABASE_URL'] = $original;
        }
        PdoFactory::resetSharedForTests();
    }

    public function testCrewControllerShowMapsUnexpectedRuntimeExceptionTo500(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willReturn([
            'sub' => '11111111-1111-1111-1111-111111111111',
            'email' => 'a@b.com',
        ]);
        $parents = $this->createMock(ParentAccountService::class);
        $parents->method('getOrBootstrap')->willReturn([
            'parent_id' => '22222222-2222-2222-2222-222222222222',
            'auth_user_id' => '11111111-1111-1111-1111-111111111111',
            'email' => 'a@b.com',
            'display_name' => null,
            'avatar_url' => null,
            'provider' => 'google',
        ]);
        $crew = $this->createMock(CrewService::class);
        $crew->method('getForAuthUser')->willThrowException(new RuntimeException('db exploded'));

        $response = (new CrewController($auth, $crew, $parents))->show('Bearer t', 'child');

        self::assertSame(500, $response->status);
    }
}
