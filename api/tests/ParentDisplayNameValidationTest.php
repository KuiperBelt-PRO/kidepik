<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Services\ParentAccountService;
use PHPUnit\Framework\TestCase;

final class ParentDisplayNameValidationTest extends TestCase
{
    public function testEmptyBecomesNull(): void
    {
        self::assertNull(ParentAccountService::normalizeDisplayName(''));
        self::assertNull(ParentAccountService::normalizeDisplayName('   '));
        self::assertNull(ParentAccountService::normalizeDisplayName(null));
    }

    public function testValidNamesPass(): void
    {
        self::assertSame('Ada', ParentAccountService::normalizeDisplayName('Ada'));
        self::assertSame("O'Connor", ParentAccountService::normalizeDisplayName("O'Connor"));
        self::assertSame('Ada-Lovelace', ParentAccountService::normalizeDisplayName('Ada-Lovelace'));
    }

    public function testTooLongFails(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        ParentAccountService::normalizeDisplayName(str_repeat('a', 41));
    }

    public function testAtSignFails(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        ParentAccountService::normalizeDisplayName('ada@mail');
    }
}
