<?php

declare(strict_types=1);

namespace Kidepik\Api\Controllers;

use Kidepik\Api\Http\JsonResponse;
use Kidepik\Shared\Config;

final class HealthController
{
    public function show(): JsonResponse
    {
        return JsonResponse::ok([
            'status' => 'ok',
            'service' => Config::appName(),
        ]);
    }
}
