<?php

declare(strict_types=1);

namespace Kidepik\Api\Http;

final class JsonResponse
{
    /** @param array<string, string> $headers */
    public function __construct(
        public readonly int $status,
        public readonly string $body,
        public readonly array $headers = ['Content-Type' => 'application/json; charset=utf-8'],
    ) {
    }

    /** @param array<string, mixed> $data */
    public static function ok(array $data, int $status = 200): self
    {
        return new self(
            $status,
            json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        );
    }

    public static function error(string $message, int $status): self
    {
        return self::ok(['detail' => $message], $status);
    }
}
