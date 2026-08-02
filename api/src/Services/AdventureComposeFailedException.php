<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use InvalidArgumentException;

final class AdventureComposeFailedException extends InvalidArgumentException
{
    /**
     * @param array<string, mixed> $composeDebug
     */
    public function __construct(public readonly array $composeDebug)
    {
        parent::__construct('adventure_compose_failed');
    }
}
