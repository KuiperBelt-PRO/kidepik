<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Router;
use PHPUnit\Framework\TestCase;

final class HealthTest extends TestCase
{
    public function testHealthReturnsOk(): void
    {
        $response = (new Router())->dispatch('GET', '/api/v1/health');

        self::assertSame(200, $response->status);
        /** @var array<string, mixed> $body */
        $body = json_decode($response->body, true);
        self::assertSame('ok', $body['status']);
        self::assertSame('kidepik-api', $body['service']);
    }
}
