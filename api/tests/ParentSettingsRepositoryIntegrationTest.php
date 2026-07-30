<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Services\ParentAccountService;
use Kidepik\Api\Services\ParentSettingsRepository;
use Kidepik\Shared\Config;
use Kidepik\Shared\Database\MigrationRunner;
use Kidepik\Shared\Database\PdoFactory;
use PDO;
use PHPUnit\Framework\TestCase;
use RuntimeException;

final class ParentSettingsRepositoryIntegrationTest extends TestCase
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

    public function testRepositoryWithoutInjectedPdo(): void
    {
        $email = 'settings-repo@test.local';
        $authUserId = $this->seedAuthUser($email);
        $parents = new ParentAccountService($this->pdo);
        $parents->bootstrap($authUserId, $email);

        $repo = new ParentSettingsRepository();
        $result = $repo->getForAuthUser($authUserId, $email);

        self::assertArrayHasKey('settings', $result);
        self::assertSame(0, $result['crew_summary']['member_count']);
    }

    public function testGetMergedSettingsForParentId(): void
    {
        $email = 'settings-merged@test.local';
        $authUserId = $this->seedAuthUser($email);
        $parents = new ParentAccountService($this->pdo);
        $boot = $parents->bootstrap($authUserId, $email);

        $repo = new ParentSettingsRepository($this->pdo);
        $merged = $repo->getMergedSettingsForParentId($boot['parent_id']);

        self::assertSame('fantasy', $merged['ui_theme']);
    }

    public function testPatchUpdatesSettingsJsonStringInDb(): void
    {
        $email = 'settings-json@test.local';
        $authUserId = $this->seedAuthUser($email);
        $parents = new ParentAccountService($this->pdo);
        $parents->bootstrap($authUserId, $email);

        $this->pdo->prepare(
            'update public.parent_accounts set settings = :settings::jsonb where auth_user_id = :id',
        )->execute([
            'settings' => json_encode(['ui_theme' => 'sci-fi'], JSON_THROW_ON_ERROR),
            'id' => $authUserId,
        ]);

        $repo = new ParentSettingsRepository($this->pdo);
        $result = $repo->getForAuthUser($authUserId, $email);

        self::assertSame('sci-fi', $result['settings']['ui_theme']);
    }

    public function testCrewSummaryCountsActiveChildren(): void
    {
        $email = 'settings-crew-count@test.local';
        $authUserId = $this->seedAuthUser($email);
        $parents = new ParentAccountService($this->pdo);
        $parents->bootstrap($authUserId, $email);

        $crew = new \Kidepik\Api\Services\CrewService($this->pdo, $parents);
        $crew->createForAuthUser($authUserId, []);

        $repo = new ParentSettingsRepository($this->pdo);
        $result = $repo->getForAuthUser($authUserId, $email);

        self::assertSame(1, $result['crew_summary']['member_count']);
    }

    public function testSaveSettingsJsonThrowsForMissingParent(): void
    {
        $repo = new ParentSettingsRepository($this->pdo);
        $reflection = new \ReflectionClass($repo);
        $method = $reflection->getMethod('saveSettingsJson');
        $method->setAccessible(true);

        $this->expectException(RuntimeException::class);
        $method->invoke(
            $repo,
            '00000000-0000-4000-a000-000000000000',
            \Kidepik\Api\Services\ParentSettingsService::defaults(),
        );
    }

    public function testFetchSettingsJsonWhenRowMissing(): void
    {
        $repo = new ParentSettingsRepository($this->pdo);
        $reflection = new \ReflectionClass($repo);
        $method = $reflection->getMethod('fetchSettingsJson');
        $method->setAccessible(true);

        self::assertNull($method->invoke($repo, '00000000-0000-4000-a000-000000000000'));
    }
}
