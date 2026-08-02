<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Services\JourneyTimelineService;
use Kidepik\Shared\Ai\AiGateway;
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
            id text, child_id text, role text, text text, created_at text, sequence int
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
        $pdo->exec("insert into dialogue_turns values ('t1','$cid','mentor','Hola mundo','2026-01-01 10:00:00',1)");
        $pdo->exec("insert into dialogue_turns values ('t2','$cid','explorer','fantasy','2026-01-01 10:01:00',2)");
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

    public function testTimelineStableOrderWhenTimestampsTie(): void
    {
        $pdo = new \PDO('sqlite::memory:');
        $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $pdo->exec('create table dialogue_turns (
            id text, child_id text, role text, text text, created_at text, sequence int
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

        $cid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
        $t = '2026-08-01 13:34:07.100';
        $pdo->exec("insert into journey_decisions values ('d1','$cid','choose_zone','zone_math','Bosque de los Números','$t')");
        $pdo->exec("insert into story_beats values ('b1','$cid','narration','Entramos en el bosque','1','$t')");
        $pdo->exec("insert into story_beats values ('b2','$cid','challenge_intro','Las runas muestran 9+4','2','$t')");
        $pdo->exec("insert into dialogue_turns values ('t1','$cid','mentor','Las runas muestran 9+4','$t',5)");

        $page = (new JourneyTimelineService($pdo))->page($cid, null, 20);
        $kinds = array_map(static fn (array $e): string => (string) $e['kind'], $page['events']);
        // Newest-first: challenge (seq 2) antes que narration (seq 1); decisión más temprana.
        self::assertSame(['challenge', 'system', 'decision'], $kinds);
        // Eco mentor del mismo texto de reto omitido
        self::assertCount(3, $page['events']);
        self::assertStringContainsString('.', (string) $page['events'][0]['at']);
    }

    public function testPlacementItemWriterUsesInjectedGatewayRewrite(): void
    {
        putenv('AI_ENABLED=true');
        $_ENV['AI_ENABLED'] = 'true';

        $gateway = new AiGateway(
            modelQueue: ['mock/local'],
            chatFn: [MockAiGateway::class, 'complete'],
        );
        $writer = new PlacementItemWriter(gateway: $gateway);
        $out = $writer->rewrite(
            ['prompt_text' => '¿Cuánto es 2 + 2?', 'item_type' => 'mcq', 'subject_id' => 'math', 'item_key' => 'k1'],
            ['world_theme' => 'fantasy', 'display_name' => 'Aventurero'],
        );
        self::assertStringContainsString('runas', (string) $out['prompt_text']);
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
