<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use InvalidArgumentException;
use Kidepik\Api\Controllers\CrewController;
use Kidepik\Api\Router;
use Kidepik\Api\Services\CrewService;
use Kidepik\Api\Services\ParentAccountService;
use Kidepik\Api\Services\SupabaseAuthService;
use PHPUnit\Framework\TestCase;
use RuntimeException;

final class CrewTest extends TestCase
{
    public function testListRequiresAuth(): void
    {
        $response = (new Router())->dispatch('GET', '/api/v1/crew');
        self::assertSame(401, $response->status);
    }

    public function testCreateRequiresAuth(): void
    {
        $response = (new Router())->dispatch('POST', '/api/v1/crew');
        self::assertSame(401, $response->status);
    }

    public function testListReturnsMembers(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willReturn([
            'sub' => '11111111-1111-1111-1111-111111111111',
            'email' => 'padre@ejemplo.com',
        ]);
        $parents = $this->createMock(ParentAccountService::class);
        $parents->method('getOrBootstrap')->willReturn([
            'parent_id' => '22222222-2222-2222-2222-222222222222',
            'auth_user_id' => '11111111-1111-1111-1111-111111111111',
            'email' => 'padre@ejemplo.com',
            'display_name' => null,
            'avatar_url' => null,
            'provider' => 'google',
        ]);
        $crew = $this->createMock(CrewService::class);
        $crew->method('listForAuthUser')->willReturn([
            'members' => [],
            'member_count' => 0,
            'member_limit' => 4,
        ]);

        $response = (new CrewController($auth, $crew, $parents))->index('Bearer t');
        self::assertSame(200, $response->status);
        $body = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertSame(0, $body['member_count']);
        self::assertSame(4, $body['member_limit']);
    }

    public function testCreateRejectsLimit(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willReturn([
            'sub' => '11111111-1111-1111-1111-111111111111',
            'email' => 'padre@ejemplo.com',
        ]);
        $parents = $this->createMock(ParentAccountService::class);
        $parents->method('getOrBootstrap')->willReturn([
            'parent_id' => '22222222-2222-2222-2222-222222222222',
            'auth_user_id' => '11111111-1111-1111-1111-111111111111',
            'email' => 'padre@ejemplo.com',
            'display_name' => null,
            'avatar_url' => null,
            'provider' => 'google',
        ]);
        $crew = $this->createMock(CrewService::class);
        $crew->method('createForAuthUser')
            ->willThrowException(new InvalidArgumentException('Crew member limit reached'));

        $response = (new CrewController($auth, $crew, $parents))->create('Bearer t', '{}');
        self::assertSame(422, $response->status);
    }

    public function testShowNotFound(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willReturn([
            'sub' => '11111111-1111-1111-1111-111111111111',
            'email' => 'padre@ejemplo.com',
        ]);
        $parents = $this->createMock(ParentAccountService::class);
        $parents->method('getOrBootstrap')->willReturn([
            'parent_id' => '22222222-2222-2222-2222-222222222222',
            'auth_user_id' => '11111111-1111-1111-1111-111111111111',
            'email' => 'padre@ejemplo.com',
            'display_name' => null,
            'avatar_url' => null,
            'provider' => 'google',
        ]);
        $crew = $this->createMock(CrewService::class);
        $crew->method('getForAuthUser')
            ->willThrowException(new RuntimeException('Crew member not found'));

        $response = (new CrewController($auth, $crew, $parents))->show(
            'Bearer t',
            '33333333-3333-3333-3333-333333333333',
        );
        self::assertSame(404, $response->status);
    }
}
