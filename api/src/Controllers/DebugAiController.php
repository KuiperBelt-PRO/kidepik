<?php

declare(strict_types=1);

namespace Kidepik\Api\Controllers;

use Kidepik\Api\Http\JsonResponse;
use Kidepik\Api\Services\AuthException;
use Kidepik\Api\Services\DebugAiService;
use Kidepik\Api\Services\ParentAccountService;
use Kidepik\Api\Services\SupabaseAuthService;
use Kidepik\Shared\Config;
use RuntimeException;
use Throwable;

final class DebugAiController
{
    public function __construct(
        private readonly ?SupabaseAuthService $auth = null,
        private readonly ?DebugAiService $service = null,
        private readonly ?ParentAccountService $parents = null,
    ) {
    }

    public function status(?string $authorization): JsonResponse
    {
        if (!Config::aiDebugEnabled()) {
            return JsonResponse::error('Not Found', 404);
        }

        return $this->withParent($authorization, function (): JsonResponse {
            return JsonResponse::ok(($this->service ?? new DebugAiService())->status());
        });
    }

    public function queues(?string $authorization): JsonResponse
    {
        if (!Config::aiDebugEnabled()) {
            return JsonResponse::error('Not Found', 404);
        }

        return $this->withParent($authorization, function (): JsonResponse {
            $purpose = isset($_GET['purpose']) && is_string($_GET['purpose']) ? $_GET['purpose'] : null;

            return JsonResponse::ok([
                'rows' => ($this->service ?? new DebugAiService())->queues($purpose),
            ]);
        });
    }

    public function resolve(?string $authorization): JsonResponse
    {
        if (!Config::aiDebugEnabled()) {
            return JsonResponse::error('Not Found', 404);
        }

        return $this->withParent($authorization, function (): JsonResponse {
            $purpose = isset($_GET['purpose']) && is_string($_GET['purpose'])
                ? $_GET['purpose']
                : 'placement_exam_composer';

            return JsonResponse::ok(($this->service ?? new DebugAiService())->resolve($purpose));
        });
    }

    public function attempts(?string $authorization): JsonResponse
    {
        if (!Config::aiDebugEnabled()) {
            return JsonResponse::error('Not Found', 404);
        }

        return $this->withParent($authorization, function (): JsonResponse {
            $limit = isset($_GET['limit']) && is_numeric($_GET['limit']) ? (int) $_GET['limit'] : 20;

            return JsonResponse::ok([
                'attempts' => ($this->service ?? new DebugAiService())->attempts($limit),
            ]);
        });
    }

    public function ping(?string $authorization, ?string $rawBody): JsonResponse
    {
        if (!Config::aiDebugEnabled()) {
            return JsonResponse::error('Not Found', 404);
        }

        $payload = $this->decode($rawBody);

        return $this->withParent($authorization, function () use ($payload): JsonResponse {
            $childId = isset($payload['child_id']) && is_string($payload['child_id']) ? $payload['child_id'] : null;

            return JsonResponse::ok(($this->service ?? new DebugAiService())->ping($childId));
        });
    }

    /**
     * @param callable():JsonResponse $fn
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

            return $fn();
        } catch (RuntimeException $e) {
            $message = $e->getMessage();
            if ($message === 'DATABASE_URL not configured' || $message === 'Database unavailable') {
                return JsonResponse::error($message, 503);
            }

            return JsonResponse::error('Internal error', 500);
        } catch (Throwable) {
            return JsonResponse::error('Internal error', 500);
        }
    }

    /** @return array<string,mixed> */
    private function decode(?string $rawBody): array
    {
        if ($rawBody === null || trim($rawBody) === '') {
            return [];
        }
        $data = json_decode($rawBody, true);

        return is_array($data) ? $data : [];
    }
}
