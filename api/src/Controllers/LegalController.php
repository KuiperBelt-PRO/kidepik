<?php

declare(strict_types=1);

namespace Kidepik\Api\Controllers;

use Kidepik\Api\Http\JsonResponse;
use Kidepik\Api\Services\DatabaseService;

final class LegalController
{
    private const SLUG_ALIASES = [
        'terms' => 'terms',
        'terminos' => 'terms',
        'privacy' => 'privacy',
        'privacidad' => 'privacy',
    ];

    public function __construct(
        private readonly ?DatabaseService $database = null,
    ) {
    }

    public function show(string $slugParam): JsonResponse
    {
        $slug = self::SLUG_ALIASES[strtolower($slugParam)] ?? null;
        if ($slug === null) {
            return JsonResponse::error('Not Found', 404);
        }

        $db = $this->database ?? new DatabaseService();
        $doc = $db->latestLegalDocument($slug);
        if ($doc === null) {
            return JsonResponse::error('Not Found', 404);
        }

        return JsonResponse::ok($doc);
    }
}
