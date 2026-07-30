<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response;
use Kidepik\Api\Services\AuthException;
use Kidepik\Api\Services\SupabaseAuthService;
use PHPUnit\Framework\TestCase;

final class SupabaseAuthServiceExtendedTest extends TestCase
{
    public function testMissingUserIdInResponse(): void
    {
        $mock = new MockHandler([
            new Response(200, [], json_encode(['email' => 'a@b.com'], JSON_THROW_ON_ERROR)),
        ]);
        $service = new SupabaseAuthService(new Client(['handler' => HandlerStack::create($mock)]));

        $this->expectException(AuthException::class);
        $service->validateBearer('Bearer t');
    }

    public function testDisplayNameFromNameKey(): void
    {
        $mock = new MockHandler([
            new Response(200, [], json_encode([
                'id' => '11111111-1111-1111-1111-111111111111',
                'user_metadata' => ['name' => 'Nick'],
            ], JSON_THROW_ON_ERROR)),
        ]);
        $service = new SupabaseAuthService(new Client(['handler' => HandlerStack::create($mock)]));
        $claims = $service->validateBearer('Bearer t');

        self::assertSame('Nick', $claims['display_name']);
    }

    public function testAvatarFromPictureKey(): void
    {
        $mock = new MockHandler([
            new Response(200, [], json_encode([
                'id' => '11111111-1111-1111-1111-111111111111',
                'user_metadata' => ['picture' => 'https://img.example/p.jpg'],
            ], JSON_THROW_ON_ERROR)),
        ]);
        $service = new SupabaseAuthService(new Client(['handler' => HandlerStack::create($mock)]));
        $claims = $service->validateBearer('Bearer t');

        self::assertSame('https://img.example/p.jpg', $claims['avatar_url']);
    }

    public function testNonArrayUserMetadata(): void
    {
        $mock = new MockHandler([
            new Response(200, [], json_encode([
                'id' => '11111111-1111-1111-1111-111111111111',
                'user_metadata' => 'bad',
            ], JSON_THROW_ON_ERROR)),
        ]);
        $service = new SupabaseAuthService(new Client(['handler' => HandlerStack::create($mock)]));
        $claims = $service->validateBearer('Bearer t');

        self::assertNull($claims['display_name']);
        self::assertNull($claims['avatar_url']);
    }

    public function testNonBearerHeader(): void
    {
        $service = new SupabaseAuthService();

        $this->expectException(AuthException::class);
        $service->validateBearer('Token abc');
    }
}
