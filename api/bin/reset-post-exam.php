<?php

declare(strict_types=1);

/**
 * Resetea un tripulante al punto justo tras completar el examen de ingreso:
 * placement conservado, aventura/diario limpios, diálogo en elección de zona.
 *
 * Uso (Docker): php /var/www/api/bin/reset-post-exam.php [child_uuid]
 */

require '/var/www/api/vendor/autoload.php';

use Kidepik\Api\Services\AdventureService;
use Kidepik\Shared\Ai\PlacementBank;
use Kidepik\Shared\Ai\PlacementNarrator;
use Kidepik\Shared\Ai\MentorCatalog;
use Kidepik\Shared\Config;
use Kidepik\Shared\Database\PdoFactory;

Config::load('/var/www/.env.poc');
$pdo = PdoFactory::fromConfig();
if (!$pdo) {
    fwrite(STDERR, "no pdo\n");
    exit(1);
}

$defaultChildId = '5001ba88-cd97-4b40-a67c-496c081a987e';
$childId = $argv[1] ?? $defaultChildId;

$childStmt = $pdo->prepare(
    'select id, display_name, world_theme, mentor_id, general_level, rank_id, rank_track,
            placement_status, onboarding_step, settings
     from children where id = :id'
);
$childStmt->execute(['id' => $childId]);
$child = $childStmt->fetch(PDO::FETCH_ASSOC);
if ($child === false) {
    fwrite(STDERR, "child not found: {$childId}\n");
    exit(1);
}

if (($child['placement_status'] ?? '') !== 'completed' || empty($child['general_level'])) {
    fwrite(STDERR, "child has no completed placement (status={$child['placement_status']}, level={$child['general_level']})\n");
    exit(1);
}

$theme = (string) ($child['world_theme'] ?? 'fantasy');
$mentorId = (string) ($child['mentor_id'] ?? MentorCatalog::idForWorldTheme($theme));
$bank = new PlacementBank();
$narrator = new PlacementNarrator();
$rank = $bank->rankForGeneral($theme, (string) $child['general_level']);

$levelStmt = $pdo->prepare('select subject_id, level_id from user_subject_levels where child_id = :id');
$levelStmt->execute(['id' => $childId]);
$subjectLevels = [];
foreach ($levelStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $subjectLevels[(string) $row['subject_id']] = (string) $row['level_id'];
}
if ($subjectLevels === []) {
    fwrite(STDERR, "no user_subject_levels for child; run placement first\n");
    exit(1);
}

$exclude = AdventureService::completedZoneIds($child);
$zoneOptions = AdventureService::zonePitches($theme, $subjectLevels, 3, $exclude);
$closing = $narrator->closing($child, $mentorId, $rank);

$mapText = AdventureService::zonePitchMapText($zoneOptions);

$journey = json_encode([
    'chapter_id' => 'C1_first_zone',
    'active_zone_id' => null,
    'antagonist_pressure' => 0.1,
    'fragments_restored' => 0,
    'adventure_unlocked' => true,
], JSON_UNESCAPED_UNICODE);

$pdo->beginTransaction();

try {
    $pdo->prepare('delete from journey_decisions where child_id = :id')->execute(['id' => $childId]);
    $pdo->prepare('delete from narrative_quests where child_id = :id')->execute(['id' => $childId]);
    $pdo->prepare('delete from story_summaries where child_id = :id')->execute(['id' => $childId]);
    $pdo->prepare('delete from story_beats where child_id = :id')->execute(['id' => $childId]);

    $pdo->prepare(
        "update children set
            onboarding_step = 'complete',
            placement_status = 'completed',
            rank_id = coalesce(rank_id, :rid),
            rank_track = coalesce(rank_track, :rt),
            settings = jsonb_set(
              coalesce(settings, '{}'::jsonb),
              '{journey}',
              :journey::jsonb,
              true
            ),
            updated_at = now()
         where id = :id"
    )->execute([
        'id' => $childId,
        'rid' => $rank['id'],
        'rt' => $theme === 'sci-fi' ? 'sci-fi' : 'fantasy',
        'journey' => $journey,
    ]);

    $pdo->prepare(
        "update dialogue_sessions set status = 'closed', updated_at = now()
         where child_id = :id and status = 'open'"
    )->execute(['id' => $childId]);

    $sessionStmt = $pdo->prepare(
        "insert into dialogue_sessions (child_id, flow_id, mentor_id, status)
         values (:cid, 'adventure', :mentor, 'open')
         returning id"
    );
    $sessionStmt->execute(['cid' => $childId, 'mentor' => $mentorId]);
    $sessionId = (string) $sessionStmt->fetchColumn();

    $turnInsert = $pdo->prepare(
        "insert into dialogue_turns (
           session_id, child_id, flow_id, sequence, role, text, options, input_mode, explorer_reply, meta, model_used
         ) values (
           :sid, :cid, 'adventure', :seq, 'mentor', :text,
           :options::jsonb, :input_mode, null, :meta::jsonb, null
         )"
    );

    $turnInsert->execute([
        'sid' => $sessionId,
        'cid' => $childId,
        'seq' => 1,
        'text' => $closing,
        'options' => json_encode([['id' => 'continue', 'label' => 'Ver los caminos']], JSON_UNESCAPED_UNICODE),
        'input_mode' => 'continue',
        'meta' => json_encode(['phase' => 'admission_map', 'rank' => $rank['id']], JSON_UNESCAPED_UNICODE),
    ]);

    $turnInsert->execute([
        'sid' => $sessionId,
        'cid' => $childId,
        'seq' => 2,
        'text' => $mapText,
        'options' => json_encode($zoneOptions, JSON_UNESCAPED_UNICODE),
        'input_mode' => 'options_only',
        'meta' => json_encode([
            'phase' => 'choose_zone',
            'rank' => $rank['id'],
            'choices_offered' => $zoneOptions,
        ], JSON_UNESCAPED_UNICODE),
    ]);

    $pdo->prepare(
        "insert into story_beats (
            child_id, session_id, sequence_num, chapter_id, zone_id, beat_kind,
            narrative_text, choices_offered, choice_taken
         ) values (
            :cid, :sid, 1, 'C1_first_zone', null, 'choice',
            :text, :choices::jsonb, null
         )"
    )->execute([
        'cid' => $childId,
        'sid' => $sessionId,
        'text' => 'Encrucijada: el mentor ofrece destinos del viaje.',
        'choices' => json_encode($zoneOptions, JSON_UNESCAPED_UNICODE),
    ]);

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    fwrite(STDERR, 'reset failed: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}

$check = $pdo->prepare(
    'select display_name, onboarding_step, placement_status, general_level, rank_id,
            settings->\'journey\' as journey
     from children where id = :id'
);
$check->execute(['id' => $childId]);
$out = $check->fetch(PDO::FETCH_ASSOC);

$zones = array_map(static fn (array $z): string => $z['label'], $zoneOptions);
echo json_encode([
    'child' => $out,
    'session_id' => $sessionId,
    'zones_offered' => $zones,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;
