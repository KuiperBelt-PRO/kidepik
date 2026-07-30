<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Shared\Storage\LocalFilesystemDriver;
use Kidepik\Shared\Storage\UploadTokenStore;
use PHPUnit\Framework\TestCase;

final class LocalFilesystemDriverExtendedTest extends TestCase
{
    private string $root;

    public function setUp(): void
    {
        $this->root = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'kidepik-media-ext-' . bin2hex(random_bytes(4));
        mkdir($this->root, 0775, true);
    }

    public function tearDown(): void
    {
        $this->removeTree($this->root);
    }

    public function testSanitizeFilenameStripsPath(): void
    {
        $tokens = new UploadTokenStore($this->root . '/.tokens');
        $driver = new LocalFilesystemDriver($this->root, '/media', $tokens);

        $plan = $driver->prepareUpload('user-1', '../evil/name.png', 'poc');

        self::assertStringContainsString('evil_name.png', $plan->publicUrl);
        self::assertStringNotContainsString('/evil/', $plan->publicUrl);
    }

    public function testCompleteUploadInvalidToken(): void
    {
        $tokens = new UploadTokenStore($this->root . '/.tokens');
        $driver = new LocalFilesystemDriver($this->root, '/media', $tokens);

        $this->expectException(\InvalidArgumentException::class);
        $driver->completeUpload('not-a-token', $this->root . '/tmp.txt');
    }

    public function testStatusOnMissingWritableRoot(): void
    {
        $missing = $this->root . '/missing-sub';
        $tokens = new UploadTokenStore($this->root . '/.tokens');
        $driver = new LocalFilesystemDriver($missing, '/media', $tokens);
        $status = $driver->status();

        self::assertFalse($status['ok']);
    }

    public function testCompleteUploadFailsWhenTargetDirectoryCannotBeCreated(): void
    {
        $tokens = new UploadTokenStore($this->root . '/.tokens');
        $blockedRoot = $this->root . '/blocked-root';
        file_put_contents($blockedRoot, 'not-a-directory');
        $driver = new LocalFilesystemDriver($blockedRoot, '/media', $tokens);
        $plan = $driver->prepareUpload('user-1', 'file.txt', 'poc');
        $tmp = $this->root . '/tmp-missing.txt';

        set_error_handler(static fn (): bool => true);
        try {
            $this->expectException(\RuntimeException::class);
            $driver->completeUpload($plan->token, $tmp);
        } finally {
            restore_error_handler();
        }
    }

    public function testSanitizeFilenameFallback(): void
    {
        $tokens = new UploadTokenStore($this->root . '/.tokens');
        $driver = new LocalFilesystemDriver($this->root, '/media', $tokens);

        $plan = $driver->prepareUpload('user-1', '###', 'poc');

        self::assertStringContainsString('___', $plan->publicUrl);
    }

    public function testCompleteUploadFailsWhenTmpFileMissing(): void
    {
        $tokens = new UploadTokenStore($this->root . '/.tokens');
        $driver = new LocalFilesystemDriver($this->root, '/media', $tokens);
        $plan = $driver->prepareUpload('user-1', 'lost.txt', 'poc');

        set_error_handler(static fn (): bool => true);
        try {
            $this->expectException(\RuntimeException::class);
            $driver->completeUpload($plan->token, $this->root . '/missing-tmp.bin');
        } finally {
            restore_error_handler();
        }
    }

    private function removeTree(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        foreach (scandir($dir) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            $path = $dir . DIRECTORY_SEPARATOR . $entry;
            if (is_dir($path)) {
                $this->removeTree($path);
            } else {
                unlink($path);
            }
        }
        rmdir($dir);
    }
}
