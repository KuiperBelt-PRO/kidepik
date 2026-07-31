<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Shared\Text\SpeciesExtractor;
use PHPUnit\Framework\TestCase;

final class SpeciesExtractorTest extends TestCase
{
    public function testPickBestFromSoyUnPhrase(): void
    {
        $species = SpeciesExtractor::pickBest(
            'Soy un Mago, aprendiz. He tardado en descubrir que tengo capacidades mágicas.',
        );
        self::assertSame('Mago Aprendiz', $species);
    }

    public function testPickBestFromShortDirect(): void
    {
        self::assertSame('Dragón Pequeño', SpeciesExtractor::pickBest('dragón pequeño'));
    }

    public function testRejectsEmpty(): void
    {
        self::assertNull(SpeciesExtractor::pickBest(''));
    }
}
