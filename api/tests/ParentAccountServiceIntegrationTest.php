<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use InvalidArgumentException;
use Kidepik\Api\Services\ParentAccountService;
use Kidepik\Shared\Config;
use Kidepik\Shared\Database\MigrationRunner;
use Kidepik\Shared\Database\PdoFactory;
use PDO;
use PHPUnit\Framework\TestCase;
use RuntimeException;

final class ParentAccountServiceIntegrationTest extends TestCase
{
    private ?PDO $pdo = null;

    /** @var list<string> */
    private array $authUserIds = [];

    protected function setUp(): void
    {
        $url = Config::databaseUrl();
        if ($url === null) {
            self::markTestSkipped('DATABASE_URL no configurada');
        }

        try {
            $this->pdo = PdoFactory::fromDatabaseUrl($url);
        } catch (\PDOException $e) {
            self::markTestSkipped('Postgres no alcanzable: ' . $e->getMessage());
        }

        MigrationRunner::fromEnv(dirname(__DIR__, 2))->ensureApplied();
    }

    protected function tearDown(): void
    {
        if ($this->pdo === null) {
            return;
        }

        foreach ($this->authUserIds as $authUserId) {
            $this->pdo->prepare('delete from public.parent_accounts where auth_user_id = :id')
                ->execute(['id' => $authUserId]);
            $this->pdo->prepare('delete from auth.users where id = :id')
                ->execute(['id' => $authUserId]);
        }
        $this->authUserIds = [];
    }

    private function seedAuthUser(string $email): string
    {
        $authUserId = bin2hex(random_bytes(16));
        $authUserId = substr($authUserId, 0, 8) . '-' . substr($authUserId, 8, 4) . '-4' . substr($authUserId, 12, 3)
            . '-a' . substr($authUserId, 15, 3) . '-' . substr($authUserId, 18, 12);

        $this->pdo->prepare(
            'insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
             values (:id, :email, crypt(:pwd, gen_salt(\'bf\')), now(), now(), now())',
        )->execute([
            'id' => $authUserId,
            'email' => $email,
            'pwd' => 'test-password-123',
        ]);
        $this->authUserIds[] = $authUserId;

        return $authUserId;
    }

    public function testBootstrapIdempotentSecondCall(): void
    {
        $email = 'bootstrap-idempotent@test.local';
        $authUserId = $this->seedAuthUser($email);
        $service = new ParentAccountService($this->pdo);

        $first = $service->bootstrap($authUserId, $email, 'Ada', null);
        $second = $service->bootstrap($authUserId, $email, 'Ada', null);

        self::assertTrue($first['created']);
        self::assertFalse($second['created']);
        self::assertSame($first['parent_id'], $second['parent_id']);
    }

    public function testNormalizeDisplayNameNullAndEmpty(): void
    {
        self::assertNull(ParentAccountService::normalizeDisplayName(null));
        self::assertNull(ParentAccountService::normalizeDisplayName('   '));
    }

    public function testNormalizeDisplayNameTooLong(): void
    {
        $this->expectException(InvalidArgumentException::class);
        ParentAccountService::normalizeDisplayName(str_repeat('a', 41));
    }

    public function testUpdateDisplayNameClearsValue(): void
    {
        $email = 'display-clear@test.local';
        $authUserId = $this->seedAuthUser($email);
        $service = new ParentAccountService($this->pdo);
        $service->bootstrap($authUserId, $email, 'Ada', null);

        $updated = $service->updateDisplayName($authUserId, null);

        self::assertNull($updated['display_name']);
    }

    public function testUpdateDisplayNameNotFound(): void
    {
        $service = new ParentAccountService($this->pdo);

        $this->expectException(RuntimeException::class);
        $service->updateDisplayName('00000000-0000-4000-a000-000000000000', 'Ada');
    }

    public function testServiceWithoutInjectedPdo(): void
    {
        $email = 'no-inject-pdo@test.local';
        $authUserId = $this->seedAuthUser($email);
        $service = new ParentAccountService();

        $boot = $service->bootstrap($authUserId, $email, 'Tester', null);
        $row = $service->findByAuthUserId($authUserId);

        self::assertTrue($boot['created']);
        self::assertNotNull($row);
        self::assertSame($boot['parent_id'], $row['parent_id']);
    }

    public function testDeleteAccountRemovesParentRow(): void
    {
        $email = 'delete-account@test.local';
        $authUserId = $this->seedAuthUser($email);
        $service = new ParentAccountService($this->pdo);
        $service->bootstrap($authUserId, $email);

        self::assertTrue($service->deleteAccount($authUserId));
        self::assertNull($service->findByAuthUserId($authUserId));
    }

    public function testBootstrapAfterManualInsertReturnsNotCreated(): void
    {
        $email = 'bootstrap-manual@test.local';
        $authUserId = $this->seedAuthUser($email);

        $this->pdo->prepare(
            'insert into public.parent_accounts (auth_user_id, email) values (:id, :email)',
        )->execute(['id' => $authUserId, 'email' => $email]);

        $service = new ParentAccountService($this->pdo);
        $result = $service->bootstrap($authUserId, $email);

        self::assertFalse($result['created']);
        self::assertSame($authUserId, $result['auth_user_id']);
    }
}
