<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

/**
 * Ranking interno de modelos free (mayor score = intentar primero).
 */
final class FreeModelRanker
{
    /**
     * @param list<array{
     *   id:string,
     *   name?:string|null,
     *   context_length?:int|null,
     *   fail_count_window?:int,
     *   last_success_at?:string|null
     * }> $models
     * @param list<string> $preferenceOrdered
     * @return list<array{id:string,score:float,name?:string|null,context_length?:int|null}>
     */
    public function rank(array $models, array $preferenceOrdered = []): array
    {
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
            if ($ctx > 0) {
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
}
