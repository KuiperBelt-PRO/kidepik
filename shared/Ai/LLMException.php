<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

final class LLMException extends \RuntimeException
{
    public function __construct(string $message, public readonly int $status = 0)
    {
        parent::__construct($message);
    }
}
