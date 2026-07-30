<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Shared\Storage\UploadTokenStore;
use PHPUnit\Framework\TestCase;

final class UploadTokenStoreTest extends TestCase
{
    private string $dir;

    public function setUp(): void
    {
        $this->dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'kidepik-tokens-' . bin2hex(random_bytes(4));
    }

    public function tearDown(): void
    {
        if (is_dir($this->dir)) {
            foreach (scandir($this->dir) ?: [] as $entry) {
                if ($entry === '.' || $entry === '..') {
                    continue;
                }
                unlink($this->dir . DIRECTORY_SEPARATOR . $entry);
            }
            rmdir($this->dir);
        }
    }

    public function testCreateAndConsumeToken(): void
    {
        $store = new UploadTokenStore($this->dir);
        $token = $store->create('user', 'poc', 'poc/user/file.txt', '/media/poc/user/file.txt', 60);

        $meta = $store->consume($token);

        self::assertNotNull($meta);
        self::assertSame('user', $meta['user_id']);
        self::assertSame('poc', $meta['category']);
        self::assertSame('poc/user/file.txt', $meta['object_key']);
        self::assertNull($store->consume($token));
    }

    public function testExpiredTokenReturnsNull(): void
    {
        $store = new UploadTokenStore($this->dir);
        $token = $store->create('user', 'poc', 'key', '/media/key', -1);

        self::assertNull($store->consume($token));
    }

    public function testInvalidTokenFormatThrows(): void
    {
        $store = new UploadTokenStore($this->dir);

        $this->expectException(\InvalidArgumentException::class);
        $store->consume('not-a-valid-token');
    }

    public function testConsumeCorruptJsonReturnsNull(): void
    {
        $store = new UploadTokenStore($this->dir);
        $token = bin2hex(random_bytes(16));
        file_put_contents($this->dir . DIRECTORY_SEPARATOR . $token . '.json', 'not-json');

        self::assertNull($store->consume($token));
    }

    public function testConsumeWithUnreadablePathReturnsNull(): void
    {
        $store = new UploadTokenStore($this->dir);

        self::assertNull($store->consume(bin2hex(random_bytes(16))));
    }
}
