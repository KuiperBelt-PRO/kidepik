<?php

declare(strict_types=1);

namespace Kidepik\Api\Controllers;

use InvalidArgumentException;
use Kidepik\Api\Http\JsonResponse;
use Kidepik\Api\Services\AuthException;
use Kidepik\Api\Services\CrewService;
use Kidepik\Api\Services\ParentAccountService;
use Kidepik\Api\Services\SupabaseAuthService;
use RuntimeException;
use Throwable;

final class CrewController
{
    public function __construct(
        private readonly ?SupabaseAuthService $auth = null,
        private readonly ?CrewService $crew = null,
        private readonly ?ParentAccountService $parents = null,
    ) {
    }

    public function index(?string $authorization): JsonResponse
    {
        return $this->withParent($authorization, function (string $authUserId) {
            return JsonResponse::ok(($this->crew ?? new CrewService())->listForAuthUser($authUserId));
        });
    }

    public function create(?string $authorization, ?string $rawBody): JsonResponse
    {
        return $this->withParent($authorization, function (string $authUserId) use ($rawBody) {
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
            try {
                $result = ($this->crew ?? new CrewService())->createForAuthUser($authUserId, $payload);
            } catch (InvalidArgumentException $e) {
                return JsonResponse::error($e->getMessage(), 422);
            }

            return JsonResponse::ok($result, 201);
        });
    }

    public function show(?string $authorization, string $childId): JsonResponse
    {
        return $this->withParent($authorization, function (string $authUserId) use ($childId) {
            try {
                return JsonResponse::ok(($this->crew ?? new CrewService())->getForAuthUser($authUserId, $childId));
            } catch (RuntimeException $e) {
                if ($e->getMessage() === 'Crew member not found') {
                    return JsonResponse::error($e->getMessage(), 404);
                }
                throw $e;
            }
        });
    }

    public function update(?string $authorization, string $childId, ?string $rawBody): JsonResponse
    {
        return $this->withParent($authorization, function (string $authUserId) use ($childId, $rawBody) {
            $payload = $this->decodeBody($rawBody);
            if ($payload instanceof JsonResponse) {
                return $payload;
            }
            try {
                return JsonResponse::ok(
                    ($this->crew ?? new CrewService())->updateProfileForAuthUser($authUserId, $childId, $payload),
                );
            } catch (InvalidArgumentException $e) {
                return JsonResponse::error($e->getMessage(), 422);
            } catch (RuntimeException $e) {
                if ($e->getMessage() === 'Crew member not found') {
                    return JsonResponse::error($e->getMessage(), 404);
                }
                throw $e;
            }
        });
    }

    public function updatePermissions(?string $authorization, string $childId, ?string $rawBody): JsonResponse
    {
        return $this->withParent($authorization, function (string $authUserId) use ($childId, $rawBody) {
            $payload = $this->decodeBody($rawBody);
            if ($payload instanceof JsonResponse) {
                return $payload;
            }
            try {
                return JsonResponse::ok(
                    ($this->crew ?? new CrewService())->updatePermissionsForAuthUser($authUserId, $childId, $payload),
                );
            } catch (InvalidArgumentException $e) {
                return JsonResponse::error($e->getMessage(), 422);
            } catch (RuntimeException $e) {
                if ($e->getMessage() === 'Crew member not found') {
                    return JsonResponse::error($e->getMessage(), 404);
                }
                throw $e;
            }
        });
    }

    public function destroy(?string $authorization, string $childId, ?string $rawBody): JsonResponse
    {
        return $this->withParent($authorization, function (string $authUserId) use ($childId, $rawBody) {
            $confirm = false;
            if ($rawBody !== null && trim($rawBody) !== '') {
                try {
                    $decoded = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);
                    if (is_array($decoded)) {
                        $confirm = ($decoded['confirm'] ?? false) === true;
                    }
                } catch (Throwable) {
                    return JsonResponse::error('Invalid JSON', 422);
                }
            }
            try {
                return JsonResponse::ok(
                    ($this->crew ?? new CrewService())->softDeleteForAuthUser($authUserId, $childId, $confirm),
                );
            } catch (InvalidArgumentException $e) {
                return JsonResponse::error($e->getMessage(), 422);
            } catch (RuntimeException $e) {
                if ($e->getMessage() === 'Crew member not found') {
                    return JsonResponse::error($e->getMessage(), 404);
                }
                throw $e;
            }
        });
    }

    /**
     * @param callable(string): JsonResponse $fn
     */
    private function withParent(?string $authorization, callable $fn): JsonResponse
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
            ($this->parents ?? new ParentAccountService())->getOrBootstrap(
                $claims['sub'],
                $email,
                $claims['display_name'] ?? null,
                $claims['avatar_url'] ?? null,
            );

            return $fn($claims['sub']);
        } catch (RuntimeException $e) {
            $message = $e->getMessage();
            if ($message === 'DATABASE_URL not configured' || $message === 'Database unavailable') {
                return JsonResponse::error($message, 503);
            }
            if ($message === 'Parent account not found') {
                return JsonResponse::error($message, 404);
            }

            return JsonResponse::error('Internal error', 500);
        } catch (Throwable) {
            return JsonResponse::error('Internal error', 500);
        }
    }

    /**
     * @return array<string, mixed>|JsonResponse
     */
    private function decodeBody(?string $rawBody): array|JsonResponse
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
}
