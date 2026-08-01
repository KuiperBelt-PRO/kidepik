<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use InvalidArgumentException;

final class PlacementComposeFailedException extends InvalidArgumentException
{
    /**
     * @param array<string, mixed> $composeDebug
     */
    public function __construct(public readonly array $composeDebug)
    {
        parent::__construct('placement_compose_failed');
    }
}
