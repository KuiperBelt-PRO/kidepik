<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Shared\Storage\StorageDriverFactory;
use PHPUnit\Framework\TestCase;

final class StorageDriverFactoryTest extends TestCase
{
    public function testCreateLocalDriver(): void
    {
        $driver = StorageDriverFactory::create();

        self::assertSame('local', $driver->status()['driver']);
    }
}
