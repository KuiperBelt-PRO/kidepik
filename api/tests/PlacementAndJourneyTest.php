<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Services\JourneyContextPack;
use Kidepik\Shared\Ai\FreeModelDiscovery;
use Kidepik\Shared\Ai\PlacementBank;
use PHPUnit\Framework\TestCase;

final class PlacementAndJourneyTest extends TestCase
{
    public function testPlacementBankScoresMcqAndNumeric(): void
    {
        $bank = PlacementBank::fromDefaultFile();
        $queue = $bank->pickQueue('band_child', ['math', 'language', 'logic'], 3);
        self::assertCount(3, $queue);

        $math = $queue[0];
        self::assertSame(1.0, $bank->score($math, [
            'kind' => 'option',
            'option_id' => (string) ($math['canonical_answer']['option_id'] ?? ''),
        ]));
        self::assertSame(0.0, $bank->score($math, ['kind' => 'option', 'option_id' => 'zzz']));

        $numeric = [
            'item_type' => 'numeric',
            'canonical_answer' => ['numeric' => 10, 'tolerance' => 0],
        ];
        self::assertSame(1.0, $bank->score($numeric, ['kind' => 'text', 'text' => '10']));
        self::assertSame(0.0, $bank->score($numeric, ['kind' => 'text', 'text' => '9']));
    }

    public function testPlacementComputeLevelsAndRank(): void
    {
        $bank = new PlacementBank([]);
        $levels = $bank->computeLevels([
            'math' => [1.0, 1.0],
            'language' => [0.0],
            'logic' => [0.5],
        ]);
        self::assertArrayHasKey('general', $levels);
        self::assertMatchesRegularExpression('/^L[1-5]$/', $levels['general']);

        $rank = $bank->rankForGeneral('fantasy', 'L3');
        self::assertSame('fantasy_adept', $rank['id']);
        self::assertSame('Adepto del artefacto', $rank['label_child']);

        $promoted = $bank->promoteBand('band_child', 'L5', ['math' => 'L5', 'language' => 'L4']);
        self::assertSame('band_tween', $promoted);
    }

    public function testFreeModelDiscoveryRanksFromFixture(): void
    {
        $discovery = new FreeModelDiscovery();
        $ids = $discovery->rankedIds([
            ['id' => 'z/other:free', 'pricing' => ['prompt' => '0', 'completion' => '0'], 'context_length' => 4096],
            ['id' => 'a/pref:free', 'pricing' => ['prompt' => '0', 'completion' => '0'], 'context_length' => 8192],
            ['id' => 'paid/x', 'pricing' => ['prompt' => '1', 'completion' => '1']],
        ]);
        self::assertContains('a/pref:free', $ids);
        self::assertContains('z/other:free', $ids);
        self::assertNotContains('paid/x', $ids);
    }

    public function testJourneyContextPackTruncatesOldestFirst(): void
    {
        $pdo = $this->sqliteMemory();
        $pdo->exec('create table story_summaries (
            child_id text, kind text, up_to_sequence int, summary_text text, created_at text default CURRENT_TIMESTAMP
        )');
        $pdo->exec('create table story_beats (
            child_id text, sequence_num int, narrative_text text, beat_kind text
        )');
        $pdo->exec('create table dialogue_turns (
            child_id text, sequence int, role text, text text, created_at text
        )');

        $cid = '11111111-1111-1111-1111-111111111111';
        $pdo->prepare(
            "insert into story_summaries (child_id, kind, up_to_sequence, summary_text)
             values (?, 'condensed_full', 2, 'Resumen corto del viaje.')"
        )->execute([$cid]);

        for ($i = 1; $i <= 5; $i++) {
            $pdo->prepare('insert into story_beats values (?,?,?,?)')
                ->execute([$cid, $i, str_repeat('B', 200) . $i, 'narration']);
            $pdo->prepare('insert into dialogue_turns values (?,?,?,?,?)')
                ->execute([$cid, $i, 'mentor', str_repeat('T', 200) . $i, sprintf('2026-01-0%d', $i)]);
        }

        $pack = (new JourneyContextPack($pdo))->build($cid, 6, 8, 900);
        self::assertSame('Resumen corto del viaje.', $pack['journey_summary']);
        self::assertTrue($pack['truncated']);
        self::assertLessThan(5, count($pack['recent_turns']));

        $block = (new JourneyContextPack($pdo))->toPromptBlock($pack);
        self::assertStringContainsString('JOURNEY_CONDENSED', $block);
        self::assertStringContainsString('RECENT_BEATS', $block);
    }

    private function sqliteMemory(): \PDO
    {
        $pdo = new \PDO('sqlite::memory:');
        $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

        return $pdo;
    }
}
