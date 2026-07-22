<?php

declare(strict_types=1);

namespace Kidepik\Api\Controllers;

use Kidepik\Api\Http\JsonResponse;
use Kidepik\Shared\Database\MigrationRunner;

final class MigrationsController
{
    public function __construct(
        private readonly ?MigrationRunner $runner = null,
    ) {
    }

    public function status(): JsonResponse
    {
        $runner = $this->runner ?? MigrationRunner::fromEnv();
        $status = $runner->status();

        return JsonResponse::ok($status, ($status['ok'] ?? false) ? 200 : 503);
    }
}
