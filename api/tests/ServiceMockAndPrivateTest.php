<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use InvalidArgumentException;
use Kidepik\Api\Services\CrewService;
use Kidepik\Api\Services\ParentAccountService;
use Kidepik\Api\Services\ParentSettingsRepository;
use PHPUnit\Framework\TestCase;
use PDO;
use PDOStatement;
use RuntimeException;

final class ServiceMockAndPrivateTest extends TestCase
{
    public function testParentAccountDeleteIgnoresAuthUsersFailure(): void
    {
        $deleteParent = $this->createMock(PDOStatement::class);
        $deleteParent->method('execute')->willReturn(true);

        $deleteAuth = $this->createMock(PDOStatement::class);
        $deleteAuth->method('execute')->willThrowException(new \PDOException('denied'));

        $pdo = $this->createMock(PDO::class);
        $pdo->method('prepare')->willReturnOnConsecutiveCalls($deleteParent, $deleteAuth);

        $service = new ParentAccountService($pdo);

        self::assertTrue($service->deleteAccount('11111111-1111-1111-1111-111111111111'));
    }

    public function testBootstrapRecoversWhenInsertReturnsNoRow(): void
    {
        $findStmt = $this->createMock(PDOStatement::class);
        $findStmt->method('execute')->willReturn(true);
        $findStmt->method('fetch')->willReturnOnConsecutiveCalls(
            false,
            [
                'id' => '22222222-2222-2222-2222-222222222222',
                'auth_user_id' => '11111111-1111-1111-1111-111111111111',
                'email' => 'a@b.com',
                'display_name' => null,
                'avatar_url' => null,
            ],
        );

        $insertStmt = $this->createMock(PDOStatement::class);
        $insertStmt->method('execute')->willReturn(true);
        $insertStmt->method('fetch')->willReturn(false);

        $pdo = $this->createMock(PDO::class);
        $pdo->method('prepare')->willReturnOnConsecutiveCalls($findStmt, $insertStmt, $findStmt);

        $service = new ParentAccountService($pdo);
        $result = $service->bootstrap('11111111-1111-1111-1111-111111111111', 'a@b.com');

        self::assertFalse($result['created']);
        self::assertSame('22222222-2222-2222-2222-222222222222', $result['parent_id']);
    }

    public function testBootstrapFailsWhenInsertAndReloadBothFail(): void
    {
        $findStmt = $this->createMock(PDOStatement::class);
        $findStmt->method('execute')->willReturn(true);
        $findStmt->method('fetch')->willReturn(false);

        $insertStmt = $this->createMock(PDOStatement::class);
        $insertStmt->method('execute')->willReturn(true);
        $insertStmt->method('fetch')->willReturn(false);

        $pdo = $this->createMock(PDO::class);
        $pdo->method('prepare')->willReturnOnConsecutiveCalls($findStmt, $insertStmt, $findStmt);

        $service = new ParentAccountService($pdo);

        $this->expectException(RuntimeException::class);
        $service->bootstrap('11111111-1111-1111-1111-111111111111', 'a@b.com');
    }

    public function testGetOrBootstrapFailsWhenLoadMissing(): void
    {
        $findStmt = $this->createMock(PDOStatement::class);
        $findStmt->method('execute')->willReturn(true);
        $findStmt->method('fetch')->willReturnOnConsecutiveCalls(
            false,
            ['id' => '22222222-2222-2222-2222-222222222222'],
            false,
        );

        $insertStmt = $this->createMock(PDOStatement::class);
        $insertStmt->method('execute')->willReturn(true);
        $insertStmt->method('fetch')->willReturn(['id' => '22222222-2222-2222-2222-222222222222']);

        $pdo = $this->createMock(PDO::class);
        $pdo->method('prepare')->willReturnOnConsecutiveCalls($findStmt, $insertStmt, $findStmt);

        $service = new ParentAccountService($pdo);

        $this->expectException(RuntimeException::class);
        $service->getOrBootstrap('11111111-1111-1111-1111-111111111111', 'a@b.com');
    }

    public function testCrewServicePrivateBoolAndJsonHelpers(): void
    {
        $crew = new CrewService();
        $ref = new \ReflectionClass($crew);

        $toBool = $ref->getMethod('toBool');
        $toBool->setAccessible(true);
        self::assertTrue($toBool->invoke($crew, true));
        self::assertTrue($toBool->invoke($crew, 't'));
        self::assertTrue($toBool->invoke($crew, 'true'));
        self::assertTrue($toBool->invoke($crew, '1'));
        self::assertTrue($toBool->invoke($crew, 1));
        self::assertFalse($toBool->invoke($crew, 'f'));

        $pgBool = $ref->getMethod('pgBool');
        $pgBool->setAccessible(true);
        self::assertSame('true', $pgBool->invoke(null, true));
        self::assertSame('false', $pgBool->invoke(null, false));

        $decodeJson = $ref->getMethod('decodeJson');
        $decodeJson->setAccessible(true);
        self::assertSame(['a' => 1], $decodeJson->invoke($crew, '{"a":1}'));
        self::assertNull($decodeJson->invoke($crew, ''));
        self::assertNull($decodeJson->invoke($crew, 'not-json'));
        self::assertSame(['x' => 1], $decodeJson->invoke($crew, ['x' => 1]));

        $normalizeTutor = $ref->getMethod('normalizeTutorLabel');
        $normalizeTutor->setAccessible(true);
        self::assertNull($normalizeTutor->invoke($crew, null));
        self::assertSame('Kid', $normalizeTutor->invoke($crew, ' Kid '));

        $normalizeDisplay = $ref->getMethod('normalizeDisplayName');
        $normalizeDisplay->setAccessible(true);
        self::assertNull($normalizeDisplay->invoke($crew, null));
        self::assertSame('Ada', $normalizeDisplay->invoke($crew, ' Ada '));

        $this->expectException(InvalidArgumentException::class);
        $normalizeTutor->invoke($crew, 123);
    }

    public function testParentSettingsFetchSettingsWithArrayColumn(): void
    {
        $stmt = $this->createMock(PDOStatement::class);
        $stmt->method('execute')->willReturn(true);
        $stmt->method('fetch')->willReturn(['settings' => ['ui_theme' => 'sci-fi']]);

        $pdo = $this->createMock(PDO::class);
        $pdo->method('prepare')->willReturn($stmt);

        $repo = new ParentSettingsRepository($pdo);
        $ref = new \ReflectionClass($repo);
        $method = $ref->getMethod('fetchSettingsJson');
        $method->setAccessible(true);

        $result = $method->invoke($repo, 'parent-id');

        self::assertSame('sci-fi', $result['ui_theme']);
    }

    public function testParentSettingsCountActiveChildrenOnFailureReturnsZero(): void
    {
        $pdo = $this->createMock(PDO::class);
        $pdo->method('prepare')->willThrowException(new \PDOException('fail'));

        $repo = new ParentSettingsRepository($pdo);
        $ref = new \ReflectionClass($repo);
        $method = $ref->getMethod('countActiveChildren');
        $method->setAccessible(true);

        self::assertSame(0, $method->invoke($repo, 'parent-id'));
    }

    public function testFindByAuthUserIdRejectsIncompleteRow(): void
    {
        $stmt = $this->createMock(PDOStatement::class);
        $stmt->method('execute')->willReturn(true);
        $stmt->method('fetch')->willReturn(['id' => 'only-id']);

        $pdo = $this->createMock(PDO::class);
        $pdo->method('prepare')->willReturn($stmt);

        $service = new ParentAccountService($pdo);

        self::assertNull($service->findByAuthUserId('11111111-1111-1111-1111-111111111111'));
    }
}
