<?php

declare(strict_types=1);

namespace Kidepik\Shared\Storage;

final class UploadPlan
{
    public function __construct(
        public readonly string $uploadUrl,
        public readonly string $method,
        /** @var array<string, string> */
        public readonly array $fields,
        public readonly string $publicUrl,
        public readonly string $token,
        public readonly int $expiresIn,
    ) {
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        $upload = [
            'url' => $this->uploadUrl,
            'method' => $this->method,
        ];

        if ($this->fields !== []) {
            $upload['fields'] = $this->fields;
        }

        return [
            'upload' => $upload,
            'public_url' => $this->publicUrl,
            'expires_in' => $this->expiresIn,
            'token' => $this->token,
        ];
    }
}
