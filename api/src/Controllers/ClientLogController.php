<?php

declare(strict_types=1);

namespace Kidepik\Api\Controllers;

use JsonException;
use Kidepik\Api\Http\JsonResponse;
use Kidepik\Api\Services\ClientLogException;
use Kidepik\Api\Services\ClientLogService;
use Kidepik\Api\Services\SupabaseAuthService;
use Throwable;

final class ClientLogController
{
    public function __construct(
        private readonly ?SupabaseAuthService $auth = null,
        private readonly ?ClientLogService $service = null,
    ) {
    }

    public function ingest(?string $authorization, ?string $body): JsonResponse
    {
        try {
            /** @var array<string, mixed> $payload */
            $payload = json_decode($body ?? '{}', true, 32, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return JsonResponse::error('Invalid JSON', 422);
        }

        $authUserId = $this->optionalAuthUserId($authorization);

        try {
            $result = ($this->service ?? new ClientLogService())->ingest($payload, $authUserId);

            return JsonResponse::ok($result);
        } catch (ClientLogException $e) {
            return JsonResponse::error($e->getMessage(), $e->status());
        }
    }

    private function optionalAuthUserId(?string $authorization): ?string
    {
        if ($authorization === null) {
            return null;
        }

        try {
            $claims = ($this->auth ?? new SupabaseAuthService())->validateBearer($authorization);

            return $claims['sub'];
        } catch (Throwable) {
            return null;
        }
    }
}
