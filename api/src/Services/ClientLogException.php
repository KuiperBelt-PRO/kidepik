<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use RuntimeException;

final class ClientLogException extends RuntimeException
{
    public function __construct(string $message, private readonly int $status = 422)
    {
        parent::__construct($message);
    }

    public function status(): int
    {
        return $this->status;
    }
}
