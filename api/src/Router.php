<?php

declare(strict_types=1);

namespace Kidepik\Api;

use Kidepik\Api\Controllers\ArchitectureController;
use Kidepik\Api\Controllers\HealthController;
use Kidepik\Api\Controllers\LegalController;
use Kidepik\Api\Controllers\MigrationsController;
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
            default => JsonResponse::error('Not Found', 404),
        };
    }
}
