<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Router;
use PHPUnit\Framework\TestCase;

final class RouterNotFoundTest extends TestCase
{
    public function testUnknownRouteReturns404(): void
    {
        $response = (new Router())->dispatch('GET', '/api/v1/unknown-route');

        self::assertSame(404, $response->status);
    }

    public function testCrewPatchWrongMethodReturns404(): void
    {
        $response = (new Router())->dispatch('POST', '/api/v1/crew/abc/permissions');

        self::assertSame(404, $response->status);
    }
}
