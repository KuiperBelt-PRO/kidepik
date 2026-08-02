<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Services\AdventureComposeService;
use Kidepik\Api\Services\AdventureService;
use Kidepik\Shared\Ai\AiGateway;
use Kidepik\Shared\Ai\ChallengePlanner;
use Kidepik\Shared\Ai\MockAiGateway;
use Kidepik\Shared\Ai\ZoneNarrativeGuard;
use Kidepik\Shared\Ai\ZonePitchPlanner;
use PHPUnit\Framework\TestCase;

final class AdventureLlmNarrativeTest extends TestCase
{
    public function testZonePitchPlannerPrefersWeakerSubjects(): void
    {
        $levels = [
            'math' => 'L1',
            'language' => 'L4',
            'logic' => 'L3',
            'science' => 'L5',
            'culture' => 'L5',
        ];
        $ids = ZonePitchPlanner::planZoneIds($levels, [], 'seed-a', 3);

        self::assertCount(3, $ids);
        self::assertSame('zone_math', $ids[0]);
        self::assertNotContains('zone_math', array_slice($ids, 1));
    }

    public function testZonePitchPlannerVariesBySessionSeed(): void
    {
        $levels = [
            'math' => 'L2',
            'language' => 'L2',
            'logic' => 'L2',
            'science' => 'L3',
            'culture' => 'L3',
        ];
        $a = ZonePitchPlanner::planZoneIds($levels, [], ZonePitchPlanner::sessionSeed('child-a', 'session-1'));
        $b = ZonePitchPlanner::planZoneIds($levels, [], ZonePitchPlanner::sessionSeed('child-a', 'session-2'));

        self::assertNotSame($a, $b);
    }

    public function testZonePitchPlannerExcludesCompletedZones(): void
    {
        $levels = [
            'math' => 'L1',
            'language' => 'L2',
            'logic' => 'L3',
            'science' => 'L4',
            'culture' => 'L5',
        ];
        $all = ZonePitchPlanner::planZoneIds($levels, [], 'seed', 3);
        $filtered = ZonePitchPlanner::planZoneIds($levels, ['zone_math', 'zone_language'], 'seed', 3);

        self::assertNotContains('zone_math', $filtered);
        self::assertNotContains('zone_language', $filtered);
        self::assertLessThanOrEqual(3, count($filtered));
        self::assertGreaterThanOrEqual(2, count($filtered));
        self::assertContains($all[0], $all);
    }

    public function testZoneNarrativeGuardRejectsForbiddenVocabularyInLogicZone(): void
    {
        $err = ZoneNarrativeGuard::validateZoneVocabulary('zone_logic', 'El sendero del bosque brilla con runas.');

        self::assertIsString($err);
        self::assertStringContainsString('zone_logic', $err);
    }

    public function testHighLevelMathChallengeIsNotTrivialSum(): void
    {
        $item = ChallengePlanner::pickItem('math', 'L4', 0);
        self::assertStringNotContainsString('5 + 7', $item['stem']);
        self::assertNotSame('', $item['canonical_option']);
        self::assertGreaterThanOrEqual(2, count($item['options']));
    }

    public function testComposeFailedTurnExposesRetryCta(): void
    {
        $turn = AdventureService::composeFailedTurn('pitch');

        self::assertSame('compose_failed', $turn['meta']['phase']);
        self::assertTrue($turn['meta']['compose_failed']);
        self::assertSame('retry_compose', $turn['options'][0]['id']);
    }

    public function testMockComposePitchBundleProducesDistinctWhys(): void
    {
        $pdo = $this->sqliteMinimal();
        $child = [
            'world_theme' => 'fantasy',
            'display_name' => 'Vatardar',
            'age_band' => 'band_child',
        ];
        $gateway = new AiGateway(modelQueue: ['mock/local'], chatFn: [MockAiGateway::class, 'complete']);
        $compose = new AdventureComposeService($pdo, $gateway);
        $zoneIds = ZonePitchPlanner::planZoneIds([
            'math' => 'L2',
            'language' => 'L3',
            'logic' => 'L2',
            'science' => 'L4',
            'culture' => 'L4',
        ], [], 'mock-seed', 3);
        $bundle = $compose->composePitchBundle(
            'child-mock',
            $child,
            'session-mock',
            $zoneIds,
            ['math' => 'L2', 'language' => 'L3', 'logic' => 'L2'],
        );

        self::assertNotSame('', $bundle['mentor_bridge']);
        self::assertGreaterThanOrEqual(2, count($bundle['options']));
        $whys = array_column($bundle['options'], 'why_for_you');
        self::assertSame(count($whys), count(array_unique($whys)));
    }

    private function sqliteMinimal(): \PDO
    {
        $pdo = new \PDO('sqlite::memory:');
        $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $pdo->exec('create table story_beats (
            child_id text, session_id text, sequence_num int, chapter_id text, zone_id text,
            beat_kind text, narrative_text text, choices_offered text, choice_taken text
        )');
        $pdo->exec('create table narrative_quests (
            id text, child_id text, zone_id text, chapter_id text, title_child text,
            status text, steps_total int, steps_done int, learning_gates text
        )');
        $pdo->exec('create table journey_decisions (
            child_id text, decision_key text, option_id text, label text
        )');
        $pdo->exec('create table children (id text, settings text)');
        $pdo->exec('create table story_summaries (child_id text, kind text, up_to_sequence int, summary_text text)');

        return $pdo;
    }
}
