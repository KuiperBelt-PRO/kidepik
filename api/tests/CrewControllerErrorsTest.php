<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Controllers\CrewController;
use Kidepik\Api\Services\CrewService;
use Kidepik\Api\Services\ParentAccountService;
use Kidepik\Api\Services\SupabaseAuthService;
use PHPUnit\Framework\TestCase;
use RuntimeException;

final class CrewControllerErrorsTest extends TestCase
{
    public function testShowNotFoundReturns404(): void
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
        $crew->method('getForAuthUser')->willThrowException(new RuntimeException('Crew member not found'));

        $response = (new CrewController($auth, $crew, $parents))->show('Bearer t', 'missing-id');

        self::assertSame(404, $response->status);
    }

    public function testCreateInvalidJson(): void
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
        $crew->expects(self::never())->method('createForAuthUser');

        $response = (new CrewController($auth, $crew, $parents))->create('Bearer t', '{not-json');

        self::assertSame(422, $response->status);
    }
}
