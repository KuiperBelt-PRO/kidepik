<?php

declare(strict_types=1);

namespace Kidepik\Api\Controllers;

use InvalidArgumentException;
use Kidepik\Api\Http\JsonResponse;
use Kidepik\Api\Services\AuthException;
use Kidepik\Api\Services\ParentAccountService;
use Kidepik\Api\Services\SupabaseAuthService;
use RuntimeException;
use Throwable;

final class ParentsController
{
    public function __construct(
        private readonly ?SupabaseAuthService $auth = null,
        private readonly ?ParentAccountService $parents = null,
    ) {
    }

    public function bootstrap(?string $authorization): JsonResponse
    {
        try {
            $claims = ($this->auth ?? new SupabaseAuthService())->validateBearer($authorization);
        } catch (AuthException $e) {
            return JsonResponse::error($e->getMessage(), 401);
        }

        $authUserId = $claims['sub'];
        $email = $claims['email'] ?? '';
        if ($email === '') {
            return JsonResponse::error('Email required', 422);
        }

        try {
            $result = ($this->parents ?? new ParentAccountService())->bootstrap(
                $authUserId,
                $email,
                $claims['display_name'] ?? null,
                $claims['avatar_url'] ?? null,
            );
        } catch (RuntimeException $e) {
            return $this->mapRuntimeError($e);
        } catch (Throwable) {
            return JsonResponse::error('Internal error', 500);
        }

        return JsonResponse::ok($result);
    }

    public function me(?string $authorization): JsonResponse
    {
        try {
            $claims = ($this->auth ?? new SupabaseAuthService())->validateBearer($authorization);
        } catch (AuthException $e) {
            return JsonResponse::error($e->getMessage(), 401);
        }

        $email = $claims['email'] ?? '';
        if ($email === '') {
            return JsonResponse::error('Email required', 422);
        }

        try {
            $result = ($this->parents ?? new ParentAccountService())->getOrBootstrap(
                $claims['sub'],
                $email,
                $claims['display_name'] ?? null,
                $claims['avatar_url'] ?? null,
            );
        } catch (RuntimeException $e) {
            return $this->mapRuntimeError($e);
        } catch (Throwable) {
            return JsonResponse::error('Internal error', 500);
        }

        return JsonResponse::ok($result);
    }

    public function updateMe(?string $authorization, ?string $rawBody): JsonResponse
    {
        try {
            $claims = ($this->auth ?? new SupabaseAuthService())->validateBearer($authorization);
        } catch (AuthException $e) {
            return JsonResponse::error($e->getMessage(), 401);
        }

        $payload = [];
        if ($rawBody !== null && trim($rawBody) !== '') {
            try {
                $decoded = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);
            } catch (Throwable) {
                return JsonResponse::error('Invalid JSON', 422);
            }
            if (!is_array($decoded)) {
                return JsonResponse::error('Invalid JSON', 422);
            }
            $payload = $decoded;
        }

        if (!array_key_exists('display_name', $payload)) {
            return JsonResponse::error('display_name required', 422);
        }

        $email = $claims['email'] ?? '';
        if ($email === '') {
            return JsonResponse::error('Email required', 422);
        }

        try {
            $normalized = ParentAccountService::normalizeDisplayName($payload['display_name']);
            $service = $this->parents ?? new ParentAccountService();
            $service->getOrBootstrap(
                $claims['sub'],
                $email,
                $claims['display_name'] ?? null,
                $claims['avatar_url'] ?? null,
            );
            $result = $service->updateDisplayName($claims['sub'], $normalized);
        } catch (InvalidArgumentException $e) {
            return JsonResponse::error($e->getMessage(), 422);
        } catch (RuntimeException $e) {
            return $this->mapRuntimeError($e);
        } catch (Throwable) {
            return JsonResponse::error('Internal error', 500);
        }

        return JsonResponse::ok($result);
    }

    public function deleteMe(?string $authorization): JsonResponse
    {
        try {
            $claims = ($this->auth ?? new SupabaseAuthService())->validateBearer($authorization);
        } catch (AuthException $e) {
            return JsonResponse::error($e->getMessage(), 401);
        }

        try {
            ($this->parents ?? new ParentAccountService())->deleteAccount($claims['sub']);
        } catch (RuntimeException $e) {
            return $this->mapRuntimeError($e);
        } catch (Throwable) {
            return JsonResponse::error('Internal error', 500);
        }

        return JsonResponse::ok(['deleted' => true]);
    }

    private function mapRuntimeError(RuntimeException $e): JsonResponse
    {
        $message = $e->getMessage();
        if ($message === 'DATABASE_URL not configured' || $message === 'Database unavailable') {
            return JsonResponse::error($message, 503);
        }
        if ($message === 'Parent account not found') {
            return JsonResponse::error($message, 404);
        }

        return JsonResponse::error('Internal error', 500);
    }
}
