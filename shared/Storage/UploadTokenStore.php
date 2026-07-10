<?php

declare(strict_types=1);

namespace Kidepik\Shared\Storage;

final class UploadTokenStore
{
    public function __construct(private readonly string $directory)
    {
        if (!is_dir($this->directory) && !mkdir($this->directory, 0775, true) && !is_dir($this->directory)) {
            throw new \RuntimeException('Cannot create upload token directory');
        }
    }

    /** @return array{user_id: string, category: string, object_key: string, public_url: string}|null */
    public function consume(string $token): ?array
    {
        $path = $this->pathFor($token);
        if (!is_readable($path)) {
            return null;
        }

        $raw = file_get_contents($path);
        if ($raw === false) {
            return null;
        }

        unlink($path);

        /** @var array<string, mixed>|null $data */
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            return null;
        }

        $expires = (int) ($data['expires_at'] ?? 0);
        if ($expires < time()) {
            return null;
        }

        return [
            'user_id' => (string) ($data['user_id'] ?? ''),
            'category' => (string) ($data['category'] ?? ''),
            'object_key' => (string) ($data['object_key'] ?? ''),
            'public_url' => (string) ($data['public_url'] ?? ''),
        ];
    }

    public function create(
        string $userId,
        string $category,
        string $objectKey,
        string $publicUrl,
        int $ttlSeconds,
    ): string {
        $token = bin2hex(random_bytes(16));
        $payload = json_encode([
            'user_id' => $userId,
            'category' => $category,
            'object_key' => $objectKey,
            'public_url' => $publicUrl,
            'expires_at' => time() + $ttlSeconds,
        ], JSON_THROW_ON_ERROR);

        file_put_contents($this->pathFor($token), $payload, LOCK_EX);

        return $token;
    }

    private function pathFor(string $token): string
    {
        if (!preg_match('/^[a-f0-9]{32}$/', $token)) {
            throw new \InvalidArgumentException('Invalid upload token');
        }

        return $this->directory . DIRECTORY_SEPARATOR . $token . '.json';
    }
}
