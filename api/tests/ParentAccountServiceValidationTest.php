<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use InvalidArgumentException;
use Kidepik\Api\Services\ParentAccountService;
use PHPUnit\Framework\TestCase;

final class ParentAccountServiceValidationTest extends TestCase
{
    public function testNonStringDisplayNameFails(): void
    {
        $this->expectException(InvalidArgumentException::class);
        ParentAccountService::normalizeDisplayName(123);
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function invalidDisplayNamesProvider(): iterable
    {
        yield 'invalid chars' => ['ada@mail'];
        yield 'emoji' => ['Ada 🚀'];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('invalidDisplayNamesProvider')]
    public function testInvalidDisplayNames(string $value): void
    {
        $this->expectException(InvalidArgumentException::class);
        ParentAccountService::normalizeDisplayName($value);
    }
}
