<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Router;
use PHPUnit\Framework\TestCase;

final class ArchitectureTest extends TestCase
{
    public function testConfigContainsPublicUrls(): void
    {
        $response = (new Router())->dispatch('GET', '/api/v1/architecture/config');

        self::assertSame(200, $response->status);
        /** @var array<string, mixed> $body */
        $body = json_decode($response->body, true);
        self::assertArrayHasKey('api_url', $body);
        self::assertArrayHasKey('supabase_url', $body);
        self::assertArrayHasKey('media_base_url', $body);
        self::assertArrayHasKey('client_logging', $body);
        self::assertArrayHasKey('client_log_level', $body);
    }
}
