<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Services\JourneyTimelineService;
use Kidepik\Shared\Ai\MockAiGateway;
use Kidepik\Shared\Ai\PlacementItemWriter;
use PHPUnit\Framework\TestCase;

final class JourneyTimelineAndRewriteTest extends TestCase
{
    public function testTimelineOrdersAndPaginates(): void
    {
        $pdo = new \PDO('sqlite::memory:');
        $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $pdo->exec('create table dialogue_turns (
            id text, child_id text, role text, text text, created_at text
        )');
        $pdo->exec('create table journey_decisions (
            id text, child_id text, decision_key text, option_id text, label text, created_at text
        )');
        $pdo->exec('create table story_beats (
            id text, child_id text, beat_kind text, narrative_text text, sequence_num int, created_at text
        )');
        $pdo->exec('create table narrative_quests (
            id text, child_id text, title_child text, status text, zone_id text, created_at text, updated_at text
        )');
        $pdo->exec('create table story_summaries (
            child_id text, kind text, up_to_sequence int, summary_text text, created_at text
        )');

        $cid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        $pdo->exec("insert into story_summaries values ('$cid','condensed_full',3,'Viaje condensado','2026-01-01')");
        $pdo->exec("insert into dialogue_turns values ('t1','$cid','mentor','Hola mundo','2026-01-01 10:00:00')");
        $pdo->exec("insert into dialogue_turns values ('t2','$cid','explorer','fantasy','2026-01-01 10:01:00')");
        $pdo->exec("insert into journey_decisions values ('d1','$cid','choose_zone','zone_math','Bosque','2026-01-01 11:00:00')");
        $pdo->exec("insert into story_beats values ('b1','$cid','challenge_intro','Reto','1','2026-01-01 11:05:00')");
        $pdo->exec("insert into narrative_quests values ('q1','$cid','Intro math','active','zone_math','2026-01-01 11:00:00','2026-01-01 11:00:00')");

        $page = (new JourneyTimelineService($pdo))->page($cid, null, 2);
        self::assertSame('Viaje condensado', $page['summary']);
        self::assertCount(2, $page['events']);
        self::assertNotNull($page['next_cursor']);

        $page2 = (new JourneyTimelineService($pdo))->page($cid, $page['next_cursor'], 10);
        self::assertGreaterThanOrEqual(3, count($page2['events']));
        self::assertNull($page2['next_cursor']);
    }

    public function testPlacementItemWriterUsesMockRewrite(): void
    {
        putenv('AI_MOCK=true');
        $_ENV['AI_MOCK'] = 'true';
        $writer = new PlacementItemWriter();
        $out = $writer->rewrite(
            ['prompt_text' => '¿Cuánto es 2 + 2?', 'item_type' => 'mcq', 'subject_id' => 'math'],
            ['world_theme' => 'fantasy', 'display_name' => 'Aventurero'],
        );
        self::assertStringContainsString('Escuela', (string) $out['prompt_text']);
        self::assertTrue((bool) ($out['narrative_rewritten'] ?? false));

        $mock = MockAiGateway::complete('mock/local', [
            ['role' => 'user', 'content' => json_encode([
                'prompt_text' => 'x',
                'world_theme' => 'sci-fi',
            ], JSON_UNESCAPED_UNICODE)],
        ], ['purpose' => 'placement_item_writer']);
        $json = json_decode($mock['content'], true);
        self::assertStringContainsString('Academia', (string) ($json['prompt_text'] ?? ''));
    }
}
