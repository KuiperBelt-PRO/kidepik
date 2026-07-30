<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Controllers\CrewController;
use Kidepik\Api\Controllers\ParentSettingsController;
use Kidepik\Api\Controllers\ParentsController;
use Kidepik\Api\Router;
use Kidepik\Api\Services\CrewService;
use Kidepik\Api\Services\ParentAccountService;
use Kidepik\Api\Services\ParentSettingsRepository;
use Kidepik\Api\Services\SupabaseAuthService;
use Kidepik\Shared\Config;
use Kidepik\Shared\Database\MigrationRunner;
use Kidepik\Shared\Database\PdoFactory;
use Kidepik\Shared\Storage\LocalFilesystemDriver;
use Kidepik\Shared\Storage\UploadTokenStore;
use PDO;
use PHPUnit\Framework\TestCase;

/**
 * Flujos de producto contra Postgres local (Supabase).
 */
final class ProductIntegrationTest extends TestCase
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

        $repoRoot = dirname(__DIR__, 2);
        MigrationRunner::fromEnv($repoRoot)->ensureApplied();
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

  private function seedAuthUser(string $email = 'integration@test.local'): string
    {
        $authUserId = bin2hex(random_bytes(16));
        $authUserId = substr($authUserId, 0, 8) . '-' . substr($authUserId, 8, 4) . '-4' . substr($authUserId, 12, 3)
            . '-a' . substr($authUserId, 15, 3) . '-' . substr($authUserId, 18, 12);

        $stmt = $this->pdo->prepare(
            'insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
             values (:id, :email, crypt(:pwd, gen_salt(\'bf\')), now(), now(), now())
             on conflict (id) do nothing',
        );
        $stmt->execute([
            'id' => $authUserId,
            'email' => $email,
            'pwd' => 'test-password-123',
        ]);

        $this->authUserIds[] = $authUserId;

        return $authUserId;
    }

    private function mockAuth(string $authUserId, string $email): SupabaseAuthService
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willReturn([
            'sub' => $authUserId,
            'role' => 'authenticated',
            'email' => $email,
            'display_name' => 'Integration User',
            'avatar_url' => null,
        ]);

        return $auth;
    }

    public function testParentBootstrapAndMeLifecycle(): void
    {
        $authUserId = $this->seedAuthUser();
        $email = 'parent-lifecycle@test.local';
        $auth = $this->mockAuth($authUserId, $email);
        $parents = new ParentAccountService($this->pdo);

        $bootstrap = (new ParentsController($auth, $parents))->bootstrap('Bearer t');
        self::assertSame(200, $bootstrap->status);
        $bootBody = json_decode($bootstrap->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($bootBody['created']);

        $me = (new ParentsController($auth, $parents))->me('Bearer t');
        self::assertSame(200, $me->status);

        $patch = (new ParentsController($auth, $parents))->updateMe(
            'Bearer t',
            json_encode(['display_name' => 'Ada Lovelace'], JSON_THROW_ON_ERROR),
        );
        self::assertSame(200, $patch->status);
        $patchBody = json_decode($patch->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('Ada Lovelace', $patchBody['display_name']);

        $delete = (new ParentsController($auth, $parents))->deleteMe('Bearer t');
        self::assertSame(200, $delete->status);
    }

    public function testParentSettingsGetAndPatch(): void
    {
        $authUserId = $this->seedAuthUser('settings@test.local');
        $auth = $this->mockAuth($authUserId, 'settings@test.local');
        $parents = new ParentAccountService($this->pdo);
        $parents->bootstrap($authUserId, 'settings@test.local');

        $settingsRepo = new ParentSettingsRepository($this->pdo);
        $controller = new ParentSettingsController($auth, $settingsRepo);

        $get = $controller->show('Bearer t');
        self::assertSame(200, $get->status);
        $getBody = json_decode($get->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('fantasy', $getBody['settings']['ui_theme']);

        $patch = $controller->update(
            'Bearer t',
            json_encode(['ui_theme' => 'sci-fi', 'font_scale_ui' => 'lg'], JSON_THROW_ON_ERROR),
        );
        self::assertSame(200, $patch->status);
        $patchBody = json_decode($patch->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('sci-fi', $patchBody['settings']['ui_theme']);
        self::assertSame('lg', $patchBody['settings']['font_scale_ui']);
    }

    public function testCrewCreateListAndDelete(): void
    {
        $authUserId = $this->seedAuthUser('crew@test.local');
        $email = 'crew@test.local';
        $auth = $this->mockAuth($authUserId, $email);
        $parents = new ParentAccountService($this->pdo);
        $parents->bootstrap($authUserId, $email);
        $crew = new CrewService($this->pdo, $parents);
        $controller = new CrewController($auth, $crew, $parents);

        $create = $controller->create('Bearer t', json_encode(['tutor_label' => 'Kid A'], JSON_THROW_ON_ERROR));
        self::assertSame(201, $create->status);
        $created = json_decode($create->body, true, 512, JSON_THROW_ON_ERROR);
        $childId = (string) $created['id'];

        $list = $controller->index('Bearer t');
        self::assertSame(200, $list->status);
        $listBody = json_decode($list->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertSame(1, $listBody['member_count']);

        $show = $controller->show('Bearer t', $childId);
        self::assertSame(200, $show->status);

        $destroy = $controller->destroy(
            'Bearer t',
            $childId,
            json_encode(['confirm' => true], JSON_THROW_ON_ERROR),
        );
        self::assertSame(200, $destroy->status);
    }

    public function testCrewTutorProfileAutoCreatedAndCannotDelete(): void
    {
        $authUserId = $this->seedAuthUser('crew-tutor@test.local');
        $email = 'crew-tutor@test.local';
        $auth = $this->mockAuth($authUserId, $email);
        $parents = new ParentAccountService($this->pdo);
        $parents->bootstrap($authUserId, $email);
        $crew = new CrewService($this->pdo, $parents);
        $controller = new CrewController($auth, $crew, $parents);

        $list = $controller->index('Bearer t');
        self::assertSame(200, $list->status);
        $listBody = json_decode($list->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($listBody['has_tutor_profile']);
        self::assertSame(0, $listBody['member_count']);

        $tutor = null;
        foreach ($listBody['members'] as $member) {
            if (!empty($member['is_tutor_profile'])) {
                $tutor = $member;
                break;
            }
        }
        self::assertIsArray($tutor);

        $destroy = $controller->destroy(
            'Bearer t',
            (string) $tutor['id'],
            json_encode(['confirm' => true], JSON_THROW_ON_ERROR),
        );
        self::assertSame(422, $destroy->status);
    }

    public function testCrewPatchAndPermissions(): void
    {
        $authUserId = $this->seedAuthUser('crew-patch@test.local');
        $email = 'crew-patch@test.local';
        $auth = $this->mockAuth($authUserId, $email);
        $parents = new ParentAccountService($this->pdo);
        $parents->bootstrap($authUserId, $email);
        $crew = new CrewService($this->pdo, $parents);
        $controller = new CrewController($auth, $crew, $parents);

        $create = $controller->create('Bearer t', '{}');
        $childId = (string) json_decode($create->body, true, 512, JSON_THROW_ON_ERROR)['id'];

        $patch = $controller->update(
            'Bearer t',
            $childId,
            json_encode(['tutor_label' => 'Explorer'], JSON_THROW_ON_ERROR),
        );
        self::assertSame(200, $patch->status);

        $perms = $controller->updatePermissions(
            'Bearer t',
            $childId,
            json_encode(['require_exit_pin' => true], JSON_THROW_ON_ERROR),
        );
        self::assertSame(200, $perms->status);
        $permBody = json_decode($perms->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($permBody['permissions']['require_exit_pin']);
    }

    public function testCrewMemberLimitReached(): void
    {
        $authUserId = $this->seedAuthUser('crew-limit@test.local');
        $email = 'crew-limit@test.local';
        $auth = $this->mockAuth($authUserId, $email);
        $parents = new ParentAccountService($this->pdo);
        $parents->bootstrap($authUserId, $email);
        $crew = new CrewService($this->pdo, $parents);
        $controller = new CrewController($auth, $crew, $parents);

        for ($i = 0; $i < CrewService::MEMBER_LIMIT; $i++) {
            $res = $controller->create('Bearer t', '{}');
            self::assertSame(201, $res->status);
        }

        $overflow = $controller->create('Bearer t', '{}');
        self::assertSame(422, $overflow->status);
    }

    public function testCrewUpdateProfileFields(): void
    {
        $authUserId = $this->seedAuthUser('crew-profile@test.local');
        $email = 'crew-profile@test.local';
        $auth = $this->mockAuth($authUserId, $email);
        $parents = new ParentAccountService($this->pdo);
        $parents->bootstrap($authUserId, $email);
        $crew = new CrewService($this->pdo, $parents);
        $controller = new CrewController($auth, $crew, $parents);

        $create = $controller->create('Bearer t', '{}');
        $childId = (string) json_decode($create->body, true, 512, JSON_THROW_ON_ERROR)['id'];

        $patch = $controller->update(
            'Bearer t',
            $childId,
            json_encode([
                'display_name' => 'Explorer',
                'age_years' => 8,
                'status' => 'paused',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertSame(200, $patch->status);
        $body = json_decode($patch->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('Explorer', $body['display_name']);
        self::assertSame(8, $body['age_years']);
        self::assertSame('paused', $body['status']);
    }

    public function testCrewPermissionsFullPatch(): void
    {
        $authUserId = $this->seedAuthUser('crew-perms@test.local');
        $email = 'crew-perms@test.local';
        $auth = $this->mockAuth($authUserId, $email);
        $parents = new ParentAccountService($this->pdo);
        $parents->bootstrap($authUserId, $email);
        $crew = new CrewService($this->pdo, $parents);
        $controller = new CrewController($auth, $crew, $parents);

        $create = $controller->create('Bearer t', '{}');
        $childId = (string) json_decode($create->body, true, 512, JSON_THROW_ON_ERROR)['id'];

        $perms = $controller->updatePermissions(
            'Bearer t',
            $childId,
            json_encode([
                'allow_solo_start' => false,
                'require_exit_pin' => true,
                'session_limit_per_day' => 2,
                'max_session_minutes' => 15,
                'font_scale_play' => 'lg',
                'exit_pin' => '1234',
            ], JSON_THROW_ON_ERROR),
        );
        self::assertSame(200, $perms->status);
    }

    public function testCrewDeleteRequiresConfirm(): void
    {
        $authUserId = $this->seedAuthUser('crew-del@test.local');
        $email = 'crew-del@test.local';
        $auth = $this->mockAuth($authUserId, $email);
        $parents = new ParentAccountService($this->pdo);
        $parents->bootstrap($authUserId, $email);
        $crew = new CrewService($this->pdo, $parents);
        $controller = new CrewController($auth, $crew, $parents);
        $create = $controller->create('Bearer t', '{}');
        $childId = (string) json_decode($create->body, true, 512, JSON_THROW_ON_ERROR)['id'];

        $bad = $controller->destroy('Bearer t', $childId, '{}');
        self::assertSame(422, $bad->status);
    }

    public function testStorageUploadCompleteFlow(): void
    {
        $root = sys_get_temp_dir() . '/kidepik-upload-' . bin2hex(random_bytes(4));
        mkdir($root, 0775, true);
        $tokens = new UploadTokenStore($root . '/.tokens');
        $driver = new LocalFilesystemDriver($root, '/media', $tokens);
        $plan = $driver->prepareUpload('user-1', 'doc.txt', 'poc');
        $tmp = $root . '/tmp.txt';
        file_put_contents($tmp, 'upload-body');
        $url = $driver->completeUpload($plan->token, $tmp);
        self::assertStringContainsString('/media/poc/user-1/', $url);
        $this->removeDir($root);
    }

    private function removeDir(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        foreach (scandir($dir) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            $path = $dir . DIRECTORY_SEPARATOR . $entry;
            is_dir($path) ? $this->removeDir($path) : unlink($path);
        }
        rmdir($dir);
    }

    public function testStoragePrepareUploadViaRouter(): void
    {
        $authUserId = $this->seedAuthUser('storage@test.local');
        $auth = $this->mockAuth($authUserId, 'storage@test.local');
        $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer t';

        $parents = new ParentAccountService($this->pdo);
        $controller = new \Kidepik\Api\Controllers\StorageController($auth);

        $response = $controller->prepareUpload(
            'Bearer t',
            json_encode(['filename' => 'pic.png', 'category' => 'poc'], JSON_THROW_ON_ERROR),
        );
        self::assertSame(200, $response->status);
        unset($_SERVER['HTTP_AUTHORIZATION']);
    }

    public function testHealthEndpoint(): void
    {
        $response = (new Router())->dispatch('GET', '/api/v1/health');
        self::assertSame(200, $response->status);
        $body = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('ok', $body['status']);
    }
}
