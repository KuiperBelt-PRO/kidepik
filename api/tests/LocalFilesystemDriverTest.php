<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Shared\Storage\LocalFilesystemDriver;
use Kidepik\Shared\Storage\UploadTokenStore;
use PHPUnit\Framework\TestCase;

final class LocalFilesystemDriverTest extends TestCase
{
    private string $root;

    public function setUp(): void
    {
        $this->root = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'kidepik-media-' . bin2hex(random_bytes(4));
        mkdir($this->root, 0775, true);
    }

    public function tearDown(): void
    {
        $this->removeTree($this->root);
    }

    public function testPrepareUploadReturnsPlan(): void
    {
        $tokens = new UploadTokenStore($this->root . '/.tokens');
        $driver = new LocalFilesystemDriver($this->root, '/media', $tokens);

        $plan = $driver->prepareUpload('user-1', 'photo.png', 'avatars');

        self::assertSame('/api/v1/storage/upload', $plan->uploadUrl);
        self::assertSame('POST', $plan->method);
        self::assertArrayHasKey('token', $plan->fields);
        self::assertStringStartsWith('/media/avatars/user-1/', $plan->publicUrl);
    }

    public function testInvalidCategoryRejected(): void
    {
        $tokens = new UploadTokenStore($this->root . '/.tokens');
        $driver = new LocalFilesystemDriver($this->root, '/media', $tokens);

        $this->expectException(\InvalidArgumentException::class);
        $driver->prepareUpload('user-1', 'x.bin', 'invalid');
    }

    public function testCompleteUploadStoresFile(): void
    {
        $tokens = new UploadTokenStore($this->root . '/.tokens');
        $driver = new LocalFilesystemDriver($this->root, '/media', $tokens);
        $plan = $driver->prepareUpload('user-1', 'note.txt', 'poc');

        $tmp = $this->root . '/tmp-upload.txt';
        file_put_contents($tmp, 'hello');

        $publicUrl = $driver->completeUpload($plan->token, $tmp);

        self::assertStringStartsWith('/media/', $publicUrl);
        self::assertFileDoesNotExist($tmp);
    }

    public function testStatusReportsWritableRoot(): void
    {
        $tokens = new UploadTokenStore($this->root . '/.tokens');
        $driver = new LocalFilesystemDriver($this->root, '/media', $tokens);
        $status = $driver->status();

        self::assertTrue($status['ok']);
        self::assertSame('local', $status['driver']);
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
