<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

use Kidepik\Shared\Config;

/**
 * Compone el examen de acceso vía agente (mentor). Sin banco seed en producción.
 * SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE (A1: solo agente).
 */
final class PlacementExamComposer
{
    private const MAX_COMPOSE_ATTEMPTS = 3;

    public function __construct(
        private readonly ?AiGateway $gateway = null,
        private readonly ?PlacementNarrator $narrator = null,
        private readonly PlacementItemValidator $validator = new PlacementItemValidator(),
    ) {
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
        if ($slots === []) {
            return [];
        }

        $this->shuffle($slots);

        for ($attempt = 0; $attempt < self::MAX_COMPOSE_ATTEMPTS; $attempt++) {
            $generated = $this->generateWithAgent($child, $band, $slots, $avoidKeys, $avoidPrompts);
            if ($generated === null) {
                continue;
            }
            $queue = $this->requireCompleteSlots($generated, $slots);
            if ($queue === null) {
                continue;
            }

            return $this->decorateAll($queue, $child);
        }

        return [];
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
     * @param list<string> $slots
     * @param list<string> $avoidKeys
     * @param list<string> $avoidPrompts
     * @param array<string,mixed> $child
     * @return list<array<string,mixed>|null>|null
     */
    private function generateWithAgent(
        array $child,
        string $band,
        array $slots,
        array $avoidKeys,
        array $avoidPrompts,
    ): ?array {
        $gateway = $this->gateway ?? AiGateway::fromConfig();
        if (!Config::aiMock() && !$gateway->isEnabled()) {
            return null;
        }

        [$minDiff, $maxDiff] = SubjectCatalog::difficultyRange($band);
        $allowedTypes = SubjectCatalog::allowedItemTypes($band);
        [$minWords, $maxWords] = SubjectCatalog::proseWordRange($band);
        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $mentorId = MentorCatalog::idForWorldTheme($theme);
        $profile = MentorCatalog::profile($mentorId);
        $nonce = bin2hex(random_bytes(8));

        $slotPayload = [];
        foreach ($slots as $i => $subject) {
            $slotPayload[] = [
                'slot' => $i,
                'subject_id' => $subject,
                'subject_label' => SubjectCatalog::META[$subject]['label'] ?? $subject,
            ];
        }

        try {
            $slotCount = count($slots);
            $maxTokens = min(8192, 1400 + $slotCount * 480);
            $gw = Config::aiMock() ? AiGateway::fromConfig() : $gateway;
            $result = $gw->complete([
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
                        'instruction' => 'Diseña una prueba de ingreso NUEVA y distinta. Prohibido repetir retos ya usados. Español de España.',
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
            ], [
                'purpose' => 'placement_exam_composer',
                'temperature' => 0.68,
                'max_tokens' => $maxTokens,
                'child_id' => isset($child['id']) ? (string) $child['id'] : null,
            ]);
        } catch (\Throwable) {
            return null;
        }

        $parsed = json_decode($result['content'], true);
        if (!is_array($parsed) || !is_array($parsed['items'] ?? null)) {
            return null;
        }

        $bySlot = [];
        foreach ($parsed['items'] as $row) {
            if (!is_array($row)) {
                continue;
            }
            $slot = isset($row['slot']) ? (int) $row['slot'] : null;
            if ($slot === null && isset($row['subject_id'])) {
                foreach ($slots as $i => $subject) {
                    if (($row['subject_id'] ?? '') === $subject && !isset($bySlot[$i])) {
                        $slot = $i;
                        break;
                    }
                }
            }
            if ($slot === null || $slot < 0 || $slot >= count($slots) || isset($bySlot[$slot])) {
                continue;
            }
            $normalized = $this->validator->normalize(
                $row,
                $slots[$slot],
                $band,
                $minDiff,
                $maxDiff,
                $allowedTypes,
                $slot,
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

        if (count($bySlot) === 0) {
            return null;
        }

        $ordered = [];
        foreach ($slots as $i => $_subject) {
            $ordered[$i] = $bySlot[$i] ?? null;
        }

        return $ordered;
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
Eres {$mentorName}, mentor del mundo {$theme}. Diseñas la prueba de ingreso UNA VEZ, completa.
Idioma: castellano de España (NO latinoamericano). Usa léxico de España (ordenador, móvil, coche, piso…).
Di «diseñar / preparar / componer la prueba», nunca «armar un examen».
Prosa literaria del género (fantasía épica o space opera). Sin jerga de «examen escolar».
age_band={$band}. Dificultad de cada ítem entre {$minDiff} y {$maxDiff}. Tipos permitidos: {$types}.
Cada reto debe ser ORIGINAL (números, ejemplos y enunciados distintos en cada generación).
Cada narrative_wrapper debe ser distinta entre ítems; prohibido repetir frases o fórmulas («En el atrio…», «Prueba N de M», «Reto N de M» como única voz, etc.).
Incluye explanation breve para enseñar si fallan.

MCQ (muy importante para tween/teen/adult/senior):
- Preferible 4 opciones; todas creíbles, misma longitud aproximada y mismo tono.
- Distractores = errores PLAUSIBLES del mismo tema (conceptos vecinos, matices incorrectos, causas invertidas).
- PROHIBIDO opciones absurdas, chistes o temas ajenos (bandera, pan, deporte, moda…) si no van con el enunciado.
- PROHIBIDO que solo la correcta sea larga/elaborada y el resto sean frases cortas obvias.
- La correcta no debe ser siempre la más larga.

JSON estricto:
{"items":[{"slot":0,"subject_id":"...","item_key":"unico","item_type":"mcq|short_text|numeric","difficulty":N,"prompt_text":"...","narrative_wrapper":"...","explanation":"...","options":[{"id":"a","label":"..."}],"canonical_answer":{"option_id":"a"}}]}
Para numeric: canonical_answer={"numeric":N,"tolerance":0}. Para short_text: canonical_answer={"keywords":["..."]}.
Un ítem por slot, mismo subject_id que el slot. Longitud orientativa del prompt+wrapper: {$minWords}-{$maxWords} palabras juntos.
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
