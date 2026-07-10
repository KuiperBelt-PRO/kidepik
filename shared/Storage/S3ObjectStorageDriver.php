<?php

declare(strict_types=1);

namespace Kidepik\Shared\Storage;

/** Stub for future Cloudflare R2 / S3 migration — see SPEC_MEDIA_STORAGE.md */
final class S3ObjectStorageDriver implements StorageDriver
{
    public function prepareUpload(string $userId, string $filename, string $category): UploadPlan
    {
        throw new \RuntimeException('S3 storage driver is not implemented yet');
    }

    public function completeUpload(string $token, string $tmpPath): string
    {
        throw new \RuntimeException('S3 storage driver is not implemented yet');
    }

    public function status(): array
    {
        return [
            'ok' => false,
            'driver' => 's3',
            'error' => 'not_implemented',
        ];
    }
}
