<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

use Kidepik\Shared\Config;
use Kidepik\Shared\Logging\AppLogger;

/**
 * Compone el examen de acceso vía agente (mentor). Sin banco seed en producción.
 * SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE (A1 + A2 lotes paralelos).
 */
final class PlacementExamComposer
{
    private const MAX_COMPOSE_ATTEMPTS = 3;

    /** @var array<string, mixed> */
    private array $lastComposeDebug = [];

    public function __construct(
        private readonly ?AiGateway $gateway = null,
        private readonly ?PlacementNarrator $narrator = null,
        private readonly PlacementItemValidator $validator = new PlacementItemValidator(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getLastComposeDebug(): array
    {
        return $this->lastComposeDebug;
    }

    /**
     * @param list<string> $slots
     * @return list<list<string>>
     */
    public static function chunkSlots(array $slots, int $maxPerBatch): array
    {
        $maxPerBatch = max(1, $maxPerBatch);
        if ($slots === []) {
            return [];
        }
        if (count($slots) <= $maxPerBatch) {
            return [$slots];
        }

        return array_chunk($slots, $maxPerBatch);
    }

    /**
     * @param array<string,mixed> $child
     * @param list<string> $activeSubjects
     * @param list<string> $avoidKeys
     * @param list<string> $avoidPrompts
     * @return list<array<string,mixed>> cola completa o [] si el agente no pudo componer
     */
    public function compose(
        array $child,
        array $activeSubjects,
        array $avoidKeys = [],
        array $avoidPrompts = [],
    ): array {
        $band = AgeBand::fromLegacy(
            $child['age_band'] ?? null,
            isset($child['age_years']) ? (int) $child['age_years'] : null,
        ) ?? AgeBand::CHILD;

        $slots = SubjectCatalog::examSubjectSlots($band, $activeSubjects);
        $this->lastComposeDebug = $this->emptyComposeDebug(count($slots), $activeSubjects);

        if ($slots === []) {
            $this->lastComposeDebug['outcome'] = 'slots_incomplete';

            return [];
        }

        $this->shuffle($slots);

        $gateway = $this->gateway ?? AiGateway::fromConfig();
        if (!$gateway->isEnabled()) {
            $this->lastComposeDebug['outcome'] = 'ai_disabled';

            return [];
        }

        for ($attempt = 0; $attempt < self::MAX_COMPOSE_ATTEMPTS; $attempt++) {
            $this->lastComposeDebug['compose_attempts'] = $attempt + 1;
            $this->lastComposeDebug['batches'] = [];
            $generated = $this->composeBatched($child, $band, $slots, $avoidKeys, $avoidPrompts, $gateway);
            if ($generated === null) {
                if ($this->lastComposeDebug['outcome'] === 'ok') {
                    $this->lastComposeDebug['outcome'] = 'llm_empty';
                }
                continue;
            }
            $queue = $this->requireCompleteSlots($generated, $slots);
            if ($queue === null) {
                $this->lastComposeDebug['outcome'] = 'slots_incomplete';
                $this->lastComposeDebug['validation'] = $this->validationSummary($generated, $slots);
                continue;
            }

            $this->lastComposeDebug['outcome'] = 'ok';

            return $this->decorateAll($queue, $child);
        }

        $this->logComposeFailure($child);

        return [];
    }

    /**
     * @param list<string> $slots
     * @param list<string> $avoidKeys
     * @param list<string> $avoidPrompts
     * @param array<string,mixed> $child
     * @return list<array<string,mixed>|null>|null
     */
    private function composeBatched(
        array $child,
        string $band,
        array $slots,
        array $avoidKeys,
        array $avoidPrompts,
        AiGateway $gateway,
    ): ?array {
        $chunks = self::chunkSlots($slots, Config::aiComposeBatchMaxSlots());
        $concurrency = Config::aiComposeBatchConcurrency();
        $retries = Config::aiComposeBatchRetries();
        $sticky = Config::aiComposeStickyWinner();

        /** @var list<array{index:int,slots:list<string>,offset:int}> $jobs */
        $jobs = [];
        $offset = 0;
        foreach ($chunks as $bi => $chunk) {
            $jobs[] = ['index' => $bi, 'slots' => $chunk, 'offset' => $offset];
            $offset += count($chunk);
        }

        $merged = array_fill(0, count($slots), null);
        $preferredModels = [];
        $cursor = 0;

        while ($cursor < count($jobs)) {
            $wave = array_slice($jobs, $cursor, $concurrency);
            $cursor += count($wave);

            $waveResults = $this->runWave(
                $wave,
                $child,
                $band,
                $avoidKeys,
                $avoidPrompts,
                $gateway,
                $preferredModels,
                $retries,
                $sticky,
            );
            if ($waveResults === null) {
                return null;
            }

            foreach ($waveResults as $row) {
                foreach ($row['items'] as $globalIdx => $item) {
                    $merged[$globalIdx] = $item;
                }
                if ($sticky && $row['winner_model'] !== null && $row['winner_model'] !== '') {
                    $preferredModels = [$row['winner_model']];
                }
            }
        }

        return $merged;
    }

    /**
     * @param list<array{index:int,slots:list<string>,offset:int}> $wave
     * @param list<string> $avoidKeys
     * @param list<string> $avoidPrompts
     * @param list<string> $preferredModels
     * @param array<string,mixed> $child
     * @return list<array{items:array<int,array<string,mixed>|null>,winner_model:?string}>|null
     */
    private function runWave(
        array $wave,
        array $child,
        string $band,
        array $avoidKeys,
        array $avoidPrompts,
        AiGateway $gateway,
        array $preferredModels,
        int $retries,
        bool $sticky,
    ): ?array {
        if (count($wave) === 1 || $preferredModels === []) {
            $out = [];
            $prefs = $preferredModels;
            foreach ($wave as $job) {
                $result = $this->generateBatchWithRetries(
                    $child,
                    $band,
                    $job['slots'],
                    $job['offset'],
                    $job['index'],
                    $avoidKeys,
                    $avoidPrompts,
                    $gateway,
                    $prefs,
                    $retries,
                );
                if ($result === null) {
                    return null;
                }
                if ($sticky && $result['winner_model'] !== null && $result['winner_model'] !== '') {
                    $prefs = [$result['winner_model']];
                }
                $out[] = $result;
            }

            return $out;
        }

        // Paralelo con modelo sticky (misma ola).
        $stickyModel = $preferredModels[0];
        $prepared = [];
        foreach ($wave as $job) {
            $prepared[] = $this->buildBatchRequest($child, $band, $job['slots'], $job['offset'], $avoidKeys, $avoidPrompts);
        }

        $parallel = ParallelLlmBatch::chatMany(
            $stickyModel,
            array_map(static fn (array $p): array => [
                'messages' => $p['messages'],
                'opts' => $p['opts'],
            ], $prepared),
        );

        $out = [];
        foreach ($wave as $wi => $job) {
            $par = $parallel[$wi] ?? ['ok' => false, 'error' => 'missing'];
            $batchMeta = [
                'index' => $job['index'],
                'slot_count' => count($job['slots']),
                'offset' => $job['offset'],
                'model' => $stickyModel,
                'ok' => false,
                'latency_ms' => $par['latency_ms'] ?? null,
                'parallel' => true,
            ];

            $parsedItems = null;
            if (!empty($par['ok']) && isset($par['content']) && is_string($par['content'])) {
                $parsedItems = $this->parseAndNormalizeItems(
                    $par['content'],
                    $job['slots'],
                    $job['offset'],
                    $band,
                    $avoidPrompts,
                );
            }

            if ($parsedItems !== null) {
                $batchMeta['ok'] = true;
                $batchMeta['outcome'] = 'ok';
                $this->lastComposeDebug['batches'][] = $batchMeta;
                AppLogger::channel('compose')->info('placement_compose_batch', $batchMeta);
                $out[] = ['items' => $parsedItems, 'winner_model' => $sticky && $stickyModel !== '' ? $stickyModel : null];
                continue;
            }

            // Fallback secuencial con gateway completo.
            $result = $this->generateBatchWithRetries(
                $child,
                $band,
                $job['slots'],
                $job['offset'],
                $job['index'],
                $avoidKeys,
                $avoidPrompts,
                $gateway,
                $preferredModels,
                $retries,
            );
            if ($result === null) {
                $batchMeta['outcome'] = $this->lastComposeDebug['outcome'] ?? 'llm_empty';
                $this->lastComposeDebug['batches'][] = $batchMeta;
                AppLogger::channel('compose')->warning('placement_compose_batch', $batchMeta);

                return null;
            }
            $out[] = $result;
        }

        return $out;
    }

    /**
     * @param list<string> $batchSlots
     * @param list<string> $avoidKeys
     * @param list<string> $avoidPrompts
     * @param list<string> $preferredModels
     * @param array<string,mixed> $child
     * @return array{items:array<int,array<string,mixed>|null>,winner_model:?string}|null
     */
    private function generateBatchWithRetries(
        array $child,
        string $band,
        array $batchSlots,
        int $globalOffset,
        int $batchIndex,
        array $avoidKeys,
        array $avoidPrompts,
        AiGateway $gateway,
        array $preferredModels,
        int $retries,
    ): ?array {
        $attempts = max(1, $retries + 1);
        $winner = null;
        /** @var list<string> $excludeModels */
        $excludeModels = [];
        $prefs = $preferredModels;
        for ($i = 0; $i < $attempts; $i++) {
            $started = hrtime(true);
            $items = $this->generateWithAgent(
                $child,
                $band,
                $batchSlots,
                $globalOffset,
                $avoidKeys,
                $avoidPrompts,
                $gateway,
                $prefs,
                $excludeModels,
            );
            $latency = (int) round((hrtime(true) - $started) / 1_000_000);
            $trace = $gateway->getLastTrace();
            if ($trace !== null && $trace->winnerModel !== null) {
                $winner = $trace->winnerModel;
            }
            $outcome = $items !== null ? 'ok' : ($this->lastComposeDebug['outcome'] ?? 'llm_empty');
            $meta = [
                'index' => $batchIndex,
                'slot_count' => count($batchSlots),
                'offset' => $globalOffset,
                'attempt' => $i + 1,
                'ok' => $items !== null,
                'latency_ms' => $latency,
                'model' => $winner,
                'outcome' => $outcome,
                'parallel' => false,
            ];
            $this->lastComposeDebug['batches'][] = $meta;
            AppLogger::channel('compose')->{$items !== null ? 'info' : 'warning'}('placement_compose_batch', $meta);

            if ($items !== null) {
                return ['items' => $items, 'winner_model' => $winner];
            }

            if ($winner !== null && $winner !== '') {
                $excludeModels[] = $winner;
                $prefs = [];
                (new AiModelCooldownStore())->recordFailure(
                    'placement_exam_composer',
                    $winner,
                    'compose_parse',
                    null,
                    (string) $outcome,
                );
            }
        }

        return null;
    }

    /**
     * @param array<string,mixed> $child
     * @param list<string> $batchSlots
     * @param list<string> $avoidKeys
     * @param list<string> $avoidPrompts
     * @return array{messages:list<array{role:string,content:string}>,opts:array<string,mixed>,band:string,minDiff:int,maxDiff:int,allowedTypes:list<string>}
     */
    private function buildBatchRequest(
        array $child,
        string $band,
        array $batchSlots,
        int $globalOffset,
        array $avoidKeys,
        array $avoidPrompts,
    ): array {
        [$minDiff, $maxDiff] = SubjectCatalog::difficultyRange($band);
        $allowedTypes = SubjectCatalog::allowedItemTypes($band);
        [$minWords, $maxWords] = SubjectCatalog::proseWordRange($band);
        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $mentorId = MentorCatalog::idForWorldTheme($theme);
        $profile = MentorCatalog::profile($mentorId);
        $nonce = bin2hex(random_bytes(8));

        $slotPayload = [];
        foreach ($batchSlots as $i => $subject) {
            $global = $globalOffset + $i;
            $slotPayload[] = [
                'slot' => $global,
                'subject_id' => $subject,
                'subject_label' => SubjectCatalog::META[$subject]['label'] ?? $subject,
            ];
        }

        $slotCount = count($batchSlots);
        $maxTokens = min(8192, 1400 + $slotCount * 480);

        return [
            'messages' => [
                [
                    'role' => 'system',
                    'content' => $this->systemPrompt(
                        $theme,
                        $band,
                        $profile['display_name'],
                        $minDiff,
                        $maxDiff,
                        $allowedTypes,
                        $minWords,
                        $maxWords,
                    ),
                ],
                [
                    'role' => 'user',
                    'content' => json_encode([
                        'nonce' => $nonce,
                        'instruction' => 'Diseña una prueba de ingreso NUEVA y distinta (solo estos slots). Prohibido repetir retos ya usados. Español de España.',
                        'display_name' => $child['display_name'] ?? null,
                        'age_years' => $child['age_years'] ?? null,
                        'age_band' => $band,
                        'world_theme' => $theme,
                        'difficulty_range' => [$minDiff, $maxDiff],
                        'allowed_item_types' => $allowedTypes,
                        'slots' => $slotPayload,
                        'avoid_item_keys' => array_values(array_slice($avoidKeys, 0, 40)),
                        'avoid_prompt_echo' => array_values(array_slice($avoidPrompts, 0, 20)),
                    ], JSON_UNESCAPED_UNICODE),
                ],
            ],
            'opts' => [
                'temperature' => 0.55,
                'max_tokens' => $maxTokens,
                'response_format' => ['type' => 'json_object'],
            ],
            'band' => $band,
            'minDiff' => $minDiff,
            'maxDiff' => $maxDiff,
            'allowedTypes' => $allowedTypes,
        ];
    }

    /**
     * @param list<string> $batchSlots
     * @param list<string> $avoidPrompts
     * @return array<int, array<string,mixed>|null>|null keyed by global slot index
     */
    private function parseAndNormalizeItems(
        string $content,
        array $batchSlots,
        int $globalOffset,
        string $band,
        array $avoidPrompts,
    ): ?array {
        [$minDiff, $maxDiff] = SubjectCatalog::difficultyRange($band);
        $allowedTypes = SubjectCatalog::allowedItemTypes($band);

        $parsed = LlmJsonPayload::decodeObject($content);
        if ($parsed === null) {
            $this->lastComposeDebug['outcome'] = 'json_invalid';
            $this->lastComposeDebug['parse_preview'] = mb_substr(trim($content), 0, 200);

            return null;
        }

        if (isset($parsed['agent_text'], $parsed['input_mode'])) {
            $this->lastComposeDebug['outcome'] = 'wrong_schema';
            $this->lastComposeDebug['parse_preview'] = mb_substr(trim($content), 0, 200);

            return null;
        }

        $rawItems = LlmJsonPayload::extractComposeItems($parsed);
        if ($rawItems === null) {
            $this->lastComposeDebug['outcome'] = 'wrong_schema';
            $this->lastComposeDebug['parse_preview'] = mb_substr(trim($content), 0, 200);

            return null;
        }

        $bySlot = $this->normalizeItemRows(
            $rawItems,
            $batchSlots,
            $globalOffset,
            $band,
            $minDiff,
            $maxDiff,
            $allowedTypes,
            $avoidPrompts,
            false,
        );

        if (count($bySlot) === 0) {
            $bySlot = $this->normalizeItemRows(
                $rawItems,
                $batchSlots,
                $globalOffset,
                $band,
                $minDiff,
                $maxDiff,
                $allowedTypes,
                $avoidPrompts,
                true,
            );
            if (count($bySlot) > 0) {
                $this->lastComposeDebug['validation'] = [
                    'parsed_items' => count($rawItems),
                    'accepted_items' => count($bySlot),
                    'lenient_mcq' => true,
                ];
            }
        }

        if (count($bySlot) === 0) {
            $this->lastComposeDebug['outcome'] = 'validation_rejected';
            $this->lastComposeDebug['validation'] = [
                'parsed_items' => count($rawItems),
                'accepted_items' => 0,
            ];

            return null;
        }

        $ordered = [];
        $missing = 0;
        foreach ($batchSlots as $i => $_subject) {
            $g = $globalOffset + $i;
            $item = $bySlot[$g] ?? null;
            if ($item === null) {
                $missing++;
            }
            $ordered[$g] = $item;
        }

        if ($missing > 0) {
            $this->lastComposeDebug['outcome'] = 'slots_incomplete';
            $this->lastComposeDebug['validation'] = [
                'parsed_items' => count($rawItems),
                'accepted_items' => count($bySlot),
                'missing_slots' => $missing,
            ];

            return null;
        }

        return $ordered;
    }

    /**
     * @param list<array<string,mixed>> $rawItems
     * @param list<string> $batchSlots
     * @param list<string> $avoidPrompts
     * @param list<string> $allowedTypes
     * @return array<int, array<string,mixed>>
     */
    private function normalizeItemRows(
        array $rawItems,
        array $batchSlots,
        int $globalOffset,
        string $band,
        int $minDiff,
        int $maxDiff,
        array $allowedTypes,
        array $avoidPrompts,
        bool $lenientMcq,
    ): array {
        $bySlot = [];
        foreach ($rawItems as $row) {
            $slot = isset($row['slot']) ? (int) $row['slot'] : null;
            if ($slot === null && isset($row['subject_id'])) {
                foreach ($batchSlots as $i => $subject) {
                    $g = $globalOffset + $i;
                    if (($row['subject_id'] ?? '') === $subject && !isset($bySlot[$g])) {
                        $slot = $g;
                        break;
                    }
                }
            }
            if ($slot === null || $slot < $globalOffset || $slot >= $globalOffset + count($batchSlots) || isset($bySlot[$slot])) {
                continue;
            }
            $local = $slot - $globalOffset;
            $normalized = $this->validator->normalize(
                $row,
                $batchSlots[$local],
                $band,
                $minDiff,
                $maxDiff,
                $allowedTypes,
                $slot,
                $lenientMcq,
            );
            if ($normalized === null) {
                continue;
            }
            foreach ($avoidPrompts as $old) {
                if (is_string($old) && $old !== '' && mb_strtolower($normalized['prompt_text']) === mb_strtolower($old)) {
                    $normalized = null;
                    break;
                }
            }
            if ($normalized === null) {
                continue;
            }
            $normalized['source'] = 'agent';
            $bySlot[$slot] = $normalized;
        }

        return $bySlot;
    }

    /**
     * @param array<string, mixed> $child
     */
    private function logComposeFailure(array $child): void
    {
        AppLogger::channel('compose')->warning('placement_compose_failed', [
            'child_id' => $child['id'] ?? null,
            'compose_debug' => $this->lastComposeDebug,
        ]);
    }

    /**
     * @param list<string> $activeSubjects
     * @return array<string, mixed>
     */
    private function emptyComposeDebug(int $slotCount, array $activeSubjects): array
    {
        return [
            'outcome' => 'llm_empty',
            'slot_count' => $slotCount,
            'subjects' => $activeSubjects,
            'compose_attempts' => 0,
            'llm_traces' => [],
            'batches' => [],
            'validation' => null,
        ];
    }

    /**
     * @param list<array<string,mixed>|null> $generated
     * @param list<string> $slots
     * @return list<array<string,mixed>>|null
     */
    private function requireCompleteSlots(array $generated, array $slots): ?array
    {
        $out = [];
        foreach ($slots as $i => $_subject) {
            $item = $generated[$i] ?? null;
            if (!is_array($item)) {
                return null;
            }
            $item['source'] = 'agent';
            $out[] = $item;
        }

        return $out;
    }

    /**
     * @param list<array<string,mixed>|null> $generated
     * @param list<string> $slots
     * @return array{missing_slots:list<int>,invalid_keys:list<string>}
     */
    private function validationSummary(array $generated, array $slots): array
    {
        $missing = [];
        $invalid = [];
        foreach ($slots as $i => $_subject) {
            $item = $generated[$i] ?? null;
            if (!is_array($item)) {
                $missing[] = $i;
                continue;
            }
            $key = (string) ($item['item_key'] ?? '');
            if ($key === '') {
                $invalid[] = "slot_{$i}";
            }
        }

        return ['missing_slots' => $missing, 'invalid_keys' => $invalid];
    }

    /**
     * @param list<string> $batchSlots
     * @param list<string> $avoidKeys
     * @param list<string> $avoidPrompts
     * @param list<string> $preferredModels
     * @param list<string> $excludeModels
     * @param array<string,mixed> $child
     * @return array<int,array<string,mixed>|null>|null
     */
    private function generateWithAgent(
        array $child,
        string $band,
        array $batchSlots,
        int $globalOffset,
        array $avoidKeys,
        array $avoidPrompts,
        AiGateway $gateway,
        array $preferredModels = [],
        array $excludeModels = [],
    ): ?array {
        $req = $this->buildBatchRequest($child, $band, $batchSlots, $globalOffset, $avoidKeys, $avoidPrompts);
        $captureTrace = Config::aiDebugEnabled();

        try {
            $gw = $gateway;
            $opts = [
                'purpose' => 'placement_exam_composer',
                'temperature' => $req['opts']['temperature'],
                'max_tokens' => $req['opts']['max_tokens'],
                'child_id' => isset($child['id']) ? (string) $child['id'] : null,
                'capture_trace' => $captureTrace,
            ];
            if (isset($req['opts']['response_format']) && is_array($req['opts']['response_format'])) {
                $opts['response_format'] = $req['opts']['response_format'];
            }
            if ($preferredModels !== []) {
                $opts['preferred_models'] = $preferredModels;
            }
            if ($excludeModels !== []) {
                $opts['exclude_models'] = $excludeModels;
            }
            $result = $gw->complete($req['messages'], $opts);
            $trace = $gw->getLastTrace();
            if ($trace !== null) {
                $this->lastComposeDebug['llm_traces'][] = $trace->toArray();
            }
        } catch (\Throwable $e) {
            $trace = $gateway->getLastTrace();
            if ($trace !== null) {
                $this->lastComposeDebug['llm_traces'][] = $trace->toArray();
            }
            $this->lastComposeDebug['outcome'] = 'exception';
            $this->lastComposeDebug['exception_brief'] = mb_substr($e->getMessage(), 0, 160);

            return null;
        }

        return $this->parseAndNormalizeItems(
            $result['content'],
            $batchSlots,
            $globalOffset,
            $band,
            $avoidPrompts,
        );
    }

    /**
     * @param list<string> $allowedTypes
     */
    private function systemPrompt(
        string $theme,
        string $band,
        string $mentorName,
        int $minDiff,
        int $maxDiff,
        array $allowedTypes,
        int $minWords,
        int $maxWords,
    ): string {
        $types = implode(', ', $allowedTypes);

        return <<<TXT
Eres {$mentorName}, mentor del mundo {$theme}. Diseñas un lote de la prueba de ingreso (solo los slots indicados).
Idioma: castellano de España (NO latinoamericano). Usa léxico de España (ordenador, móvil, coche, piso…).
Di «diseñar / preparar / componer la prueba», nunca «armar un examen».
Prosa literaria del género (fantasía épica o space opera). Sin jerga de «examen escolar».
age_band={$band}. Dificultad de cada ítem entre {$minDiff} y {$maxDiff}. Tipos permitidos: {$types}.
Cada reto debe ser ORIGINAL (números, ejemplos y enunciados distintos en cada generación).
Cada narrative_wrapper debe ser distinta entre ítems; prohibido repetir frases o fórmulas («En el atrio…», «Prueba N de M», «Reto N de M» como única voz, etc.).
Incluye explanation breve para enseñar si fallan.
Respeta el campo slot exactamente como viene en la entrada (índice global).

MCQ (muy importante para tween/teen/adult/senior):
- Preferible 4 opciones; todas creíbles, misma longitud aproximada y mismo tono.
- Distractores = errores PLAUSIBLES del mismo tema (conceptos vecinos, matices incorrectos, causas invertidas).
- PROHIBIDO opciones absurdas, chistes o temas ajenos (bandera, pan, deporte, moda…) si no van con el enunciado.
- PROHIBIDO que solo la correcta sea larga/elaborada y el resto sean frases cortas obvias.
- La correcta no debe ser siempre la más larga.

JSON estricto (sin markdown, sin texto antes ni después):
{"items":[{"slot":0,"subject_id":"...","item_key":"unico","item_type":"mcq|short_text|numeric","difficulty":N,"prompt_text":"...","narrative_wrapper":"...","explanation":"...","options":[{"id":"a","label":"..."}],"canonical_answer":{"option_id":"a"}}]}
Para numeric: canonical_answer={"numeric":N,"tolerance":0}. Para short_text: canonical_answer={"keywords":["..."]}.
Un ítem por slot, mismo subject_id que el slot. Longitud orientativa del prompt+wrapper: {$minWords}-{$maxWords} palabras juntos.
NUNCA uses agent_text, input_mode ni envelope de diálogo; solo el objeto con clave items.
TXT;
    }

    /**
     * @param list<array<string,mixed>> $queue
     * @param array<string,mixed> $child
     * @return list<array<string,mixed>>
     */
    private function decorateAll(array $queue, array $child): array
    {
        $narrator = $this->narrator ?? new PlacementNarrator();

        return $narrator->decorateItems($queue, $child);
    }

    /** @param list<mixed> $list */
    private function shuffle(array &$list): void
    {
        if (count($list) < 2) {
            return;
        }
        for ($i = count($list) - 1; $i > 0; $i--) {
            $j = random_int(0, $i);
            [$list[$i], $list[$j]] = [$list[$j], $list[$i]];
        }
    }
}
