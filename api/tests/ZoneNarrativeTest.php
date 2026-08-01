<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Services\AdventureService;
use Kidepik\Shared\Ai\ZoneNarrativeCatalog;
use PHPUnit\Framework\TestCase;

final class ZoneNarrativeTest extends TestCase
{
    public function testLogicArrivalIsNotForestCopy(): void
    {
        $text = ZoneNarrativeCatalog::arrivalText('fantasy', 'zone_logic', 'Vatardar');
        self::assertStringContainsString('Espejos', $text);
        self::assertStringNotContainsString('Bosque de los Números', $text);
        self::assertStringNotContainsString('musgo', $text);
    }

    public function testZonePitchesExcludeCompleted(): void
    {
        $levels = [
            'math' => 'L1',
            'language' => 'L2',
            'logic' => 'L3',
            'science' => 'L4',
            'culture' => 'L5',
        ];
        $all = AdventureService::zonePitches('fantasy', $levels, 3, []);
        $filtered = AdventureService::zonePitches('fantasy', $levels, 3, ['zone_math', 'zone_language']);
        $ids = array_column($filtered, 'id');
        self::assertNotContains('zone_math', $ids);
        self::assertNotContains('zone_language', $ids);
        self::assertLessThanOrEqual(count($all), count($filtered));
    }

    public function testCompletedZoneIdsFromSettings(): void
    {
        $ids = AdventureService::completedZoneIds([
            'settings' => ['journey' => ['zones_completed' => ['zone_logic', 'zone_math']]],
        ]);
        self::assertSame(['zone_logic', 'zone_math'], $ids);
    }

    public function testLogicChallengeIntroUsesMirrorVocabulary(): void
    {
        $prompt = 'Secuencia: 1, 2, 4, 8, … ¿Siguiente?';
        $text = ZoneNarrativeCatalog::challengeIntroText('fantasy', 'zone_logic', 0, 3, $prompt);
        self::assertStringContainsString('Vigía de los Espejos', $text);
        self::assertStringContainsString('cristal', $text);
        self::assertStringContainsString($prompt, $text);
        self::assertStringNotContainsString('sendero', mb_strtolower($text));
        self::assertStringNotContainsString('exige saber', mb_strtolower($text));
    }

    public function testMathChallengeIntroMayUseForestWords(): void
    {
        $text = ZoneNarrativeCatalog::challengeIntroText('fantasy', 'zone_math', 0, 3, '5 + 7 = ¿?');
        self::assertStringContainsString('runa', mb_strtolower($text));
        self::assertStringContainsString('bosque', mb_strtolower($text));
    }
}
