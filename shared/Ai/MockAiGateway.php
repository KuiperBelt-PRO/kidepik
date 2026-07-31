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
            ], JSON_UNESCAPED_UNICODE),
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

    private static function defaultMentorLine(string $lastUser): string
    {
        if ($lastUser === '') {
            return 'Estoy contigo en este viaje. ¿Seguimos?';
        }

        return 'He escuchado tu respuesta. Sigamos adelante juntos.';
    }
}
