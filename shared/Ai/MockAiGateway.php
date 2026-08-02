<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

/**
 * Respuestas deterministas para tests PHPUnit (gateway con chatFn inyectado).
 */
final class MockAiGateway
{
    /**
     * @param list<array{role:string,content:string}> $messages
     * @param array{purpose?:string} $opts
     * @return array{content:string,raw_model:string}
     */
    public static function complete(string $modelId, array $messages, array $opts = []): array
    {
        $purpose = $opts['purpose'] ?? 'dialogue';
        $lastUser = '';
        for ($i = count($messages) - 1; $i >= 0; $i--) {
            if (($messages[$i]['role'] ?? '') === 'user') {
                $lastUser = (string) ($messages[$i]['content'] ?? '');
                break;
            }
        }

        $envelope = match ($purpose) {
            'summary', 'journey_summarizer' => json_encode([
                'summary' => 'Resumen mock del viaje hasta ahora.',
                'structured' => ['open_threads' => []],
            ], JSON_UNESCAPED_UNICODE),
            'placement_item' => json_encode([
                'item_key' => 'mock_item',
                'subject_id' => 'math',
                'item_type' => 'mcq',
                'difficulty' => 1,
                'prompt_text' => '¿Cuánto es 2+2?',
                'options' => [
                    ['id' => 'a', 'label' => '3'],
                    ['id' => 'b', 'label' => '4'],
                ],
                'canonical_answer' => ['option_id' => 'b'],
            ], JSON_UNESCAPED_UNICODE),
            'placement_item_writer' => json_encode([
                'prompt_text' => self::mockRewritePrompt($lastUser),
                'narrative_wrapper' => 'El umbral se ilumina con una pregunta del saber.',
            ], JSON_UNESCAPED_UNICODE),
            'placement_exam_batch_writer' => self::mockBatchRewrite($lastUser),
            'placement_exam_composer' => self::mockExamComposer($lastUser),
            'adventure_pitch' => self::mockAdventurePitch($lastUser),
            'adventure_scene' => self::mockAdventureScene($lastUser),
            'adventure_challenge' => self::mockAdventureChallenge($lastUser),
            'adventure_waiting' => self::mockAdventureWaiting($lastUser),
            default => json_encode([
                'agent_text' => self::defaultMentorLine($lastUser),
                'input_mode' => 'continue',
                'options' => [],
                'effects' => [],
                'meta' => ['mock' => true, 'echo' => mb_substr($lastUser, 0, 80)],
            ], JSON_UNESCAPED_UNICODE),
        };

        return [
            'content' => (string) $envelope,
            'raw_model' => $modelId,
        ];
    }

    private static function mockRewritePrompt(string $lastUser): string
    {
        $decoded = json_decode($lastUser, true);
        $base = is_array($decoded) && isset($decoded['prompt_text']) && is_string($decoded['prompt_text'])
            ? $decoded['prompt_text']
            : '¿Cuánto es 2 + 2?';
        $theme = is_array($decoded) ? (string) ($decoded['world_theme'] ?? 'fantasy') : 'fantasy';

        return $theme === 'sci-fi'
            ? 'La consola de la Academia proyecta: ' . $base
            : 'Las runas de la Escuela preguntan: ' . $base;
    }

    private static function mockBatchRewrite(string $lastUser): string
    {
        $decoded = json_decode($lastUser, true);
        $items = is_array($decoded['items'] ?? null) ? $decoded['items'] : [];
        $theme = is_array($decoded) ? (string) ($decoded['world_theme'] ?? 'fantasy') : 'fantasy';
        $out = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $key = (string) ($item['item_key'] ?? '');
            $base = (string) ($item['prompt_text'] ?? '');
            if ($key === '' || $base === '') {
                continue;
            }
            $out[] = [
                'item_key' => $key,
                'prompt_text' => $theme === 'sci-fi'
                    ? 'La consola proyecta: ' . $base
                    : 'Las runas susurran: ' . $base,
                'narrative_wrapper' => (string) ($item['narrative_wrapper'] ?? 'El umbral aguarda.'),
            ];
        }

        return json_encode(['items' => $out], JSON_UNESCAPED_UNICODE);
    }

    private static function mockExamComposer(string $lastUser): string
    {
        $decoded = json_decode($lastUser, true);
        $slots = is_array($decoded['slots'] ?? null) ? $decoded['slots'] : [];
        $nonce = is_array($decoded) ? (string) ($decoded['nonce'] ?? 'seed') : 'seed';
        $theme = is_array($decoded) ? (string) ($decoded['world_theme'] ?? 'fantasy') : 'fantasy';
        $band = is_array($decoded) ? (string) ($decoded['age_band'] ?? AgeBand::CHILD) : AgeBand::CHILD;
        [$minDiff, $maxDiff] = SubjectCatalog::difficultyRange($band);
        $allowedTypes = SubjectCatalog::allowedItemTypes($band);
        $diff = (int) floor(($minDiff + $maxDiff) / 2);
        $seed = abs(crc32($nonce));
        $items = [];
        foreach ($slots as $i => $slot) {
            if (!is_array($slot)) {
                continue;
            }
            $subject = (string) ($slot['subject_id'] ?? 'math');
            $slotIdx = (int) ($slot['slot'] ?? $i);
            $n = ($seed + $slotIdx * 17) % 40 + 3;
            $m = ($seed + $slotIdx * 31) % 9 + 2;
            $wrap = $theme === 'sci-fi'
                ? "Un nodo de datos se abre ante ti (eco {$nonce})."
                : "El umbral murmura un enigma fresco (eco {$nonce}).";
            $preferNumeric = in_array($subject, ['math', 'finance'], true) && in_array('numeric', $allowedTypes, true);
            $preferShort = in_array($subject, ['language', 'reading', 'communication'], true)
                && in_array('short_text', $allowedTypes, true)
                && !$preferNumeric;
            if ($preferNumeric) {
                $item = [
                    'slot' => $slotIdx,
                    'subject_id' => $subject,
                    'item_key' => "agent_{$subject}_{$nonce}_{$slotIdx}",
                    'item_type' => 'numeric',
                    'difficulty' => $diff,
                    'prompt_text' => "¿Cuánto es {$n} + {$m}?",
                    'narrative_wrapper' => $wrap,
                    'explanation' => "{$n} + {$m} = " . ($n + $m) . '.',
                    'canonical_answer' => ['numeric' => $n + $m, 'tolerance' => 0],
                ];
            } elseif ($preferShort) {
                $item = [
                    'slot' => $slotIdx,
                    'subject_id' => $subject,
                    'item_key' => "agent_{$subject}_{$nonce}_{$slotIdx}",
                    'item_type' => 'short_text',
                    'difficulty' => $diff,
                    'prompt_text' => "Escribe el plural de la palabra «luz» (variante {$n}).",
                    'narrative_wrapper' => $wrap,
                    'explanation' => 'El plural de luz es luces.',
                    'canonical_answer' => ['keywords' => ['luces']],
                ];
            } else {
                $sum = $n + $m;
                $item = [
                    'slot' => $slotIdx,
                    'subject_id' => $subject,
                    'item_key' => "agent_{$subject}_{$nonce}_{$slotIdx}",
                    'item_type' => 'mcq',
                    'difficulty' => $diff,
                    'prompt_text' => in_array($subject, ['math', 'finance'], true)
                        ? "¿Cuánto es {$n} + {$m}?"
                        : "¿Cuál principio refuerza mejor la convivencia en una comunidad ({$subject}, eco {$n})?",
                    'narrative_wrapper' => $wrap,
                    'explanation' => in_array($subject, ['math', 'finance'], true)
                        ? "{$n} + {$m} = {$sum}."
                        : 'La opción correcta equilibra derechos y responsabilidades sin concentrar el poder.',
                    'options' => in_array($subject, ['math', 'finance'], true)
                        ? [
                            ['id' => 'a', 'label' => (string) $sum],
                            ['id' => 'b', 'label' => (string) ($sum + 1)],
                            ['id' => 'c', 'label' => (string) max(1, $sum - 1)],
                            ['id' => 'd', 'label' => (string) ($sum + 2)],
                        ]
                        : [
                            ['id' => 'a', 'label' => 'Concentrar todas las decisiones en una sola autoridad sin revisión'],
                            ['id' => 'b', 'label' => 'Distribuir poder con contrapesos y revisión periódica de acuerdos'],
                            ['id' => 'c', 'label' => 'Eliminar toda norma para que cada persona decida sin límites'],
                            ['id' => 'd', 'label' => 'Delegar el gobierno solo a expertos sin participación ciudadana'],
                        ],
                    'canonical_answer' => [
                        'option_id' => in_array($subject, ['math', 'finance'], true) ? 'a' : 'b',
                    ],
                ];
            }
            $items[] = $item;
        }

        return (string) json_encode(['items' => $items], JSON_UNESCAPED_UNICODE);
    }

    private static function mockAdventurePitch(string $lastUser): string
    {
        $decoded = json_decode($lastUser, true);
        $zones = is_array($decoded['zones'] ?? null) ? $decoded['zones'] : [];
        $options = [];
        $i = 0;
        foreach ($zones as $z) {
            if (!is_array($z)) {
                continue;
            }
            $id = (string) ($z['zone_id'] ?? '');
            if ($id === '') {
                continue;
            }
            $label = (string) ($z['canonical_label'] ?? $id);
            $options[] = [
                'id' => $id,
                'label' => $label,
                'description' => "En {$label} hay un misterio fresco (eco {$i}).",
                'why_for_you' => match ($i) {
                    0 => 'Es un buen primer paso para ti ahora.',
                    1 => 'Te ayudará a practicar desde otro ángulo.',
                    default => 'Suma variedad a tu ruta de hoy.',
                },
            ];
            $i++;
        }

        return json_encode([
            'mentor_bridge' => 'Hay caminos abiertos. Mira las cartas y elige tu primer destino.',
            'options' => $options,
        ], JSON_UNESCAPED_UNICODE);
    }

    private static function mockAdventureScene(string $lastUser): string
    {
        $decoded = json_decode($lastUser, true);
        $zoneId = is_array($decoded) ? (string) ($decoded['zone_id'] ?? 'zone_logic') : 'zone_logic';
        $name = is_array($decoded) ? (string) ($decoded['display_name'] ?? 'explorador') : 'explorador';
        $label = match ($zoneId) {
            'zone_logic' => 'Laberinto de Espejos',
            'zone_math' => 'Bosque de los Números',
            'zone_language' => 'Montañas de la Gramática',
            'zone_science' => 'Jardines Alquímicos',
            'zone_culture' => 'Biblioteca de los Reinos',
            default => 'el lugar',
        };

        return json_encode([
            'agent_text' => "Llegamos a {$label}. Los espejos —o las señales— piden orden.\n\n"
                . "«{$name}, ayúdame a despejar el camino», dice el guardián local.\n\n"
                . 'Cuando quieras, afrontamos el primer obstáculo.',
            'npc_display' => [
                'archetype' => 'zone_guardian',
                'name' => $zoneId === 'zone_logic' ? 'Vigía de los Espejos' : 'Guardián del lugar',
                'one_line_voice' => 'Hablo claro y sin rodeos.',
            ],
        ], JSON_UNESCAPED_UNICODE);
    }

    private static function mockAdventureChallenge(string $lastUser): string
    {
        $decoded = json_decode($lastUser, true);
        if (is_array($decoded) && array_key_exists('success', $decoded)) {
            return json_encode([
                'success_text' => '¡Bien! El lugar recupera un poco de luz.',
                'near_miss_text' => 'Casi. Respira y probamos otra vez.',
            ], JSON_UNESCAPED_UNICODE);
        }
        $stem = is_array($decoded) ? (string) ($decoded['curriculum_stem'] ?? '¿Siguiente?') : '¿Siguiente?';
        $gate = is_array($decoded) ? (int) ($decoded['gate_index'] ?? 0) : 0;
        $total = is_array($decoded) ? (int) ($decoded['steps_total'] ?? 3) : 3;
        $n = $gate + 1;

        return json_encode([
            'narrative_wrapper' => "El guardián enciende una prueba ({$n} de {$total}).",
            'prompt_text' => $stem,
        ], JSON_UNESCAPED_UNICODE);
    }

    private static function mockAdventureWaiting(string $lastUser): string
    {
        $decoded = json_decode($lastUser, true);
        $kind = is_array($decoded) ? (string) ($decoded['kind'] ?? 'general') : 'general';

        return json_encode([
            'kind' => $kind,
            'generated_at' => gmdate('c'),
            'lines' => [
                'Un momento, preparo el siguiente paso…',
                'Consulto el mapa del viaje…',
                'Ajusto la ruta para ti…',
                'Casi listo…',
            ],
            'ttl_hours' => 24,
        ], JSON_UNESCAPED_UNICODE);
    }

    private static function defaultMentorLine(string $lastUser): string
    {
        if ($lastUser === '') {
            return 'Estoy contigo en este viaje. ¿Seguimos?';
        }

        return 'He escuchado tu respuesta. Sigamos adelante juntos.';
    }
}
