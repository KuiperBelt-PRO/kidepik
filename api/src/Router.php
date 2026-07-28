<?php

declare(strict_types=1);

namespace Kidepik\Api;

use Kidepik\Api\Controllers\ArchitectureController;
use Kidepik\Api\Controllers\CrewController;
use Kidepik\Api\Controllers\HealthController;
use Kidepik\Api\Controllers\LegalController;
use Kidepik\Api\Controllers\MigrationsController;
use Kidepik\Api\Controllers\ParentsController;
use Kidepik\Api\Controllers\ParentSettingsController;
use Kidepik\Api\Controllers\StorageController;
use Kidepik\Api\Http\JsonResponse;

final class Router
{
    public function dispatch(string $method, string $uri): JsonResponse
    {
        $path = parse_url($uri, PHP_URL_PATH) ?? '/';
        $path = rtrim($path, '/') ?: '/';

        if ($method === 'GET' && preg_match('#^/api/v1/legal/([^/]+)$#', $path, $matches) === 1) {
            return (new LegalController())->show(rawurldecode($matches[1]));
        }

        if (preg_match('#^/api/v1/crew/([^/]+)/permissions$#', $path, $crewPerm) === 1) {
            if ($method === 'PATCH') {
                return (new CrewController())->updatePermissions(
                    $_SERVER['HTTP_AUTHORIZATION'] ?? null,
                    rawurldecode($crewPerm[1]),
                    file_get_contents('php://input') ?: null,
                );
            }
        }

        if (preg_match('#^/api/v1/crew/([^/]+)$#', $path, $crewOne) === 1) {
            $childId = rawurldecode($crewOne[1]);
            $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
            $body = file_get_contents('php://input') ?: null;

            return match ($method) {
                'GET' => (new CrewController())->show($auth, $childId),
                'PATCH' => (new CrewController())->update($auth, $childId, $body),
                'DELETE' => (new CrewController())->destroy($auth, $childId, $body),
                default => JsonResponse::error('Not Found', 404),
            };
        }

        return match (true) {
            $method === 'GET' && $path === '/api/v1/health' => (new HealthController())->show(),
            $method === 'GET' && $path === '/api/v1/architecture/config' => (new ArchitectureController())->config(),
            $method === 'GET' && $path === '/api/v1/architecture/status' => (new ArchitectureController())->status(),
            $method === 'GET' && $path === '/api/v1/migrations/status' => (new MigrationsController())->status(),
            $method === 'POST' && in_array($path, ['/api/v1/storage/prepare-upload', '/api/v1/storage/presign-upload'], true)
                => (new StorageController())->prepareUpload(
                    $_SERVER['HTTP_AUTHORIZATION'] ?? null,
                    file_get_contents('php://input') ?: null,
                ),
            $method === 'POST' && $path === '/api/v1/storage/upload' => (new StorageController())->upload(),
            $method === 'POST' && $path === '/api/v1/parents/bootstrap' => (new ParentsController())->bootstrap(
                $_SERVER['HTTP_AUTHORIZATION'] ?? null,
            ),
            $method === 'GET' && $path === '/api/v1/parents/me' => (new ParentsController())->me(
                $_SERVER['HTTP_AUTHORIZATION'] ?? null,
            ),
            $method === 'PATCH' && $path === '/api/v1/parents/me' => (new ParentsController())->updateMe(
                $_SERVER['HTTP_AUTHORIZATION'] ?? null,
                file_get_contents('php://input') ?: null,
            ),
            $method === 'DELETE' && $path === '/api/v1/parents/me' => (new ParentsController())->deleteMe(
                $_SERVER['HTTP_AUTHORIZATION'] ?? null,
            ),
            $method === 'GET' && $path === '/api/v1/parents/me/settings' => (new ParentSettingsController())->show(
                $_SERVER['HTTP_AUTHORIZATION'] ?? null,
            ),
            $method === 'PATCH' && $path === '/api/v1/parents/me/settings' => (new ParentSettingsController())->update(
                $_SERVER['HTTP_AUTHORIZATION'] ?? null,
                file_get_contents('php://input') ?: null,
            ),
            $method === 'GET' && $path === '/api/v1/crew' => (new CrewController())->index(
                $_SERVER['HTTP_AUTHORIZATION'] ?? null,
            ),
            $method === 'POST' && $path === '/api/v1/crew' => (new CrewController())->create(
                $_SERVER['HTTP_AUTHORIZATION'] ?? null,
                file_get_contents('php://input') ?: null,
            ),
            default => JsonResponse::error('Not Found', 404),
        };
    }
}
