<?php

declare(strict_types=1);

namespace Kidepik\Api\Controllers;

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
            $message = $e->getMessage();
            if ($message === 'DATABASE_URL not configured' || $message === 'Database unavailable') {
                return JsonResponse::error($message, 503);
            }

            return JsonResponse::error('Internal error', 500);
        } catch (Throwable) {
            return JsonResponse::error('Internal error', 500);
        }

        return JsonResponse::ok($result);
    }
}
