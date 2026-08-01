<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

/**
 * Ranking interno de modelos free (mayor score = intentar primero).
 */
final class FreeModelRanker
{
    public const PROFILE_DEFAULT = 'default';
    public const PROFILE_QUALITY = 'quality';

    /**
     * @param list<array{
     *   id:string,
     *   name?:string|null,
     *   context_length?:int|null,
     *   fail_count_window?:int,
     *   last_success_at?:string|null
     * }> $models
     * @param list<string> $preferenceOrdered semilla opcional (solo si el operador la define en env)
     * @return list<array{id:string,score:float,name?:string|null,context_length?:int|null}>
     */
    public function rank(
        array $models,
        array $preferenceOrdered = [],
        string $profile = self::PROFILE_DEFAULT,
    ): array {
        $prefIndex = [];
        foreach (array_values($preferenceOrdered) as $i => $id) {
            $prefIndex[$id] = $i;
        }
        $prefCount = max(count($preferenceOrdered), 1);

        $scored = [];
        foreach ($models as $model) {
            $id = (string) ($model['id'] ?? '');
            if ($id === '') {
                continue;
            }
            $score = 0.0;

            if (array_key_exists($id, $prefIndex)) {
                $score += 40.0 * (1.0 - ($prefIndex[$id] / $prefCount));
            }

            $ctx = (int) ($model['context_length'] ?? 0);
            if ($profile === self::PROFILE_QUALITY) {
                if ($ctx > 0) {
                    $score += min(22.0, $ctx / 5500.0);
                }
                $params = $this->inferParamBillions($id);
                if ($params > 0.0) {
                    $score += min(30.0, $params * 0.42);
                }
                if (preg_match('/(instruct|chat)/i', $id) === 1) {
                    $score += 6.0;
                }
                if (preg_match('/(embed|vision|image|ocr)/i', $id) === 1) {
                    $score -= 28.0;
                }
            } elseif ($ctx > 0) {
                $score += min(10.0, $ctx / 16000.0);
            }

            if (!empty($model['last_success_at'])) {
                $score += 15.0;
            } else {
                $score -= 5.0;
            }

            $fails = (int) ($model['fail_count_window'] ?? 0);
            $score -= min(40.0, 5.0 * $fails);

            $scored[] = [
                'id' => $id,
                'score' => $score,
                'name' => $model['name'] ?? null,
                'context_length' => $model['context_length'] ?? null,
            ];
        }

        usort($scored, static function (array $a, array $b): int {
            return $b['score'] <=> $a['score'] ?: strcmp($a['id'], $b['id']);
        });

        return $scored;
    }

    private function inferParamBillions(string $modelId): float
    {
        if (preg_match('/(\d+(?:\.\d+)?)\s*b\b/i', $modelId, $match) !== 1) {
            return 0.0;
        }

        return (float) $match[1];
    }
}
