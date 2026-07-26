<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Controllers\ParentsController;
use Kidepik\Api\Router;
use Kidepik\Api\Services\ParentAccountService;
use Kidepik\Api\Services\SupabaseAuthService;
use PHPUnit\Framework\TestCase;

final class ParentsMeTest extends TestCase
{
    public function testGetMeRequiresAuth(): void
    {
        $response = (new Router())->dispatch('GET', '/api/v1/parents/me');

        self::assertSame(401, $response->status);
    }

    public function testPatchMeRequiresAuth(): void
    {
        $response = (new Router())->dispatch('PATCH', '/api/v1/parents/me');

        self::assertSame(401, $response->status);
    }

    public function testDeleteMeRequiresAuth(): void
    {
        $response = (new Router())->dispatch('DELETE', '/api/v1/parents/me');

        self::assertSame(401, $response->status);
    }

    public function testGetMeReturnsParentDto(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willReturn([
            'sub' => '11111111-1111-1111-1111-111111111111',
            'role' => 'authenticated',
            'email' => 'padre@ejemplo.com',
            'display_name' => 'Padre Google',
            'avatar_url' => 'https://example.com/a.jpg',
        ]);

        $parents = $this->createMock(ParentAccountService::class);
        $parents->expects(self::once())
            ->method('getOrBootstrap')
            ->with(
                '11111111-1111-1111-1111-111111111111',
                'padre@ejemplo.com',
                'Padre Google',
                'https://example.com/a.jpg',
            )
            ->willReturn([
                'parent_id' => '22222222-2222-2222-2222-222222222222',
                'auth_user_id' => '11111111-1111-1111-1111-111111111111',
                'email' => 'padre@ejemplo.com',
                'display_name' => 'Ada',
                'avatar_url' => 'https://example.com/a.jpg',
                'provider' => 'google',
            ]);

        $response = (new ParentsController($auth, $parents))->me('Bearer test-token');

        self::assertSame(200, $response->status);
        $body = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('Ada', $body['display_name']);
        self::assertSame('google', $body['provider']);
        self::assertSame('padre@ejemplo.com', $body['email']);
    }

    public function testPatchMeUpdatesDisplayName(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willReturn([
            'sub' => '11111111-1111-1111-1111-111111111111',
            'role' => 'authenticated',
            'email' => 'padre@ejemplo.com',
        ]);

        $parents = $this->createMock(ParentAccountService::class);
        $parents->expects(self::once())
            ->method('getOrBootstrap')
            ->willReturn([
                'parent_id' => '22222222-2222-2222-2222-222222222222',
                'auth_user_id' => '11111111-1111-1111-1111-111111111111',
                'email' => 'padre@ejemplo.com',
                'display_name' => null,
                'avatar_url' => null,
                'provider' => 'google',
            ]);
        $parents->expects(self::once())
            ->method('updateDisplayName')
            ->with('11111111-1111-1111-1111-111111111111', 'Ada Lovelace')
            ->willReturn([
                'parent_id' => '22222222-2222-2222-2222-222222222222',
                'auth_user_id' => '11111111-1111-1111-1111-111111111111',
                'email' => 'padre@ejemplo.com',
                'display_name' => 'Ada Lovelace',
                'avatar_url' => null,
                'provider' => 'google',
            ]);

        $response = (new ParentsController($auth, $parents))->updateMe(
            'Bearer test-token',
            json_encode(['display_name' => 'Ada Lovelace'], JSON_THROW_ON_ERROR),
        );

        self::assertSame(200, $response->status);
        $body = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('Ada Lovelace', $body['display_name']);
    }

    public function testPatchMeRejectsInvalidDisplayName(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willReturn([
            'sub' => '11111111-1111-1111-1111-111111111111',
            'role' => 'authenticated',
            'email' => 'padre@ejemplo.com',
        ]);

        $parents = $this->createMock(ParentAccountService::class);
        $parents->expects(self::never())->method('updateDisplayName');

        $response = (new ParentsController($auth, $parents))->updateMe(
            'Bearer test-token',
            json_encode(['display_name' => str_repeat('x', 41)], JSON_THROW_ON_ERROR),
        );

        self::assertSame(422, $response->status);
    }

    public function testDeleteMeReturnsDeleted(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willReturn([
            'sub' => '11111111-1111-1111-1111-111111111111',
            'role' => 'authenticated',
            'email' => 'padre@ejemplo.com',
        ]);

        $parents = $this->createMock(ParentAccountService::class);
        $parents->expects(self::once())
            ->method('deleteAccount')
            ->with('11111111-1111-1111-1111-111111111111')
            ->willReturn(true);

        $response = (new ParentsController($auth, $parents))->deleteMe('Bearer test-token');

        self::assertSame(200, $response->status);
        $body = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($body['deleted']);
    }
}
