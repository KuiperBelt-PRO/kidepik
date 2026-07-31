<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

/**
 * Filtra y normaliza el catálogo OpenRouter a modelos free.
 */
final class FreeModelCatalog
{
    /**
     * @param list<array<string,mixed>> $rawModels OpenRouter `data[]`
     * @param list<string> $denylist
     * @return list<array{id:string,name:?string,context_length:?int,pricing_prompt:float,pricing_completion:float}>
     */
    public function filterFree(array $rawModels, array $denylist = []): array
    {
        $deny = array_fill_keys(array_map('strval', $denylist), true);
        $out = [];

        foreach ($rawModels as $row) {
            if (!is_array($row)) {
                continue;
            }
            $id = isset($row['id']) && is_string($row['id']) ? $row['id'] : '';
            if ($id === '' || isset($deny[$id])) {
                continue;
            }
            if (!$this->isFree($row)) {
                continue;
            }
            // Solo texto de chat: excluir embeddings puros si el id lo indica.
            if (str_contains($id, 'embed')) {
                continue;
            }

            $pricing = is_array($row['pricing'] ?? null) ? $row['pricing'] : [];
            $out[] = [
                'id' => $id,
                'name' => isset($row['name']) && is_string($row['name']) ? $row['name'] : null,
                'context_length' => isset($row['context_length']) ? (int) $row['context_length'] : null,
                'pricing_prompt' => $this->priceFloat($pricing['prompt'] ?? 0),
                'pricing_completion' => $this->priceFloat($pricing['completion'] ?? 0),
            ];
        }

        return $out;
    }

    /** @param array<string,mixed> $row */
    public function isFree(array $row): bool
    {
        $id = isset($row['id']) && is_string($row['id']) ? $row['id'] : '';
        if ($id !== '' && str_ends_with($id, ':free')) {
            return true;
        }
        $pricing = is_array($row['pricing'] ?? null) ? $row['pricing'] : [];
        $prompt = $this->priceFloat($pricing['prompt'] ?? null);
        $completion = $this->priceFloat($pricing['completion'] ?? null);

        return $prompt <= 0.0 && $completion <= 0.0
            && array_key_exists('prompt', $pricing)
            && array_key_exists('completion', $pricing);
    }

    private function priceFloat(mixed $value): float
    {
        if ($value === null) {
            return 1.0; // desconocido → no free
        }
        if (is_string($value) || is_int($value) || is_float($value)) {
            return (float) $value;
        }

        return 1.0;
    }
}
