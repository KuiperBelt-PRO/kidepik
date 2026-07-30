<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use InvalidArgumentException;
use Kidepik\Api\Controllers\CrewController;
use Kidepik\Api\Controllers\ParentSettingsController;
use Kidepik\Api\Controllers\ParentsController;
use Kidepik\Api\Controllers\StorageController;
use Kidepik\Api\Services\AuthException;
use Kidepik\Api\Services\CrewService;
use Kidepik\Api\Services\ParentAccountService;
use Kidepik\Api\Services\ParentSettingsRepository;
use Kidepik\Api\Services\SupabaseAuthService;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/**
 * Ramas de error y validación en controladores (mocks, sin Postgres).
 */
final class ControllersCoverageTest extends TestCase
{
  private function authMock(array $claims = []): SupabaseAuthService
    {
        $defaults = [
            'sub' => '11111111-1111-1111-1111-111111111111',
            'role' => 'authenticated',
            'email' => 'padre@ejemplo.com',
            'display_name' => 'Padre',
            'avatar_url' => null,
        ];

        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willReturn(array_merge($defaults, $claims));

        return $auth;
    }

    private function parentsBootstrapMock(): ParentAccountService
    {
        $parents = $this->createMock(ParentAccountService::class);
        $parents->method('getOrBootstrap')->willReturn([
            'parent_id' => '22222222-2222-2222-2222-222222222222',
            'auth_user_id' => '11111111-1111-1111-1111-111111111111',
            'email' => 'padre@ejemplo.com',
            'display_name' => 'Padre',
            'avatar_url' => null,
            'provider' => 'google',
        ]);

        return $parents;
    }

    public function testCrewIndexAuthFailure(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willThrowException(new AuthException('Missing Bearer token'));

        $response = (new CrewController($auth))->index('bad');

        self::assertSame(401, $response->status);
    }

    public function testCrewEmailRequired(): void
    {
        $response = (new CrewController($this->authMock(['email' => '']), $this->createMock(CrewService::class), $this->parentsBootstrapMock()))
            ->index('Bearer t');

        self::assertSame(422, $response->status);
    }

    public function testCrewDatabaseUnavailable(): void
    {
        $parents = $this->createMock(ParentAccountService::class);
        $parents->method('getOrBootstrap')->willThrowException(new RuntimeException('Database unavailable'));

        $response = (new CrewController($this->authMock(), $this->createMock(CrewService::class), $parents))
            ->index('Bearer t');

        self::assertSame(503, $response->status);
    }

    public function testCrewParentNotFound(): void
    {
        $parents = $this->createMock(ParentAccountService::class);
        $parents->method('getOrBootstrap')->willThrowException(new RuntimeException('Parent account not found'));

        $response = (new CrewController($this->authMock(), $this->createMock(CrewService::class), $parents))
            ->index('Bearer t');

        self::assertSame(404, $response->status);
    }

    public function testCrewInternalRuntimeError(): void
    {
        $parents = $this->createMock(ParentAccountService::class);
        $parents->method('getOrBootstrap')->willThrowException(new RuntimeException('unexpected'));

        $response = (new CrewController($this->authMock(), $this->createMock(CrewService::class), $parents))
            ->index('Bearer t');

        self::assertSame(500, $response->status);
    }

    public function testCrewInternalThrowable(): void
    {
        $crew = $this->createMock(CrewService::class);
        $crew->method('listForAuthUser')->willThrowException(new \Exception('boom'));

        $response = (new CrewController($this->authMock(), $crew, $this->parentsBootstrapMock()))
            ->index('Bearer t');

        self::assertSame(500, $response->status);
    }

    public function testCrewCreateInvalidJsonNotArray(): void
    {
        $crew = $this->createMock(CrewService::class);
        $crew->expects(self::never())->method('createForAuthUser');

        $response = (new CrewController($this->authMock(), $crew, $this->parentsBootstrapMock()))
            ->create('Bearer t', '"string"');

        self::assertSame(422, $response->status);
    }

    public function testCrewUpdateBodyRequired(): void
    {
        $response = (new CrewController($this->authMock(), $this->createMock(CrewService::class), $this->parentsBootstrapMock()))
            ->update('Bearer t', 'child-id', null);

        self::assertSame(422, $response->status);
    }

    public function testCrewUpdateInvalidJson(): void
    {
        $response = (new CrewController($this->authMock(), $this->createMock(CrewService::class), $this->parentsBootstrapMock()))
            ->update('Bearer t', 'child-id', '{bad');

        self::assertSame(422, $response->status);
    }

    public function testCrewUpdateValidationError(): void
    {
        $crew = $this->createMock(CrewService::class);
        $crew->method('updateProfileForAuthUser')
            ->willThrowException(new InvalidArgumentException('No updatable fields'));

        $response = (new CrewController($this->authMock(), $crew, $this->parentsBootstrapMock()))
            ->update('Bearer t', 'child-id', '{}');

        self::assertSame(422, $response->status);
    }

    public function testCrewUpdateNotFound(): void
    {
        $crew = $this->createMock(CrewService::class);
        $crew->method('updateProfileForAuthUser')
            ->willThrowException(new RuntimeException('Crew member not found'));

        $response = (new CrewController($this->authMock(), $crew, $this->parentsBootstrapMock()))
            ->update('Bearer t', 'child-id', '{"display_name":"Kid"}');

        self::assertSame(404, $response->status);
    }

    public function testCrewUpdatePermissionsBodyRequired(): void
    {
        $response = (new CrewController($this->authMock(), $this->createMock(CrewService::class), $this->parentsBootstrapMock()))
            ->updatePermissions('Bearer t', 'child-id', '');

        self::assertSame(422, $response->status);
    }

    public function testCrewUpdatePermissionsNotFound(): void
    {
        $crew = $this->createMock(CrewService::class);
        $crew->method('updatePermissionsForAuthUser')
            ->willThrowException(new RuntimeException('Crew member not found'));

        $response = (new CrewController($this->authMock(), $crew, $this->parentsBootstrapMock()))
            ->updatePermissions('Bearer t', 'child-id', '{"allow_solo_start":true}');

        self::assertSame(404, $response->status);
    }

    public function testCrewDestroyInvalidJson(): void
    {
        $response = (new CrewController($this->authMock(), $this->createMock(CrewService::class), $this->parentsBootstrapMock()))
            ->destroy('Bearer t', 'child-id', '{oops');

        self::assertSame(422, $response->status);
    }

    public function testCrewDestroyNotFound(): void
    {
        $crew = $this->createMock(CrewService::class);
        $crew->method('softDeleteForAuthUser')
            ->willThrowException(new RuntimeException('Crew member not found'));

        $response = (new CrewController($this->authMock(), $crew, $this->parentsBootstrapMock()))
            ->destroy('Bearer t', 'child-id', '{"confirm":true}');

        self::assertSame(404, $response->status);
    }

    public function testParentsBootstrapAuthFailure(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willThrowException(new AuthException('Missing Bearer token'));

        $response = (new ParentsController($auth))->bootstrap(null);

        self::assertSame(401, $response->status);
    }

    public function testParentsMeAuthFailure(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willThrowException(new AuthException('Missing Bearer token'));

        $response = (new ParentsController($auth))->me(null);

        self::assertSame(401, $response->status);
    }

    public function testParentsMeDatabaseUnavailable(): void
    {
        $parents = $this->createMock(ParentAccountService::class);
        $parents->method('getOrBootstrap')->willThrowException(new RuntimeException('DATABASE_URL not configured'));

        $response = (new ParentsController($this->authMock(), $parents))->me('Bearer t');

        self::assertSame(503, $response->status);
    }

    public function testParentsUpdateMeInvalidDisplayName(): void
    {
        $parents = $this->createMock(ParentAccountService::class);
        $parents->method('getOrBootstrap')->willReturn([
            'parent_id' => '22222222-2222-2222-2222-222222222222',
            'auth_user_id' => '11111111-1111-1111-1111-111111111111',
            'email' => 'padre@ejemplo.com',
            'display_name' => null,
            'avatar_url' => null,
            'provider' => 'google',
        ]);
        $parents->method('updateDisplayName')
            ->willThrowException(new InvalidArgumentException('display_name too long'));

        $response = (new ParentsController($this->authMock(), $parents))->updateMe(
            'Bearer t',
            json_encode(['display_name' => str_repeat('a', 50)], JSON_THROW_ON_ERROR),
        );

        self::assertSame(422, $response->status);
    }

    public function testParentsUpdateMeNotArrayJson(): void
    {
        $response = (new ParentsController($this->authMock()))->updateMe('Bearer t', 'true');

        self::assertSame(422, $response->status);
    }

    public function testParentsDeleteMeNotFound(): void
    {
        $parents = $this->createMock(ParentAccountService::class);
        $parents->method('deleteAccount')->willThrowException(new RuntimeException('Parent account not found'));

        $response = (new ParentsController($this->authMock(), $parents))->deleteMe('Bearer t');

        self::assertSame(404, $response->status);
    }

    public function testParentsDeleteMeInternalError(): void
    {
        $parents = $this->createMock(ParentAccountService::class);
        $parents->method('deleteAccount')->willThrowException(new RuntimeException('unexpected'));

        $response = (new ParentsController($this->authMock(), $parents))->deleteMe('Bearer t');

        self::assertSame(500, $response->status);
    }

    public function testParentsBootstrapThrowable(): void
    {
        $parents = $this->createMock(ParentAccountService::class);
        $parents->method('bootstrap')->willThrowException(new \Exception('boom'));

        $response = (new ParentsController($this->authMock(), $parents))->bootstrap('Bearer t');

        self::assertSame(500, $response->status);
    }

    public function testParentsMeThrowable(): void
    {
        $parents = $this->createMock(ParentAccountService::class);
        $parents->method('getOrBootstrap')->willThrowException(new \Exception('boom'));

        $response = (new ParentsController($this->authMock(), $parents))->me('Bearer t');

        self::assertSame(500, $response->status);
    }

    public function testParentsUpdateMeThrowable(): void
    {
        $parents = $this->createMock(ParentAccountService::class);
        $parents->method('getOrBootstrap')->willThrowException(new \Exception('boom'));

        $response = (new ParentsController($this->authMock(), $parents))->updateMe(
            'Bearer t',
            json_encode(['display_name' => 'Ada'], JSON_THROW_ON_ERROR),
        );

        self::assertSame(500, $response->status);
    }

    public function testParentsUpdateMeEmailRequired(): void
    {
        $response = (new ParentsController($this->authMock(['email' => ''])))->updateMe(
            'Bearer t',
            json_encode(['display_name' => 'Ada'], JSON_THROW_ON_ERROR),
        );

        self::assertSame(422, $response->status);
    }

    public function testParentsBootstrapMapRuntimeInternal(): void
    {
        $parents = $this->createMock(ParentAccountService::class);
        $parents->method('bootstrap')->willThrowException(new RuntimeException('unexpected'));

        $response = (new ParentsController($this->authMock(), $parents))->bootstrap('Bearer t');

        self::assertSame(500, $response->status);
    }

    public function testParentSettingsShowEmailRequired(): void
    {
        $response = (new ParentSettingsController($this->authMock(['email' => ''])))->show('Bearer t');

        self::assertSame(422, $response->status);
    }

    public function testParentSettingsUpdateBodyRequired(): void
    {
        $response = (new ParentSettingsController($this->authMock()))->update('Bearer t', null);

        self::assertSame(422, $response->status);
    }

    public function testParentSettingsUpdateNotArrayJson(): void
    {
        $response = (new ParentSettingsController($this->authMock()))->update('Bearer t', '42');

        self::assertSame(422, $response->status);
    }

    public function testParentSettingsMapRuntimeDatabaseUnavailable(): void
    {
        $repo = $this->createMock(ParentSettingsRepository::class);
        $repo->method('getForAuthUser')->willThrowException(new RuntimeException('Database unavailable'));

        $response = (new ParentSettingsController($this->authMock(), $repo))->show('Bearer t');

        self::assertSame(503, $response->status);
    }

    public function testParentSettingsMapRuntimeInternal(): void
    {
        $repo = $this->createMock(ParentSettingsRepository::class);
        $repo->method('getForAuthUser')->willThrowException(new RuntimeException('unexpected'));

        $response = (new ParentSettingsController($this->authMock(), $repo))->show('Bearer t');

        self::assertSame(500, $response->status);
    }

    public function testParentSettingsThrowable(): void
    {
        $repo = $this->createMock(ParentSettingsRepository::class);
        $repo->method('getForAuthUser')->willThrowException(new \Exception('boom'));

        $response = (new ParentSettingsController($this->authMock(), $repo))->show('Bearer t');

        self::assertSame(500, $response->status);
    }

    public function testStoragePrepareUploadAuthFailure(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willThrowException(new AuthException('Missing Bearer token'));

        $response = (new StorageController($auth))->prepareUpload(null, '{}');

        self::assertSame(401, $response->status);
    }

    public function testStoragePrepareUploadNullBody(): void
    {
        $response = (new StorageController($this->authMock()))->prepareUpload('Bearer t', null);

        self::assertSame(422, $response->status);
    }

    public function testStoragePrepareUploadInvalidCategory(): void
    {
        $response = (new StorageController($this->authMock()))->prepareUpload(
            'Bearer t',
            json_encode(['filename' => 'x.png', 'category' => 'bad'], JSON_THROW_ON_ERROR),
        );

        self::assertSame(422, $response->status);
    }

    public function testStorageUploadMissingFile(): void
    {
        $_POST = ['token' => 'abc'];
        unset($_FILES['file']);

        $response = (new StorageController())->upload();

        self::assertSame(422, $response->status);
        $_POST = [];
    }

    public function testStorageUploadErrorCode(): void
    {
        $_POST = ['token' => 'abc'];
        $_FILES['file'] = ['error' => UPLOAD_ERR_NO_FILE, 'tmp_name' => ''];

        $response = (new StorageController())->upload();

        self::assertSame(422, $response->status);
        $_POST = [];
        unset($_FILES['file']);
    }

    public function testStorageUploadInvalidTmpFile(): void
    {
        $_POST = ['token' => 'abc'];
        $_FILES['file'] = ['error' => UPLOAD_ERR_OK, 'tmp_name' => '/path/does-not-exist'];

        $response = (new StorageController())->upload();

        self::assertSame(422, $response->status);
        $_POST = [];
        unset($_FILES['file']);
    }

    public function testCrewUpdatePermissionsValidationError(): void
    {
        $crew = $this->createMock(CrewService::class);
        $crew->method('updatePermissionsForAuthUser')
            ->willThrowException(new InvalidArgumentException('font_scale_play invalid'));

        $response = (new CrewController($this->authMock(), $crew, $this->parentsBootstrapMock()))
            ->updatePermissions('Bearer t', 'child-id', '{"font_scale_play":"xxl"}');

        self::assertSame(422, $response->status);
    }

    public function testParentsBootstrapParentNotFound(): void
    {
        $parents = $this->createMock(ParentAccountService::class);
        $parents->method('bootstrap')->willThrowException(new RuntimeException('Parent account not found'));

        $response = (new ParentsController($this->authMock(), $parents))->bootstrap('Bearer t');

        self::assertSame(404, $response->status);
    }
}
