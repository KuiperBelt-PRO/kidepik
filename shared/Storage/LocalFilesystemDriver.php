<?php

declare(strict_types=1);

namespace Kidepik\Shared\Storage;

use Kidepik\Shared\Config;

final class LocalFilesystemDriver implements StorageDriver
{
    /** @var list<string> */
    private const ALLOWED_CATEGORIES = ['avatars', 'audio', 'pdf', 'illustrations', 'poc'];

    public function __construct(
        private readonly string $mediaRoot,
        private readonly string $publicBaseUrl,
        private readonly UploadTokenStore $tokens,
    ) {
    }

    public function prepareUpload(string $userId, string $filename, string $category): UploadPlan
    {
        $this->assertCategory($category);

        $safeName = $this->sanitizeFilename($filename);
        $objectKey = sprintf('%s/%s/%s-%s', $category, $userId, bin2hex(random_bytes(8)), $safeName);
        $publicUrl = $this->publicBaseUrl . '/' . $objectKey;
        $token = $this->tokens->create($userId, $category, $objectKey, $publicUrl, Config::uploadTokenTtl());

        return new UploadPlan(
            uploadUrl: '/api/v1/storage/upload',
            method: 'POST',
            fields: [
                'token' => $token,
                'category' => $category,
            ],
            publicUrl: $publicUrl,
            token: $token,
            expiresIn: Config::uploadTokenTtl(),
        );
    }

    public function completeUpload(string $token, string $tmpPath): string
    {
        $meta = $this->tokens->consume($token);
        if ($meta === null) {
            throw new \RuntimeException('Invalid or expired upload token');
        }

        $targetPath = $this->mediaRoot . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $meta['object_key']);
        $dir = dirname($targetPath);
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new \RuntimeException('Cannot create media directory');
        }

        if (!move_uploaded_file($tmpPath, $targetPath) && !rename($tmpPath, $targetPath)) {
            throw new \RuntimeException('Failed to store uploaded file');
        }

        return $meta['public_url'];
    }

    public function status(): array
    {
        $writable = is_dir($this->mediaRoot) && is_writable($this->mediaRoot);

        return [
            'ok' => $writable,
            'driver' => 'local',
            'root' => $this->mediaRoot,
        ];
    }

    private function assertCategory(string $category): void
    {
        if (!in_array($category, self::ALLOWED_CATEGORIES, true)) {
            throw new \InvalidArgumentException('Invalid media category');
        }
    }

    private function sanitizeFilename(string $filename): string
    {
        $basename = basename(str_replace(['\\', '/'], '_', $filename));
        $basename = preg_replace('/[^a-zA-Z0-9._-]/', '_', $basename) ?? 'upload.bin';

        return $basename !== '' ? $basename : 'upload.bin';
    }
}
