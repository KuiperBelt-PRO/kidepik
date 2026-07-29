<?php

declare(strict_types=1);

namespace Kidepik\Shared\Storage;

use Kidepik\Shared\Config;

final class StorageDriverFactory
{
    public static function create(): StorageDriver
    {
        $driver = Config::storageDriver();

        return match ($driver) {
            'local' => new LocalFilesystemDriver(
                Config::mediaRoot(),
                Config::mediaPublicBaseUrl(),
                new UploadTokenStore(Config::mediaRoot() . '/.tokens'),
            ),
            default => throw new \RuntimeException(
                'Unsupported STORAGE_DRIVER: ' . $driver . ' (only "local" is supported)',
            ),
        };
    }
}
