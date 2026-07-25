<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Controllers\ParentsController;
use Kidepik\Api\Router;
use Kidepik\Api\Services\ParentAccountService;
use Kidepik\Api\Services\SupabaseAuthService;
use PHPUnit\Framework\TestCase;

final class ParentsBootstrapTest extends TestCase
{
    public function testBootstrapRequiresAuth(): void
    {
        $response = (new Router())->dispatch('POST', '/api/v1/parents/bootstrap');

        self::assertSame(401, $response->status);
    }

    public function testBootstrapReturnsCreatedPayload(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willReturn([
            'sub' => '11111111-1111-1111-1111-111111111111',
            'role' => 'authenticated',
            'email' => 'padre@ejemplo.com',
            'display_name' => 'Padre Test',
            'avatar_url' => 'https://example.com/a.jpg',
        ]);

        $parents = $this->createMock(ParentAccountService::class);
        $parents->expects(self::once())
            ->method('bootstrap')
            ->with(
                '11111111-1111-1111-1111-111111111111',
                'padre@ejemplo.com',
                'Padre Test',
                'https://example.com/a.jpg',
            )
            ->willReturn([
                'parent_id' => '22222222-2222-2222-2222-222222222222',
                'auth_user_id' => '11111111-1111-1111-1111-111111111111',
                'email' => 'padre@ejemplo.com',
                'created' => true,
            ]);

        $response = (new ParentsController($auth, $parents))->bootstrap('Bearer test-token');

        self::assertSame(200, $response->status);
        $body = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($body['created']);
        self::assertSame('padre@ejemplo.com', $body['email']);
    }

    public function testBootstrapIdempotentPayload(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willReturn([
            'sub' => '11111111-1111-1111-1111-111111111111',
            'role' => 'authenticated',
            'email' => 'padre@ejemplo.com',
        ]);

        $parents = $this->createMock(ParentAccountService::class);
        $parents->method('bootstrap')->willReturn([
            'parent_id' => '22222222-2222-2222-2222-222222222222',
            'auth_user_id' => '11111111-1111-1111-1111-111111111111',
            'email' => 'padre@ejemplo.com',
            'created' => false,
        ]);

        $response = (new ParentsController($auth, $parents))->bootstrap('Bearer test-token');

        self::assertSame(200, $response->status);
        $body = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertFalse($body['created']);
    }
}
