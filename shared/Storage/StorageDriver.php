<?php

declare(strict_types=1);

namespace Kidepik\Shared\Storage;

interface StorageDriver
{
    public function prepareUpload(string $userId, string $filename, string $category): UploadPlan;

    public function completeUpload(string $token, string $tmpPath): string;

    public function status(): array;
}
