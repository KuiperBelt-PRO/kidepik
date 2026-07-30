<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Controllers\StorageController;
use Kidepik\Api\Services\SupabaseAuthService;
use Kidepik\Shared\Storage\StorageDriverFactory;
use PHPUnit\Framework\TestCase;

final class StorageControllerTest extends TestCase
{
    public function testPrepareUploadValidatesBody(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willReturn([
            'sub' => '11111111-1111-1111-1111-111111111111',
            'role' => 'authenticated',
        ]);

        $response = (new StorageController($auth))->prepareUpload('Bearer t', '{}');

        self::assertSame(422, $response->status);
    }

    public function testPrepareUploadSuccess(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willReturn([
            'sub' => '11111111-1111-1111-1111-111111111111',
            'role' => 'authenticated',
        ]);

        $response = (new StorageController($auth))->prepareUpload(
            'Bearer t',
            json_encode(['filename' => 'pic.png', 'category' => 'poc'], JSON_THROW_ON_ERROR),
        );

        self::assertSame(200, $response->status);
        $body = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('upload', $body);
        self::assertArrayHasKey('url', $body['upload']);
    }

    public function testUploadMissingToken(): void
    {
        $response = (new StorageController())->upload();

        self::assertSame(422, $response->status);
    }

    public function testUploadSuccessWithPreparedToken(): void
    {
        $root = sys_get_temp_dir() . '/kidepik-storage-' . bin2hex(random_bytes(4));
        mkdir($root, 0775, true);
        putenv('MEDIA_ROOT=' . $root);
        $_ENV['MEDIA_ROOT'] = $root;

        $tokens = new \Kidepik\Shared\Storage\UploadTokenStore($root . '/.tokens');
        $driver = new \Kidepik\Shared\Storage\LocalFilesystemDriver($root, '/media', $tokens);
        $plan = $driver->prepareUpload('user-1', 'note.txt', 'poc');

        $tmp = $root . '/tmp-upload.txt';
        file_put_contents($tmp, 'payload');
        $_POST = ['token' => $plan->token];
        $_FILES['file'] = ['error' => UPLOAD_ERR_OK, 'tmp_name' => $tmp];

        $response = (new StorageController())->upload();

        self::assertSame(200, $response->status);
        $body = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertStringStartsWith('/media/', $body['public_url']);

        $this->removeDir($root);
        $_POST = [];
        unset($_FILES['file']);
    }

    public function testPrepareUploadRejectsInvalidExtension(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willReturn([
            'sub' => '11111111-1111-1111-1111-111111111111',
            'role' => 'authenticated',
        ]);

        $response = (new StorageController($auth))->prepareUpload(
            'Bearer t',
            json_encode(['filename' => '', 'category' => 'poc'], JSON_THROW_ON_ERROR),
        );

        self::assertSame(422, $response->status);
    }

    public function testUploadBadTokenReturns400(): void
    {
        $tmp = sys_get_temp_dir() . '/kidepik-upload-bad-' . bin2hex(random_bytes(4));
        file_put_contents($tmp, 'data');
        $_POST = ['token' => bin2hex(random_bytes(16))];
        $_FILES['file'] = ['error' => UPLOAD_ERR_OK, 'tmp_name' => $tmp];

        $response = (new StorageController())->upload();

        self::assertSame(400, $response->status);
        unlink($tmp);
        $_POST = [];
        unset($_FILES['file']);
    }

    private function removeDir(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        foreach (scandir($dir) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            $path = $dir . DIRECTORY_SEPARATOR . $entry;
            is_dir($path) ? $this->removeDir($path) : unlink($path);
        }
        rmdir($dir);
    }
}
