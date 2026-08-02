<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use Kidepik\Shared\Ai\AgeBand;
use Kidepik\Shared\Ai\AiGateway;
use Kidepik\Shared\Ai\ChallengePlanner;
use Kidepik\Shared\Ai\MentorCatalog;
use Kidepik\Shared\Ai\ZoneBible;
use Kidepik\Shared\Ai\ZoneCatalog;
use Kidepik\Shared\Ai\ZoneNarrativeGuard;
use Kidepik\Shared\Ai\ZonePitchPlanner;
use Kidepik\Shared\Config;
use Kidepik\Shared\Logging\AppLogger;
use PDO;

/**
 * Orquesta agentes LLM de narrativa de aventura (SPEC_APP_ADVENTURE_LLM_NARRATIVE).
 */
final class AdventureComposeService
{
    private const MAX_VALIDATION_RETRIES = 2;

    public function __construct(
        private readonly PDO $pdo,
        private readonly ?AiGateway $gateway = null,
    ) {
    }

    public static function fromConfig(PDO $pdo): self
    {
        return new self($pdo, AiGateway::fromConfig());
    }

    private function gw(): AiGateway
    {
        return $this->gateway ?? AiGateway::fromConfig();
    }

    /**
     * @param array<string,mixed> $child
     * @param array<string,string> $subjectLevels
     * @param list<string> $zoneIds
     * @return array{mentor_bridge:string,options:list<array{id:string,label:string,description:string,why_for_you:string}>}
     */
    public function composePitchBundle(
        string $childId,
        array $child,
        string $sessionId,
        array $zoneIds,
        array $subjectLevels,
    ): array {
        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $zonesPayload = [];
        foreach ($zoneIds as $zoneId) {
            $zonesPayload[] = [
                'zone_id' => $zoneId,
                'canonical_label' => ZoneCatalog::label($theme, $zoneId),
                'subject_id' => ZoneCatalog::subjectForZone($zoneId),
                'bible_excerpt' => ZoneBible::excerpt($theme, $zoneId),
            ];
        }

        $user = [
            'world_theme' => $theme,
            'display_name' => $child['display_name'] ?? null,
            'age_band' => AgeBand::fromLegacy(
                $child['age_band'] ?? $child['effective_age_band'] ?? null,
                isset($child['age_years']) ? (int) $child['age_years'] : null,
            ) ?? AgeBand::CHILD,
            'subject_levels_hint' => $subjectLevels,
            'zones' => $zonesPayload,
        ];

        $parsed = $this->completeJson(
            $childId,
            'pitch',
            [
                ['role' => 'system', 'content' => $this->systemPrompt('zone_pitch_writer')],
                ['role' => 'user', 'content' => json_encode($user, JSON_UNESCAPED_UNICODE)],
            ],
            'adventure_pitch',
            0.6,
            static fn (?array $p): ?string => ZoneNarrativeGuard::validatePitchBundle($p, $zoneIds),
        );

        $options = [];
        foreach ($parsed['options'] as $opt) {
            if (!is_array($opt)) {
                continue;
            }
            $id = (string) ($opt['id'] ?? '');
            $options[] = [
                'id' => $id,
                'label' => trim((string) ($opt['label'] ?? ZoneCatalog::label($theme, $id))),
                'description' => trim((string) ($opt['description'] ?? '')),
                'why_for_you' => trim((string) ($opt['why_for_you'] ?? '')),
            ];
        }

        return [
            'mentor_bridge' => trim((string) ($parsed['mentor_bridge'] ?? '')),
            'options' => $options,
        ];
    }

    /**
     * @param array<string,mixed> $child
     * @return array{text:string,meta:array<string,mixed>}
     */
    public function composeArrival(
        string $childId,
        array $child,
        string $zoneId,
        string $chosenLabel,
        int $stepsTotal = 3,
    ): array {
        return $this->composeScene($childId, $child, $zoneId, 'zone_arrive', [
            'chosen_label' => $chosenLabel,
            'steps_total' => $stepsTotal,
            'cta' => 'Afrontar el obstáculo',
        ]);
    }

    /**
     * @param array<string,mixed> $child
     * @param array<string,mixed> $npcDisplay
     * @return array{text:string,meta:array<string,mixed>}
     */
    public function composeChallenge(
        string $childId,
        array $child,
        string $zoneId,
        array $item,
        int $gateIndex,
        int $stepsTotal,
        array $npcDisplay = [],
    ): array {
        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $user = [
            'world_theme' => $theme,
            'zone_id' => $zoneId,
            'bible_excerpt' => ZoneBible::excerpt($theme, $zoneId),
            'gate_index' => $gateIndex,
            'steps_total' => $stepsTotal,
            'curriculum_stem' => $item['stem'] ?? '',
            'options' => $item['options'] ?? [],
            'npc_display' => $npcDisplay,
            'display_name' => $child['display_name'] ?? null,
        ];

        $parsed = $this->completeJson(
            $childId,
            'challenge',
            [
                ['role' => 'system', 'content' => $this->systemPrompt('challenge_writer')],
                ['role' => 'user', 'content' => json_encode($user, JSON_UNESCAPED_UNICODE)],
            ],
            'adventure_challenge',
            0.4,
            static fn (?array $p): ?string => ZoneNarrativeGuard::validateChallengeEnvelope(
                $p,
                $zoneId,
                (string) ($item['stem'] ?? ''),
            ),
        );

        $wrapper = trim((string) ($parsed['narrative_wrapper'] ?? ''));
        $prompt = trim((string) ($parsed['prompt_text'] ?? ''));
        $text = $wrapper !== '' ? $wrapper . "\n\n" . $prompt : $prompt;

        return [
            'text' => $text,
            'meta' => [
                'npc_ids' => ['zone_guardian'],
                'npc_display' => $npcDisplay,
            ],
        ];
    }

    /**
     * @param array<string,mixed> $child
     */
    public function composeChallengeResult(
        string $childId,
        array $child,
        string $zoneId,
        bool $success,
    ): string {
        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $user = [
            'world_theme' => $theme,
            'zone_id' => $zoneId,
            'success' => $success,
            'bible_excerpt' => ZoneBible::excerpt($theme, $zoneId),
        ];

        $parsed = $this->completeJson(
            $childId,
            'challenge',
            [
                ['role' => 'system', 'content' => $this->systemPrompt('challenge_result_writer')],
                ['role' => 'user', 'content' => json_encode($user, JSON_UNESCAPED_UNICODE)],
            ],
            'adventure_challenge',
            0.5,
            static function (?array $p) use ($zoneId, $success): ?string {
                if (!is_array($p)) {
                    return 'JSON inválido';
                }
                $key = $success ? 'success_text' : 'near_miss_text';
                $t = trim((string) ($p[$key] ?? ''));

                return ZoneNarrativeGuard::validateSceneText($zoneId, $t, 320);
            },
        );

        $key = $success ? 'success_text' : 'near_miss_text';

        return trim((string) ($parsed[$key] ?? ''));
    }

    /**
     * @param array<string,mixed> $child
     * @return array{text:string,meta:array<string,mixed>}
     */
    public function composeBetween(
        string $childId,
        array $child,
        string $zoneId,
        int $nextGate,
        int $stepsTotal,
    ): array {
        return $this->composeScene($childId, $child, $zoneId, 'zone_between', [
            'next_gate' => $nextGate,
            'steps_total' => $stepsTotal,
            'cta' => 'Seguir explorando',
        ]);
    }

    /**
     * @param array<string,mixed> $child
     * @return array{text:string,meta:array<string,mixed>}
     */
    public function composeQuestComplete(string $childId, array $child, string $zoneId): array
    {
        return $this->composeScene($childId, $child, $zoneId, 'zone_quest_complete', [
            'cta_options' => [
                ['id' => 'pause_session', 'label' => 'Pausar hasta otra visita'],
                ['id' => 'stay_a_while', 'label' => 'Mirar el lugar un momento'],
            ],
        ]);
    }

    /**
     * @param array<string,mixed> $child
     * @return array{text:string,meta:array<string,mixed>}
     */
    public function composeSessionWrap(string $childId, array $child, string $zoneId): array
    {
        return $this->composeScene($childId, $child, $zoneId, 'session_wrap', [
            'cta' => 'Hasta la próxima visita',
        ]);
    }

    /**
     * @param array<string,mixed> $child
     * @return array{text:string,meta:array<string,mixed>}
     */
    public function composeLinger(string $childId, array $child, string $zoneId): array
    {
        return $this->composeScene($childId, $child, $zoneId, 'zone_linger', [
            'cta_options' => [['id' => 'pause_session', 'label' => 'Pausar hasta otra visita']],
        ]);
    }

    /**
     * Planifica zone ids y compone pitches en un solo paso.
     *
     * @param array<string,mixed> $child
     * @param array<string,string> $subjectLevels
     * @return array{zone_ids:list<string>,mentor_bridge:string,options:list<array{id:string,label:string,description:string,why_for_you:string}>}
     */
    public function planAndComposePitches(
        string $childId,
        array $child,
        string $sessionId,
        array $subjectLevels,
        array $excludeZoneIds = [],
    ): array {
        $seed = ZonePitchPlanner::sessionSeed($childId, $sessionId);
        $zoneIds = ZonePitchPlanner::planZoneIds($subjectLevels, $excludeZoneIds, $seed);
        if ($zoneIds === []) {
            throw new AdventureComposeFailedException(['compose_kind' => 'pitch', 'reason' => 'no_zones']);
        }
        $bundle = $this->composePitchBundle($childId, $child, $sessionId, $zoneIds, $subjectLevels);

        return [
            'zone_ids' => $zoneIds,
            'mentor_bridge' => $bundle['mentor_bridge'],
            'options' => $bundle['options'],
        ];
    }

    /**
     * @param array<string,mixed> $child
     * @param array<string,mixed> $context
     * @return array{text:string,meta:array<string,mixed>}
     */
    private function composeScene(
        string $childId,
        array $child,
        string $zoneId,
        string $sceneKind,
        array $context,
    ): array {
        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $pack = (new JourneyContextPack($this->pdo))->build($childId, 4, 4, 2000);
        $user = array_merge([
            'world_theme' => $theme,
            'zone_id' => $zoneId,
            'scene_kind' => $sceneKind,
            'bible_excerpt' => ZoneBible::excerpt($theme, $zoneId),
            'display_name' => $child['display_name'] ?? 'explorador',
            'journey_context' => $pack,
        ], $context);

        $parsed = $this->completeJson(
            $childId,
            'scene',
            [
                ['role' => 'system', 'content' => $this->systemPrompt('zone_scene_writer')],
                ['role' => 'user', 'content' => json_encode($user, JSON_UNESCAPED_UNICODE)],
            ],
            'adventure_scene',
            0.6,
            static function (?array $p) use ($zoneId): ?string {
                if (!is_array($p)) {
                    return 'JSON inválido';
                }
                $text = trim((string) ($p['agent_text'] ?? ''));

                return ZoneNarrativeGuard::validateSceneText($zoneId, $text);
            },
        );

        $npc = is_array($parsed['npc_display'] ?? null) ? $parsed['npc_display'] : [];

        return [
            'text' => trim((string) ($parsed['agent_text'] ?? '')),
            'meta' => [
                'npc_ids' => ['zone_guardian'],
                'npc_display' => [
                    'archetype' => (string) ($npc['archetype'] ?? 'zone_guardian'),
                    'name' => (string) ($npc['name'] ?? ''),
                    'one_line_voice' => (string) ($npc['one_line_voice'] ?? ''),
                ],
            ],
        ];
    }

    /**
     * @param list<array{role:string,content:string}> $messages
     * @param callable(?array): ?string $validator
     * @return array<string,mixed>
     */
    private function completeJson(
        string $childId,
        string $composeKind,
        array $messages,
        string $purpose,
        float $temperature,
        callable $validator,
    ): array {
        if (!$this->gw()->isEnabled()) {
            throw new AdventureComposeFailedException([
                'compose_kind' => $composeKind,
                'reason' => 'ai_disabled',
            ]);
        }

        $lastError = 'unknown';
        for ($attempt = 0; $attempt <= self::MAX_VALIDATION_RETRIES; $attempt++) {
            try {
                $result = $this->gw()->complete($messages, [
                    'purpose' => $purpose,
                    'temperature' => $temperature,
                    'max_tokens' => 1400,
                    'child_id' => $childId,
                ]);
                $parsed = json_decode((string) $result['content'], true);
                $err = $validator($parsed);
                if ($err === null && is_array($parsed)) {
                    return $parsed;
                }
                $lastError = $err ?? 'validation_failed';
                AppLogger::channel('ai')->info('narrative_validation_failed', [
                    'compose_kind' => $composeKind,
                    'attempt' => $attempt,
                    'error' => $lastError,
                ]);
                if ($attempt < self::MAX_VALIDATION_RETRIES) {
                    $messages[] = ['role' => 'assistant', 'content' => (string) $result['content']];
                    $messages[] = ['role' => 'user', 'content' => 'Corrige el JSON: ' . $lastError];
                }
            } catch (\Throwable $e) {
                $lastError = $e->getMessage();
                if ($attempt >= self::MAX_VALIDATION_RETRIES) {
                    break;
                }
            }
        }

        AppLogger::channel('compose')->warning('adventure_compose_failed', [
            'compose_kind' => $composeKind,
            'child_id' => $childId,
            'error' => $lastError,
        ]);

        throw new AdventureComposeFailedException([
            'compose_kind' => $composeKind,
            'reason' => $lastError,
        ]);
    }

    private function systemPrompt(string $agent): string
    {
        $rules = $this->loadPromptFile('_mentor_prose_rules.es.md');
        $agentBody = $this->loadPromptFile($agent . '.es.md');
        $mentor = MentorCatalog::profile(MentorCatalog::idForWorldTheme('fantasy'));

        return $rules . "\n\n---\n\n" . $agentBody . "\n\nResponde SOLO JSON válido UTF-8.";
    }

    private function loadPromptFile(string $name): string
    {
        $path = dirname(__DIR__, 3) . '/shared/Ai/prompts/' . $name;
        if (!is_file($path)) {
            return '';
        }
        $content = file_get_contents($path);

        return is_string($content) ? trim($content) : '';
    }

    /**
     * @param array<string,mixed> $child
     * @return array{lines:list<string>,kind:string,ttl_hours:int}
     */
    public function composeWaitingBundle(string $childId, array $child, string $kind): array
    {
        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $band = AgeBand::fromLegacy(
            $child['age_band'] ?? $child['effective_age_band'] ?? null,
            isset($child['age_years']) ? (int) $child['age_years'] : null,
        ) ?? AgeBand::CHILD;

        $parsed = $this->completeJson(
            $childId,
            'waiting',
            [
                ['role' => 'system', 'content' => $this->systemPrompt('waiting_copy_writer')],
                ['role' => 'user', 'content' => json_encode([
                    'kind' => $kind,
                    'world_theme' => $theme,
                    'age_band' => $band,
                ], JSON_UNESCAPED_UNICODE)],
            ],
            'adventure_waiting',
            0.7,
            static fn (?array $p): ?string => ZoneNarrativeGuard::validateWaitingBundle($p),
        );

        $lines = [];
        foreach ($parsed['lines'] ?? [] as $line) {
            if (is_string($line) && trim($line) !== '') {
                $lines[] = trim($line);
            }
        }

        return ['lines' => $lines, 'kind' => $kind, 'ttl_hours' => 24];
    }

    /**
     * @param array<string,mixed> $child
     * @return array{stem:string,input_mode:string,options:list<array{id:string,label:string}>,canonical_option:string}
     */
    public static function pickChallengeItem(array $child, string $subject, string $levelId, int $gateIndex): array
    {
        return ChallengePlanner::pickItem($subject, $levelId, $gateIndex);
    }
}
