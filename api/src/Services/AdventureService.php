<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use InvalidArgumentException;
use Kidepik\Shared\Ai\AiGateway;
use Kidepik\Shared\Ai\ZoneCatalog;
use PDO;

/**
 * Sesión de aventura post-placement — narrativa vía AdventureComposeService (LLM).
 */
final class AdventureService
{
    public const ZONE_INTRO_GATES = 3;

    /** @var list<string> */
    public const ZONE_IDS = ZoneCatalog::ZONE_IDS;

    public function __construct(
        private readonly PDO $pdo,
        private readonly ?AiGateway $gateway = null,
        private readonly ?AdventureComposeService $compose = null,
    ) {
    }

    private function composer(): AdventureComposeService
    {
        return $this->compose ?? new AdventureComposeService($this->pdo, $this->gateway);
    }

    /**
     * @param array<string,mixed> $child
     * @return array{turns:list<array<string,mixed>>,effects:list<array<string,mixed>>}
     */
    public function chooseZone(
        string $childId,
        array $child,
        string $zoneId,
        string $sessionId,
        string $flowId,
        int $sequence,
        string $mentorId,
        string $chosenLabel = '',
    ): array {
        unset($flowId, $sequence, $mentorId);
        if (!in_array($zoneId, self::ZONE_IDS, true)) {
            throw new InvalidArgumentException('zone invalid');
        }

        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $title = $chosenLabel !== '' ? $chosenLabel : self::zoneTitle($theme, $zoneId);
        $subject = ZoneCatalog::subjectForZone($zoneId);
        $levelId = $this->subjectLevel($childId, $subject);

        $this->pdo->prepare(
            "update children set settings = jsonb_set(
                coalesce(settings, '{}'::jsonb),
                '{journey,active_zone_id}',
                to_jsonb(:zone::text),
                true
             ), updated_at = now() where id = :id"
        )->execute(['zone' => $zoneId, 'id' => $childId]);

        $this->pdo->prepare(
            "update narrative_quests set status = 'abandoned' where child_id = :cid and status = 'active'"
        )->execute(['cid' => $childId]);

        $gates = [];
        for ($i = 0; $i < self::ZONE_INTRO_GATES; $i++) {
            $gates[] = ['subject_id' => $subject, 'done' => false, 'gate_index' => $i];
        }
        $q = $this->pdo->prepare(
            "insert into narrative_quests (child_id, zone_id, chapter_id, title_child, status, steps_total, steps_done, learning_gates)
             values (:cid, :zone, 'C1_first_zone', :title, 'active', :steps, 0, :gates::jsonb)
             returning id"
        );
        $q->execute([
            'cid' => $childId,
            'zone' => $zoneId,
            'title' => 'Introducción: ' . $title,
            'steps' => self::ZONE_INTRO_GATES,
            'gates' => json_encode($gates, JSON_UNESCAPED_UNICODE),
        ]);
        $questId = (string) $q->fetchColumn();

        $scene = $this->composer()->composeArrival($childId, $child, $zoneId, $title, self::ZONE_INTRO_GATES);
        $arrival = $scene['text'];
        $npcMeta = $scene['meta'];

        $this->appendBeat($childId, $sessionId, $this->nextBeatSequence($childId), 'C1_first_zone', $zoneId, 'narration', $arrival, null, null);

        $this->pdo->prepare(
            'insert into journey_decisions (child_id, decision_key, option_id, label)
             values (:cid, \'choose_zone\', :opt, :label)'
        )->execute(['cid' => $childId, 'opt' => $zoneId, 'label' => $title]);

        return [
            'turns' => [
                [
                    'text' => $arrival,
                    'input_mode' => 'continue',
                    'options' => [['id' => 'continue', 'label' => 'Afrontar el obstáculo']],
                    'meta' => array_merge([
                        'phase' => 'zone_arrive',
                        'zone_id' => $zoneId,
                        'quest_id' => $questId,
                        'gate_index' => 0,
                        'subject_id' => $subject,
                        'level_id' => $levelId,
                    ], $npcMeta),
                ],
            ],
            'effects' => [
                ['type' => 'update_journey', 'active_zone_id' => $zoneId],
                ['type' => 'update_quest', 'quest_id' => $questId, 'status' => 'active'],
                ['type' => 'append_story_beat', 'zone_id' => $zoneId],
            ],
        ];
    }

    /**
     * @param array<string,mixed> $child
     * @param array<string,mixed> $meta
     * @return array{turns:list<array<string,mixed>>,effects:list<array<string,mixed>>}
     */
    public function presentChallenge(
        string $childId,
        array $child,
        array $meta,
        string $sessionId,
        string $mentorId,
    ): array {
        unset($mentorId);
        $zoneId = (string) ($meta['zone_id'] ?? 'zone_math');
        $questId = (string) ($meta['quest_id'] ?? '');
        $subject = (string) ($meta['subject_id'] ?? ZoneCatalog::subjectForZone($zoneId));
        $gateIndex = (int) ($meta['gate_index'] ?? 0);
        $levelId = (string) ($meta['level_id'] ?? $this->subjectLevel($childId, $subject));

        $item = AdventureComposeService::pickChallengeItem($child, $subject, $levelId, $gateIndex);
        $npcDisplay = is_array($meta['npc_display'] ?? null) ? $meta['npc_display'] : [];
        $dressed = $this->composer()->composeChallenge(
            $childId,
            $child,
            $zoneId,
            $item,
            $gateIndex,
            self::ZONE_INTRO_GATES,
            $npcDisplay,
        );
        $framed = $dressed['text'];

        $this->appendBeat(
            $childId,
            $sessionId,
            $this->nextBeatSequence($childId),
            'C1_first_zone',
            $zoneId,
            'challenge_intro',
            $framed,
            $item['options'],
            null,
        );

        return [
            'turns' => [
                [
                    'text' => $framed,
                    'input_mode' => $item['input_mode'],
                    'options' => $item['options'],
                    'meta' => array_merge([
                        'phase' => 'adventure_challenge',
                        'zone_id' => $zoneId,
                        'quest_id' => $questId,
                        'subject_id' => $subject,
                        'level_id' => $levelId,
                        'gate_index' => $gateIndex,
                        'canonical_option' => $item['canonical_option'],
                    ], $dressed['meta']),
                ],
            ],
            'effects' => [
                ['type' => 'append_story_beat', 'beat_kind' => 'challenge_intro'],
            ],
        ];
    }

    /**
     * @param array{kind:string,option_id?:string,text?:string} $reply
     * @param array<string,mixed> $meta
     * @param array<string,mixed> $child
     * @return array{turns:list<array<string,mixed>>,effects:list<array<string,mixed>>}
     */
    public function resolveChallenge(
        string $childId,
        array $child,
        array $reply,
        array $meta,
        string $sessionId,
        int $sequence,
        string $mentorId,
    ): array {
        unset($sequence);
        $want = (string) ($meta['canonical_option'] ?? '');
        $got = (string) ($reply['option_id'] ?? '');
        $textGot = trim((string) ($reply['text'] ?? ''));
        $ok = ($want !== '' && $want === $got)
            || ($want !== '' && $textGot !== '' && mb_strtolower($textGot) === mb_strtolower($want));
        $zoneId = (string) ($meta['zone_id'] ?? 'zone_math');
        $questId = (string) ($meta['quest_id'] ?? '');
        $subject = (string) ($meta['subject_id'] ?? 'math');
        $gateIndex = (int) ($meta['gate_index'] ?? 0);

        $resultText = $this->composer()->composeChallengeResult($childId, $child, $zoneId, $ok);

        $this->appendBeat(
            $childId,
            $sessionId,
            $this->nextBeatSequence($childId),
            'C1_first_zone',
            $zoneId,
            'challenge_result',
            $resultText,
            null,
            ['ok' => $ok, 'reply' => $reply, 'gate_index' => $gateIndex],
        );

        $stepsDone = 0;
        $stepsTotal = self::ZONE_INTRO_GATES;
        if ($questId !== '') {
            $st = $this->pdo->prepare('select steps_done, steps_total, learning_gates, status from narrative_quests where id = :id');
            $st->execute(['id' => $questId]);
            $row = $st->fetch(PDO::FETCH_ASSOC) ?: [];
            $stepsDone = (int) ($row['steps_done'] ?? 0) + 1;
            $stepsTotal = (int) ($row['steps_total'] ?? self::ZONE_INTRO_GATES);
            $gates = $row['learning_gates'] ?? [];
            if (is_string($gates)) {
                $gates = json_decode($gates, true) ?: [];
            }
            if (!is_array($gates)) {
                $gates = [];
            }
            foreach ($gates as $i => $g) {
                if (!is_array($g)) {
                    continue;
                }
                if ((int) ($g['gate_index'] ?? $i) === $gateIndex) {
                    $gates[$i]['done'] = true;
                }
            }
            $status = $stepsDone >= $stepsTotal ? 'completed' : (string) ($row['status'] ?? 'active');
            $this->pdo->prepare(
                'update narrative_quests set steps_done = :done, learning_gates = :gates::jsonb,
                 status = :status, updated_at = now() where id = :id'
            )->execute([
                'done' => $stepsDone,
                'gates' => json_encode(array_values($gates), JSON_UNESCAPED_UNICODE),
                'status' => $status,
                'id' => $questId,
            ]);
        }

        if ($ok) {
            $this->pdo->prepare(
                "update children set settings = jsonb_set(
                    coalesce(settings, '{}'::jsonb),
                    '{journey,fragments_restored}',
                    to_jsonb(coalesce((settings->'journey'->>'fragments_restored')::int, 0) + 1),
                    true
                 ), updated_at = now() where id = :id"
            )->execute(['id' => $childId]);
        }

        $this->maybeSummarize($childId, $mentorId);

        $questComplete = $stepsDone >= $stepsTotal;
        if ($questComplete) {
            $this->markZoneCompleted($childId, $zoneId);
            $complete = $this->composer()->composeQuestComplete($childId, $child, $zoneId);
            $wrap = $complete['text'];
            $this->appendBeat(
                $childId,
                $sessionId,
                $this->nextBeatSequence($childId),
                'C1_first_zone',
                $zoneId,
                'quest_update',
                $wrap,
                [
                    ['id' => 'pause_session', 'label' => 'Pausar hasta otra visita'],
                    ['id' => 'stay_a_while', 'label' => 'Mirar el lugar un momento'],
                ],
                null,
            );

            return [
                'turns' => [
                    [
                        'text' => $resultText . ' ' . $wrap,
                        'input_mode' => 'options_only',
                        'options' => [
                            ['id' => 'pause_session', 'label' => 'Pausar hasta otra visita'],
                            ['id' => 'stay_a_while', 'label' => 'Mirar el lugar un momento'],
                        ],
                        'meta' => [
                            'phase' => 'zone_quest_complete',
                            'zone_id' => $zoneId,
                            'quest_id' => $questId,
                        ],
                    ],
                ],
                'effects' => [
                    ['type' => 'record_learning_result', 'ok' => $ok, 'zone_id' => $zoneId],
                    ['type' => 'update_quest', 'quest_id' => $questId, 'status' => 'completed'],
                    ['type' => 'append_story_beat', 'beat_kind' => 'challenge_result'],
                ],
            ];
        }

        $nextGate = $gateIndex + 1;
        $between = $this->composer()->composeBetween($childId, $child, $zoneId, $nextGate, $stepsTotal);
        $betweenText = $between['text'];

        $this->appendBeat(
            $childId,
            $sessionId,
            $this->nextBeatSequence($childId),
            'C1_first_zone',
            $zoneId,
            'narration',
            $betweenText,
            null,
            null,
        );

        return [
            'turns' => [
                [
                    'text' => $resultText . ' ' . $betweenText,
                    'input_mode' => 'continue',
                    'options' => [['id' => 'continue', 'label' => 'Seguir explorando']],
                    'meta' => [
                        'phase' => 'zone_between',
                        'zone_id' => $zoneId,
                        'quest_id' => $questId,
                        'subject_id' => $subject,
                        'level_id' => (string) ($meta['level_id'] ?? $this->subjectLevel($childId, $subject)),
                        'gate_index' => $nextGate,
                        'npc_display' => $between['meta']['npc_display'] ?? ($meta['npc_display'] ?? null),
                    ],
                ],
            ],
            'effects' => [
                ['type' => 'record_learning_result', 'ok' => $ok, 'zone_id' => $zoneId],
                ['type' => 'append_story_beat', 'beat_kind' => 'challenge_result'],
            ],
        ];
    }

    /**
     * @return array{turns:list<array<string,mixed>>,effects:list<array<string,mixed>>}
     */
    public function wrapSession(string $childId, array $child, array $meta, string $sessionId): array
    {
        $zoneId = (string) ($meta['zone_id'] ?? '');
        $scene = $this->composer()->composeSessionWrap($childId, $child, $zoneId);
        $text = $scene['text'];

        $this->appendBeat(
            $childId,
            $sessionId,
            $this->nextBeatSequence($childId),
            'C1_first_zone',
            $zoneId !== '' ? $zoneId : null,
            'narration',
            $text,
            null,
            null,
        );

        return [
            'turns' => [
                [
                    'text' => $text,
                    'input_mode' => 'continue',
                    'options' => [['id' => 'continue', 'label' => 'Hasta la próxima visita']],
                    'meta' => ['phase' => 'session_wrap', 'zone_id' => $zoneId],
                ],
            ],
            'effects' => [
                ['type' => 'append_story_beat', 'beat_kind' => 'narration'],
            ],
        ];
    }

    /**
     * @return array{turns:list<array<string,mixed>>,effects:list<array<string,mixed>>}
     */
    public function lingerAfterQuest(string $childId, array $child, array $meta, string $sessionId): array
    {
        unset($sessionId);
        $zoneId = (string) ($meta['zone_id'] ?? '');
        $scene = $this->composer()->composeLinger($childId, $child, $zoneId);

        return [
            'turns' => [
                [
                    'text' => $scene['text'],
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'pause_session', 'label' => 'Pausar hasta otra visita'],
                    ],
                    'meta' => ['phase' => 'zone_quest_complete', 'zone_id' => $zoneId, 'quest_id' => $meta['quest_id'] ?? ''],
                ],
            ],
            'effects' => [],
        ];
    }

    public static function zoneTitle(string $theme, string $zoneId): string
    {
        return ZoneCatalog::label($theme, $zoneId);
    }

    /**
     * @return array<string,mixed>
     */
    public static function composeFailedTurn(string $composeKind): array
    {
        return [
            'text' => '',
            'input_mode' => 'options_only',
            'options' => [['id' => 'retry_compose', 'label' => 'Reintentar']],
            'meta' => [
                'phase' => 'compose_failed',
                'error_code' => 'ADVENTURE_COMPOSE_FAILED',
                'compose_kind' => $composeKind,
                'compose_failed' => true,
                'retry_allowed' => true,
            ],
        ];
    }

    private function subjectLevel(string $childId, string $subject): string
    {
        try {
            $stmt = $this->pdo->prepare(
                'select level_id from user_subject_levels where child_id = :cid and subject_id = :sid limit 1'
            );
            $stmt->execute(['cid' => $childId, 'sid' => $subject]);
            $v = $stmt->fetchColumn();
            if (is_string($v) && $v !== '') {
                return $v;
            }
        } catch (\Throwable) {
            /* sqlite tests sin tabla */
        }

        return 'L2';
    }

    private function nextBeatSequence(string $childId): int
    {
        $stmt = $this->pdo->prepare('select coalesce(max(sequence_num), 0) from story_beats where child_id = :id');
        $stmt->execute(['id' => $childId]);

        return ((int) $stmt->fetchColumn()) + 1;
    }

    /** @param list<array{id:string,label:string}>|null $choices */
    private function appendBeat(
        string $childId,
        ?string $sessionId,
        int $sequence,
        string $chapterId,
        ?string $zoneId,
        string $kind,
        string $text,
        ?array $choices,
        mixed $choiceTaken,
    ): void {
        $this->pdo->prepare(
            'insert into story_beats (
                child_id, session_id, sequence_num, chapter_id, zone_id, beat_kind,
                narrative_text, choices_offered, choice_taken
             ) values (
                :cid, :sid, :seq, :chapter, :zone, :kind,
                :text, :choices::jsonb, :taken::jsonb
             )'
        )->execute([
            'cid' => $childId,
            'sid' => $sessionId,
            'seq' => $sequence,
            'chapter' => $chapterId,
            'zone' => $zoneId,
            'kind' => $kind,
            'text' => $text,
            'choices' => $choices !== null ? json_encode($choices, JSON_UNESCAPED_UNICODE) : null,
            'taken' => $choiceTaken !== null ? json_encode($choiceTaken, JSON_UNESCAPED_UNICODE) : null,
        ]);
    }

    /**
     * @param array<string,mixed> $child
     * @return list<string>
     */
    public static function completedZoneIds(array $child): array
    {
        $settings = $child['settings'] ?? [];
        if (!is_array($settings)) {
            return [];
        }
        $journey = $settings['journey'] ?? [];
        if (!is_array($journey)) {
            return [];
        }
        $raw = $journey['zones_completed'] ?? [];
        if (!is_array($raw)) {
            return [];
        }

        return array_values(array_filter($raw, static fn ($z): bool => is_string($z) && $z !== ''));
    }

    private function markZoneCompleted(string $childId, string $zoneId): void
    {
        $stmt = $this->pdo->prepare('select settings from children where id = :id limit 1');
        $stmt->execute(['id' => $childId]);
        $raw = $stmt->fetchColumn();
        $settings = is_string($raw) ? json_decode($raw, true) : [];
        if (!is_array($settings)) {
            $settings = [];
        }
        $journey = is_array($settings['journey'] ?? null) ? $settings['journey'] : [];
        $completed = is_array($journey['zones_completed'] ?? null) ? $journey['zones_completed'] : [];
        if (!in_array($zoneId, $completed, true)) {
            $completed[] = $zoneId;
        }
        $journey['zones_completed'] = array_values(array_filter($completed, static fn ($z): bool => is_string($z) && $z !== ''));
        $settings['journey'] = $journey;
        $this->pdo->prepare('update children set settings = :settings::jsonb, updated_at = now() where id = :id')
            ->execute([
                'settings' => json_encode($settings, JSON_UNESCAPED_UNICODE),
                'id' => $childId,
            ]);
    }

    private function maybeSummarize(string $childId, string $mentorId): void
    {
        unset($mentorId);
        $memory = new JourneyMemoryService($this->pdo, $this->gateway);
        $memory->maybeCondense($childId, 3);
    }
}
