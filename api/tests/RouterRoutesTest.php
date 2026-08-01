<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Router;
use PHPUnit\Framework\TestCase;

final class RouterRoutesTest extends TestCase
{
    public function testCrewMemberRoutesRequireAuth(): void
    {
        $router = new Router();

        self::assertSame(401, $router->dispatch('GET', '/api/v1/crew/abc')->status);
        self::assertSame(401, $router->dispatch('PATCH', '/api/v1/crew/abc')->status);
        self::assertSame(401, $router->dispatch('DELETE', '/api/v1/crew/abc')->status);
        self::assertSame(401, $router->dispatch('PATCH', '/api/v1/crew/abc/permissions')->status);
    }

    public function testCrewMemberWrongMethodReturns404(): void
    {
        $router = new Router();

        self::assertSame(404, $router->dispatch('POST', '/api/v1/crew/abc')->status);
    }

    public function testParentsRoutesRequireAuth(): void
    {
        $router = new Router();

        self::assertSame(401, $router->dispatch('GET', '/api/v1/parents/me')->status);
        self::assertSame(401, $router->dispatch('PATCH', '/api/v1/parents/me')->status);
        self::assertSame(401, $router->dispatch('DELETE', '/api/v1/parents/me')->status);
        self::assertSame(401, $router->dispatch('GET', '/api/v1/parents/me/settings')->status);
        self::assertSame(401, $router->dispatch('PATCH', '/api/v1/parents/me/settings')->status);
    }

    public function testStorageRoutes(): void
    {
        $router = new Router();

        self::assertSame(401, $router->dispatch('POST', '/api/v1/storage/prepare-upload')->status);
        self::assertSame(422, $router->dispatch('POST', '/api/v1/storage/upload')->status);
    }

    public function testPlayDialogueRoutesRequireAuth(): void
    {
        $router = new Router();

        self::assertSame(401, $router->dispatch('POST', '/api/v1/play/abc/dialogue/session')->status);
        self::assertSame(401, $router->dispatch('POST', '/api/v1/play/abc/dialogue/turn')->status);
        self::assertSame(401, $router->dispatch('GET', '/api/v1/play/abc/journey/summary')->status);
        self::assertSame(401, $router->dispatch('GET', '/api/v1/play/abc/journey/timeline')->status);
    }

    public function testDebugAiRoutesRequireAuthWhenEnabled(): void
    {
        putenv('APP_ENV=local');
        putenv('APP_DEBUG_AI=true');
        $_ENV['APP_ENV'] = 'local';
        $_ENV['APP_DEBUG_AI'] = 'true';

        $router = new Router();
        self::assertSame(401, $router->dispatch('GET', '/api/v1/debug/ai/status')->status);
        self::assertSame(401, $router->dispatch('POST', '/api/v1/debug/ai/ping')->status);
    }

    public function testArchitectureConfigRoute(): void
    {
        $response = (new Router())->dispatch('GET', '/api/v1/architecture/config');

        self::assertSame(200, $response->status);
    }

    public function testPathNormalizationTrailingSlash(): void
    {
        $response = (new Router())->dispatch('GET', '/api/v1/health/');

        self::assertSame(200, $response->status);
    }
}
