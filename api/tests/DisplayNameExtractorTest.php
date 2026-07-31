<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Shared\Text\DisplayNameExtractor;
use PHPUnit\Framework\TestCase;

final class DisplayNameExtractorTest extends TestCase
{
    public function testPickBestFromExplicitPhrase(): void
    {
        $name = DisplayNameExtractor::pickBest(
            'Quiero que mi personaje se llame: Vatardar. Será un aprendiz de mago.',
        );
        self::assertSame('Vatardar', $name);
    }

    public function testPickBestShortDirectName(): void
    {
        self::assertSame('Luna', DisplayNameExtractor::pickBest('Luna'));
    }

    public function testRejectsLongDescriptionWithoutName(): void
    {
        self::assertNull(
            DisplayNameExtractor::pickBest(
                'Será un aprendiz de mago en un mundo de fantasía. Es un poco miedoso.',
            ),
        );
    }

    public function testCandidatesFromQuotes(): void
    {
        $candidates = DisplayNameExtractor::candidates('Me llamo "Nerea Star" y listo');
        self::assertContains('Nerea Star', $candidates);
    }
}
