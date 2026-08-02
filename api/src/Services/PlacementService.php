<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use InvalidArgumentException;
use Kidepik\Shared\Ai\AgeBand;
use Kidepik\Shared\Ai\MentorCatalog;
use Kidepik\Shared\Ai\PlacementBank;
use Kidepik\Shared\Ai\PlacementExamComposer;
use Kidepik\Shared\Ai\PlacementNarrator;
use Kidepik\Shared\Ai\SubjectCatalog;
use Kidepik\Shared\Logging\AppLogger;
use PDO;

/**
 * Examen de acceso narrativo (placement).
 */
final class PlacementService
{
    private readonly PlacementNarrator $narrator;

    public function __construct(
        private readonly PDO $pdo,
        private readonly PlacementBank $bank,
        ?PlacementNarrator $narrator = null,
    ) {
        $this->narrator = $narrator ?? new PlacementNarrator();
    }

    public static function withDefaultBank(PDO $pdo): self
    {
        return new self($pdo, PlacementBank::fromDefaultFile());
    }

    /**
     * @param array<string,mixed> $child
     * @return list<string>
     */
    public static function activeSubjectsForChild(array $child): array
    {
        $settings = $child['settings'] ?? [];
        if (is_string($settings)) {
            $decoded = json_decode($settings, true);
            $settings = is_array($decoded) ? $decoded : [];
        }
        if (!is_array($settings)) {
            $settings = [];
        }
        $learning = $settings['learning'] ?? [];
        $raw = is_array($learning) ? ($learning['active_subjects'] ?? null) : null;
        $band = AgeBand::fromLegacy(
            $child['age_band'] ?? null,
            isset($child['age_years']) ? (int) $child['age_years'] : null,
        ) ?? AgeBand::CHILD;

        if (is_array($raw) && $raw !== []) {
            try {
                return SubjectCatalog::normalizeActiveSubjects($raw);
            } catch (InvalidArgumentException) {
                // fall through to band base
            }
        }

        return SubjectCatalog::baseSubjectsForBand($band);
    }

    /**
     * @param array<string,mixed> $child
     * @return array{exam_id:string,turn:array<string,mixed>,effects:list<array<string,mixed>>,intro_turn?:array<string,mixed>}
     */
    public function startExam(
        string $childId,
        array $child,
        string $sessionId,
        string $flowId,
        int $sequence,
        string $mentorId,
    ): array {
        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $band = AgeBand::fromLegacy(
            $child['age_band'] ?? null,
            isset($child['age_years']) ? (int) $child['age_years'] : null,
        ) ?? AgeBand::CHILD;

        $this->pdo->prepare(
            "update placement_exams set status = 'abandoned' where child_id = :cid and status = 'in_progress'"
        )->execute(['cid' => $childId]);

        $subjects = self::activeSubjectsForChild($child);
        $recentKeys = $this->recentItemKeys($childId);
        $recentPrompts = $this->recentPrompts($childId);
        $composer = new PlacementExamComposer(narrator: $this->narrator);
        $queue = $composer->compose($child, $subjects, $recentKeys, $recentPrompts);
        if ($queue === []) {
            throw new PlacementComposeFailedException($composer->getLastComposeDebug());
        }

        $ins = $this->pdo->prepare(
            "insert into placement_exams (child_id, world_theme, status, item_queue, current_index)
             values (:cid, :theme, 'in_progress', :queue::jsonb, 0)
             returning id"
        );
        $ins->execute([
            'cid' => $childId,
            'theme' => $theme,
            'queue' => json_encode($queue, JSON_UNESCAPED_UNICODE),
        ]);
        $examId = (string) $ins->fetchColumn();

        $this->pdo->prepare(
            "update children set placement_status = 'in_progress', onboarding_step = 'placement', updated_at = now() where id = :id"
        )->execute(['id' => $childId]);

        $first = $queue[0];
        $turn = $this->itemToTurn($sessionId, $childId, $flowId, $sequence, $mentorId, $theme, $first, 0, count($queue), $child);

        return [
            'exam_id' => $examId,
            'turn' => $turn,
            'effects' => [
                ['type' => 'advance_onboarding', 'to' => 'placement'],
            ],
        ];
    }

    /**
     * @param array{kind:string,option_id?:string,text?:string} $reply
     * @param array<string,mixed> $child
     * @return array<string,mixed>
     */
    public function answer(
        string $childId,
        array $child,
        string $sessionId,
        string $flowId,
        int $sequence,
        string $mentorId,
        array $reply,
    ): array {
        $exam = $this->openExam($childId);
        $queue = $exam['queue'];
        $index = $exam['current_index'];
        if ($index >= count($queue)) {
            throw new InvalidArgumentException('placement already finished');
        }

        $item = $queue[$index];
        $score = $this->bank->score($item, $reply);

        $this->pdo->prepare(
            'insert into placement_answers (exam_id, subject_id, item_key, item_type, prompt_text, response, score)
             values (:exam, :subject, :ikey, :itype, :prompt, :response::jsonb, :score)'
        )->execute([
            'exam' => $exam['id'],
            'subject' => (string) $item['subject_id'],
            'ikey' => (string) $item['item_key'],
            'itype' => (string) $item['item_type'],
            'prompt' => (string) $item['prompt_text'],
            'response' => json_encode($reply, JSON_UNESCAPED_UNICODE),
            'score' => $score,
        ]);

        $index++;
        $this->pdo->prepare('update placement_exams set current_index = :i where id = :id')
            ->execute(['i' => $index, 'id' => $exam['id']]);

        $effects = [
            [
                'type' => 'record_answer',
                'subject_id' => $item['subject_id'],
                'item_key' => $item['item_key'],
                'score' => $score,
            ],
        ];

        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $feedback = $this->narrator->feedbackForItem($item, $reply, $score, $child, $this->bank);

        if ($index >= count($queue)) {
            $complete = $this->finalize($childId, $child, $exam['id'], $mentorId, $theme, $sessionId);

            return [
                'complete' => true,
                'feedback' => $feedback,
                'closing_turns' => $complete['turns'],
                'effects' => array_merge($effects, $complete['effects']),
            ];
        }

        return [
            'complete' => false,
            'feedback' => $feedback,
            'next_item' => $queue[$index],
            'index' => $index,
            'total' => count($queue),
            'theme' => $theme,
            'effects' => $effects,
        ];
    }

    /**
     * @param array<string,mixed> $child
     * @return array{turns:list<array<string,mixed>>,effects:list<array<string,mixed>>}
     */
    private function finalize(
        string $childId,
        array $child,
        string $examId,
        string $mentorId,
        string $theme,
        string $sessionId,
    ): array {
        $stmt = $this->pdo->prepare('select subject_id, score from placement_answers where exam_id = :id');
        $stmt->execute(['id' => $examId]);
        $bySubject = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $sid = (string) $row['subject_id'];
            $bySubject[$sid][] = (float) $row['score'];
        }

        $active = self::activeSubjectsForChild($child);
        $levels = $this->bank->computeLevels($bySubject, $active);
        $ageBand = AgeBand::fromLegacy(
            $child['age_band'] ?? null,
            isset($child['age_years']) ? (int) $child['age_years'] : null,
        ) ?? AgeBand::CHILD;
        $effective = $this->bank->promoteBand($ageBand, $levels['general'], $levels['subjects']);
        $rank = $this->bank->rankForGeneral($theme, $levels['general']);

        foreach ($levels['subjects'] as $subject => $levelId) {
            $this->pdo->prepare(
                'insert into user_subject_levels (child_id, subject_id, level_id, source, updated_at)
                 values (:cid, :sid, :lid, \'placement\', now())
                 on conflict (child_id, subject_id) do update set
                   level_id = excluded.level_id, source = excluded.source, updated_at = now()'
            )->execute(['cid' => $childId, 'sid' => $subject, 'lid' => $levelId]);
        }

        $raw = json_encode([
            'by_subject' => $bySubject,
            'levels' => $levels,
        ], JSON_UNESCAPED_UNICODE);

        $this->pdo->prepare(
            "update placement_exams set status = 'completed', general_level = :g, raw_scores = :raw::jsonb, completed_at = now()
             where id = :id"
        )->execute(['g' => $levels['general'], 'raw' => $raw, 'id' => $examId]);

        $this->pdo->prepare(
            "update children set
                placement_status = 'completed',
                onboarding_step = 'complete',
                general_level = :g,
                effective_age_band = :eb,
                rank_id = :rid,
                rank_track = :rt,
                settings = jsonb_set(
                  coalesce(settings, '{}'::jsonb),
                  '{journey}',
                  coalesce(settings->'journey', '{}'::jsonb) || :journey::jsonb,
                  true
                ),
                updated_at = now()
             where id = :id"
        )->execute([
            'g' => $levels['general'],
            'eb' => $effective,
            'rid' => $rank['id'],
            'rt' => $theme === 'sci-fi' ? 'sci-fi' : 'fantasy',
            'journey' => json_encode([
                'chapter_id' => 'C1_first_zone',
                'active_zone_id' => null,
                'antagonist_pressure' => 0.1,
                'fragments_restored' => 0,
                'adventure_unlocked' => true,
            ], JSON_UNESCAPED_UNICODE),
            'id' => $childId,
        ]);

        $closing = $this->narrator->closing($child, $mentorId, $rank);

        $exclude = AdventureService::completedZoneIds($child);
        $compose = AdventureComposeService::fromConfig($this->pdo);

        $effects = [
            ['type' => 'set_general_level', 'value' => $levels['general']],
            ['type' => 'set_effective_age_band', 'value' => $effective],
            ['type' => 'grant_rank', 'value' => $rank],
            ['type' => 'advance_onboarding', 'to' => 'complete'],
        ];

        try {
            $pitched = $compose->planAndComposePitches($childId, $child, $sessionId, $levels['subjects'], $exclude);
            $zoneOptions = $pitched['options'];
            $this->appendChoiceBeat($childId, $zoneOptions);
            $mapText = $pitched['mentor_bridge'];

            return [
                'turns' => [
                    [
                        'text' => $closing,
                        'input_mode' => 'continue',
                        'options' => [['id' => 'continue', 'label' => 'Ver los caminos']],
                        'meta' => ['phase' => 'admission_map', 'rank' => $rank],
                    ],
                    [
                        'text' => $mapText,
                        'input_mode' => 'options_only',
                        'options' => $zoneOptions,
                        'meta' => ['phase' => 'choose_zone', 'rank' => $rank, 'choices_offered' => $zoneOptions],
                    ],
                ],
                'effects' => $effects,
            ];
        } catch (AdventureComposeFailedException $e) {
            AppLogger::channel('compose')->warning('placement_pitch_compose_failed', [
                'child_id' => $childId,
                'session_id' => $sessionId,
                'compose_debug' => $e->composeDebug,
            ]);
            $failed = AdventureService::composeFailedTurn('pitch');

            return [
                'turns' => [
                    [
                        'text' => $closing,
                        'input_mode' => 'continue',
                        'options' => [['id' => 'continue', 'label' => 'Ver los caminos']],
                        'meta' => ['phase' => 'admission_map', 'rank' => $rank],
                    ],
                    array_merge($failed, [
                        'meta' => array_merge($failed['meta'], [
                            'rank' => $rank,
                            'compose_debug' => $e->composeDebug,
                        ]),
                    ]),
                ],
                'effects' => $effects,
            ];
        }
    }

    /**
     * @param list<array{id:string,label:string,description?:string,why_for_you?:string}> $zoneOptions
     */
    private function appendChoiceBeat(string $childId, array $zoneOptions): void
    {
        try {
            $seqStmt = $this->pdo->prepare('select coalesce(max(sequence_num), 0) from story_beats where child_id = :id');
            $seqStmt->execute(['id' => $childId]);
            $seq = ((int) $seqStmt->fetchColumn()) + 1;
            $this->pdo->prepare(
                'insert into story_beats (
                    child_id, session_id, sequence_num, chapter_id, zone_id, beat_kind,
                    narrative_text, choices_offered, choice_taken
                 ) values (
                    :cid, null, :seq, \'C1_first_zone\', null, \'choice\',
                    :text, :choices::jsonb, null
                 )'
            )->execute([
                'cid' => $childId,
                'seq' => $seq,
                'text' => 'Encrucijada: el mentor ofrece destinos del viaje.',
                'choices' => json_encode($zoneOptions, JSON_UNESCAPED_UNICODE),
            ]);
        } catch (\Throwable) {
            /* beat opcional si la tabla no está en el entorno de test */
        }
    }

    /**
     * Ítems ya usados en exámenes previos (evitar repetir en el siguiente intento).
     *
     * @return list<string>
     */
    private function recentItemKeys(string $childId): array
    {
        $keys = [];

        $ans = $this->pdo->prepare(
            'select distinct pa.item_key
             from placement_answers pa
             join placement_exams pe on pe.id = pa.exam_id
             where pe.child_id = :cid
             limit 60'
        );
        $ans->execute(['cid' => $childId]);
        foreach ($ans->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $k = (string) ($row['item_key'] ?? '');
            if ($k !== '') {
                $keys[] = $k;
            }
        }

        $qStmt = $this->pdo->prepare(
            'select item_queue from placement_exams
             where child_id = :cid
             order by started_at desc limit 5'
        );
        $qStmt->execute(['cid' => $childId]);
        foreach ($qStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $queue = $row['item_queue'] ?? [];
            if (is_string($queue)) {
                $queue = json_decode($queue, true);
            }
            if (!is_array($queue)) {
                continue;
            }
            foreach ($queue as $item) {
                if (is_array($item) && isset($item['item_key'])) {
                    $keys[] = (string) $item['item_key'];
                }
            }
        }

        return array_values(array_unique($keys));
    }

    /**
     * Enunciados recientes (evitar eco literal del agente).
     *
     * @return list<string>
     */
    private function recentPrompts(string $childId): array
    {
        $prompts = [];
        $qStmt = $this->pdo->prepare(
            'select item_queue from placement_exams
             where child_id = :cid
             order by started_at desc limit 5'
        );
        $qStmt->execute(['cid' => $childId]);
        foreach ($qStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $queue = $row['item_queue'] ?? [];
            if (is_string($queue)) {
                $queue = json_decode($queue, true);
            }
            if (!is_array($queue)) {
                continue;
            }
            foreach ($queue as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $p = trim((string) ($item['prompt_text'] ?? ''));
                if ($p !== '') {
                    $prompts[] = $p;
                }
            }
        }

        return array_values(array_unique($prompts));
    }

    /**
     * @return array{id:string,current_index:int,queue:list<array<string,mixed>>}
     */
    private function openExam(string $childId): array
    {
        $stmt = $this->pdo->prepare(
            "select id, current_index, item_queue from placement_exams
             where child_id = :cid and status = 'in_progress' order by started_at desc limit 1"
        );
        $stmt->execute(['cid' => $childId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row === false) {
            throw new InvalidArgumentException('no placement exam in progress');
        }
        $queue = $row['item_queue'];
        if (is_string($queue)) {
            $queue = json_decode($queue, true);
        }
        if (!is_array($queue)) {
            $queue = [];
        }

        return [
            'id' => (string) $row['id'],
            'current_index' => (int) $row['current_index'],
            'queue' => $queue,
        ];
    }

    /**
     * @param array<string,mixed> $item
     * @param array<string,mixed> $child
     * @return array<string,mixed>
     */
    public function itemToTurn(
        string $sessionId,
        string $childId,
        string $flowId,
        int $sequence,
        string $mentorId,
        string $theme,
        array $item,
        int $index,
        int $total,
        ?array $child = null,
    ): array {
        $child ??= ['world_theme' => $theme];
        $text = trim((string) ($item['presentation_text'] ?? ''));
        if ($text === '') {
            $text = $this->narrator->wrapItem($child, $item, $index, $total);
        }

        $type = (string) ($item['item_type'] ?? 'mcq');
        $inputMode = match ($type) {
            'mcq' => 'options_only',
            'short_text', 'numeric' => 'text_only',
            default => 'options_or_text',
        };

        return [
            'session_id' => $sessionId,
            'child_id' => $childId,
            'flow_id' => $flowId,
            'sequence' => $sequence,
            'role' => 'mentor',
            'text' => $text,
            'input_mode' => $inputMode,
            'options' => $item['options'] ?? null,
            'explorer_reply' => null,
            'meta' => [
                'phase' => 'placement_item',
                'subject_id' => $item['subject_id'] ?? null,
                'item_key' => $item['item_key'] ?? null,
                'mentor_id' => $mentorId,
                'index' => $index,
                'total' => $total,
            ],
            'model_used' => null,
        ];
    }
}
