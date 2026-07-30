<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Controllers\ParentsController;
use Kidepik\Api\Services\ParentAccountService;
use Kidepik\Api\Services\SupabaseAuthService;
use PHPUnit\Framework\TestCase;

final class ParentsControllerErrorsTest extends TestCase
{
    public function testBootstrapRequiresEmail(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willReturn([
            'sub' => '11111111-1111-1111-1111-111111111111',
            'role' => 'authenticated',
            'email' => '',
        ]);

        $response = (new ParentsController($auth))->bootstrap('Bearer t');

        self::assertSame(422, $response->status);
    }

    public function testUpdateMeInvalidJson(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willReturn([
            'sub' => '11111111-1111-1111-1111-111111111111',
            'role' => 'authenticated',
            'email' => 'a@b.com',
        ]);

        $response = (new ParentsController($auth))->updateMe('Bearer t', 'not-json');

        self::assertSame(422, $response->status);
    }

    public function testUpdateMeMissingDisplayName(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willReturn([
            'sub' => '11111111-1111-1111-1111-111111111111',
            'role' => 'authenticated',
            'email' => 'a@b.com',
        ]);

        $response = (new ParentsController($auth))->updateMe('Bearer t', '{}');

        self::assertSame(422, $response->status);
    }
}
