<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Services\AdventureService;
use PHPUnit\Framework\TestCase;

final class AdventureStoryRichnessTest extends TestCase
{
    public function testZonePitchesIncludeWhyAndPreferWeakerSubjects(): void
    {
        $pitches = AdventureService::zonePitches('fantasy', [
            'math' => 'L1',
            'language' => 'L4',
            'logic' => 'L3',
            'science' => 'L5',
            'culture' => 'L5',
        ], 3);

        self::assertCount(3, $pitches);
        self::assertSame('zone_math', $pitches[0]['id']);
        self::assertNotSame('', $pitches[0]['description']);
        self::assertNotSame('', $pitches[0]['why_for_you']);
        self::assertStringContainsString('Bosque', $pitches[0]['label']);
        self::assertNotSame($pitches[0]['why_for_you'], $pitches[1]['why_for_you']);
        self::assertNotSame($pitches[1]['why_for_you'], $pitches[2]['why_for_you']);
    }

    public function testZonePitchMapTextDoesNotRepeatCardBodies(): void
    {
        $pitches = AdventureService::zonePitches('fantasy', [
            'math' => 'L3',
            'language' => 'L3',
            'logic' => 'L3',
            'science' => 'L4',
            'culture' => 'L4',
        ], 3);
        $map = AdventureService::zonePitchMapText($pitches);

        self::assertStringContainsString('carta', $map);
        self::assertStringNotContainsString($pitches[0]['description'], $map);
        self::assertStringNotContainsString($pitches[0]['why_for_you'], $map);
        self::assertStringNotContainsString('equilibrio tiembla', $map);
    }

    public function testHighLevelMathChallengeIsNotTrivialSum(): void
    {
        $svc = new AdventureService($this->sqliteMinimal());
        $ref = new \ReflectionClass($svc);
        $method = $ref->getMethod('challengeFor');
        $method->setAccessible(true);
        /** @var array{prompt:string} $challenge */
        $challenge = $method->invoke($svc, 'fantasy', 'math', 'L4', 0);
        self::assertStringNotContainsString('5 + 7', $challenge['prompt']);
        self::assertArrayHasKey('canonical_option', $challenge);
        self::assertGreaterThanOrEqual(2, count($challenge['options']));
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
