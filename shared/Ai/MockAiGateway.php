<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

/**
 * Respuestas deterministas sin red (`AI_MOCK=true`).
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
            $item = match ($subject) {
                'math', 'finance' => [
                    'slot' => $slotIdx,
                    'subject_id' => $subject,
                    'item_key' => "agent_{$subject}_{$nonce}_{$slotIdx}",
                    'item_type' => 'numeric',
                    'difficulty' => $diff,
                    'prompt_text' => "¿Cuánto es {$n} + {$m}?",
                    'narrative_wrapper' => $wrap,
                    'explanation' => "{$n} + {$m} = " . ($n + $m) . '.',
                    'canonical_answer' => ['numeric' => $n + $m, 'tolerance' => 0],
                ],
                'language', 'reading', 'communication' => [
                    'slot' => $slotIdx,
                    'subject_id' => $subject,
                    'item_key' => "agent_{$subject}_{$nonce}_{$slotIdx}",
                    'item_type' => 'short_text',
                    'difficulty' => $diff,
                    'prompt_text' => "Escribe el plural de la palabra «luz» (variante {$n}).",
                    'narrative_wrapper' => $wrap,
                    'explanation' => 'El plural de luz es luces.',
                    'canonical_answer' => ['keywords' => ['luces']],
                ],
                default => [
                    'slot' => $slotIdx,
                    'subject_id' => $subject,
                    'item_key' => "agent_{$subject}_{$nonce}_{$slotIdx}",
                    'item_type' => 'mcq',
                    'difficulty' => $diff,
                    'prompt_text' => "¿Cuál principio refuerza mejor la convivencia en una comunidad ({$subject}, eco {$n})?",
                    'narrative_wrapper' => $wrap,
                    'explanation' => 'La opción correcta equilibra derechos y responsabilidades sin concentrar el poder.',
                    'options' => [
                        ['id' => 'a', 'label' => 'Concentrar todas las decisiones en una sola autoridad sin revisión'],
                        ['id' => 'b', 'label' => 'Distribuir poder con contrapesos y revisión periódica de acuerdos'],
                        ['id' => 'c', 'label' => 'Eliminar toda norma para que cada persona decida sin límites'],
                        ['id' => 'd', 'label' => 'Delegar el gobierno solo a expertos sin participación ciudadana'],
                    ],
                    'canonical_answer' => ['option_id' => 'b'],
                ],
            };
            // band_early solo mcq
            if ($band === AgeBand::EARLY && ($item['item_type'] ?? '') !== 'mcq') {
                $item['item_type'] = 'mcq';
                $item['options'] = [
                    ['id' => 'a', 'label' => (string) ($n + $m)],
                    ['id' => 'b', 'label' => (string) ($n + $m + 1)],
                    ['id' => 'c', 'label' => (string) max(1, $n - 1)],
                ];
                $item['canonical_answer'] = ['option_id' => 'a'];
                $item['prompt_text'] = "¿Cuánto es {$n} + {$m}?";
                unset($item['canonical_answer']['numeric'], $item['canonical_answer']['keywords'], $item['canonical_answer']['tolerance']);
            }
            $items[] = $item;
        }

        return (string) json_encode(['items' => $items], JSON_UNESCAPED_UNICODE);
    }

    private static function defaultMentorLine(string $lastUser): string
    {
        if ($lastUser === '') {
            return 'Estoy contigo en este viaje. ¿Seguimos?';
        }

        return 'He escuchado tu respuesta. Sigamos adelante juntos.';
    }
}
