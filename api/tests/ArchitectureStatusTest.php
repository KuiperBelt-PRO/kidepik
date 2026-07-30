<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Controllers\ArchitectureController;
use Kidepik\Api\Router;
use PHPUnit\Framework\TestCase;

final class ArchitectureStatusTest extends TestCase
{
    public function testStatusViaRouter(): void
    {
        $response = (new Router())->dispatch('GET', '/api/v1/architecture/status');

        self::assertSame(200, $response->status);
        $body = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($body['api']['ok']);
        self::assertArrayHasKey('supabase', $body);
        self::assertArrayHasKey('postgres', $body);
        self::assertArrayHasKey('storage', $body);
        self::assertArrayHasKey('migrations', $body);
    }

    public function testStatusDirectController(): void
    {
        $response = (new ArchitectureController())->status();
        self::assertSame(200, $response->status);
    }
}
