<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Shared\Text\Utf8Text;
use PHPUnit\Framework\TestCase;

final class Utf8TextTest extends TestCase
{
    public function testNormalizePreservesSpanishAccents(): void
    {
        $text = 'No es un trámite: es el mapa de tu viaje.';
        self::assertSame($text, Utf8Text::normalize($text));
        self::assertStringContainsString('trámite', Utf8Text::normalize($text));
    }

    public function testNormalizeRepairsInvalidUtf8Sequences(): void
    {
        $broken = "tr\xC3" . 'mite';
        $fixed = Utf8Text::normalize($broken);
        self::assertTrue(mb_check_encoding($fixed, 'UTF-8'));
    }

    public function testScrubMentorLexiconReplacesArmarExamen(): void
    {
        $text = 'Voy a armar el examen antes de que entres al umbral.';
        $scrubbed = Utf8Text::normalize($text);
        self::assertStringNotContainsStringIgnoringCase('armar', $scrubbed);
        self::assertStringContainsString('preparar la prueba', $scrubbed);
    }
}
