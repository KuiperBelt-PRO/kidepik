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

final class SupabaseAuthServiceTest extends TestCase
{
    public function testMissingBearerThrows(): void
    {
        $service = new SupabaseAuthService();

        $this->expectException(AuthException::class);
        $service->validateBearer(null);
    }

    public function testEmptyTokenThrows(): void
    {
        $service = new SupabaseAuthService();

        $this->expectException(AuthException::class);
        $service->validateBearer('Bearer   ');
    }

    public function testValidTokenReturnsClaims(): void
    {
        $mock = new MockHandler([
            new Response(200, [], json_encode([
                'id' => '11111111-1111-1111-1111-111111111111',
                'email' => 'padre@ejemplo.com',
                'user_metadata' => [
                    'full_name' => 'Ada Lovelace',
                    'avatar_url' => 'https://example.com/a.jpg',
                ],
            ], JSON_THROW_ON_ERROR)),
        ]);
        $client = new Client(['handler' => HandlerStack::create($mock)]);
        $service = new SupabaseAuthService($client);

        $claims = $service->validateBearer('Bearer good-token');

        self::assertSame('11111111-1111-1111-1111-111111111111', $claims['sub']);
        self::assertSame('padre@ejemplo.com', $claims['email']);
        self::assertSame('Ada Lovelace', $claims['display_name']);
        self::assertSame('https://example.com/a.jpg', $claims['avatar_url']);
    }

    public function testRejectedTokenThrows(): void
    {
        $mock = new MockHandler([
            new Response(401, [], '{}'),
        ]);
        $client = new Client(['handler' => HandlerStack::create($mock), 'http_errors' => false]);
        $service = new SupabaseAuthService($client);

        try {
            $service->validateBearer('Bearer bad');
            self::fail('Expected AuthException');
        } catch (AuthException $e) {
            self::assertSame('Invalid token: Supabase auth rejected', $e->getMessage());
        }
    }

    public function testUpstreamErrorIsUnreachable(): void
    {
        $mock = new MockHandler([
            new Response(503, [], '{}'),
        ]);
        $client = new Client(['handler' => HandlerStack::create($mock), 'http_errors' => false]);
        $service = new SupabaseAuthService($client);

        try {
            $service->validateBearer('Bearer t');
            self::fail('Expected AuthException');
        } catch (AuthException $e) {
            self::assertSame('Invalid token: Supabase auth unreachable', $e->getMessage());
        }
    }
}
