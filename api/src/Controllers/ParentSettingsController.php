<?php

declare(strict_types=1);

namespace Kidepik\Api\Controllers;

use InvalidArgumentException;
use Kidepik\Api\Http\JsonResponse;
use Kidepik\Api\Services\AuthException;
use Kidepik\Api\Services\ParentSettingsRepository;
use Kidepik\Api\Services\SupabaseAuthService;
use RuntimeException;
use Throwable;

final class ParentSettingsController
{
    public function __construct(
        private readonly ?SupabaseAuthService $auth = null,
        private readonly ?ParentSettingsRepository $settings = null,
    ) {
    }

    public function show(?string $authorization): JsonResponse
    {
        return $this->withAuth($authorization, function (array $claims) {
            $email = $claims['email'] ?? '';
            if ($email === '') {
                return JsonResponse::error('Email required', 422);
            }

            $result = ($this->settings ?? new ParentSettingsRepository())->getForAuthUser(
                $claims['sub'],
                $email,
                $claims['display_name'] ?? null,
                $claims['avatar_url'] ?? null,
            );

            return JsonResponse::ok($result);
        });
    }

    public function update(?string $authorization, ?string $rawBody): JsonResponse
    {
        return $this->withAuth($authorization, function (array $claims) use ($rawBody) {
            $email = $claims['email'] ?? '';
            if ($email === '') {
                return JsonResponse::error('Email required', 422);
            }

            $payload = $this->decodeObjectBody($rawBody);
            if ($payload instanceof JsonResponse) {
                return $payload;
            }

            try {
                $result = ($this->settings ?? new ParentSettingsRepository())->patchForAuthUser(
                    $claims['sub'],
                    $email,
                    $payload,
                    $claims['display_name'] ?? null,
                    $claims['avatar_url'] ?? null,
                );
            } catch (InvalidArgumentException $e) {
                return JsonResponse::error($e->getMessage(), 422);
            }

            return JsonResponse::ok($result);
        });
    }

    /**
     * @param callable(array<string, mixed>): JsonResponse $fn
     */
    private function withAuth(?string $authorization, callable $fn): JsonResponse
    {
        try {
            $claims = ($this->auth ?? new SupabaseAuthService())->validateBearer($authorization);
        } catch (AuthException $e) {
            return JsonResponse::error($e->getMessage(), 401);
        }

        try {
            return $fn($claims);
        } catch (RuntimeException $e) {
            return $this->mapRuntimeError($e);
        } catch (Throwable) {
            return JsonResponse::error('Internal error', 500);
        }
    }

    /**
     * @return array<string, mixed>|JsonResponse
     */
    private function decodeObjectBody(?string $rawBody): array|JsonResponse
    {
        if ($rawBody === null || trim($rawBody) === '') {
            return JsonResponse::error('Body required', 422);
        }
        try {
            $decoded = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            return JsonResponse::error('Invalid JSON', 422);
        }
        if (!is_array($decoded)) {
            return JsonResponse::error('Invalid JSON', 422);
        }

        return $decoded;
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
