<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Router;
use PHPUnit\Framework\TestCase;

final class StorageTest extends TestCase
{
    public function testPrepareUploadRequiresAuth(): void
    {
        $response = (new Router())->dispatch(
            'POST',
            '/api/v1/storage/prepare-upload',
        );

        self::assertSame(401, $response->status);
    }
}
