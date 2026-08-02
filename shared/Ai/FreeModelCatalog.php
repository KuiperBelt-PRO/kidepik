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
            if (!$this->isChatCapable($row)) {
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
        if ($id === '' || !str_ends_with($id, ':free')) {
            return false;
        }

        $pricing = is_array($row['pricing'] ?? null) ? $row['pricing'] : [];
        if ($pricing === []) {
            return true;
        }

        $prompt = $this->priceFloat($pricing['prompt'] ?? null);
        $completion = $this->priceFloat($pricing['completion'] ?? null);

        return $prompt <= 0.0 && $completion <= 0.0;
    }

    /**
     * Solo modelos de chat con salida texto (excluye audio, imagen, vídeo, embeddings).
     *
     * @param array<string,mixed> $row
     */
    public function isChatCapable(array $row): bool
    {
        $id = isset($row['id']) && is_string($row['id']) ? strtolower($row['id']) : '';
        if ($id === '') {
            return false;
        }

        $blockedFragments = [
            'embed',
            'lyria',
            '/clip',
            'clip-',
            'tts',
            'whisper',
            'dall-e',
            'dalle',
            'stable-diffusion',
            'flux',
            'image',
            'vision-only',
            '/audio',
            'music',
            'suno',
        ];
        foreach ($blockedFragments as $fragment) {
            if (str_contains($id, $fragment)) {
                return false;
            }
        }

        $architecture = is_array($row['architecture'] ?? null) ? $row['architecture'] : [];
        $outputModalities = $architecture['output_modalities'] ?? null;
        if (is_array($outputModalities)) {
            $normalized = array_map(static fn (mixed $m): string => strtolower((string) $m), $outputModalities);
            if ($normalized !== [] && !in_array('text', $normalized, true)) {
                return false;
            }
        }

        $modality = isset($architecture['modality']) && is_string($architecture['modality'])
            ? strtolower($architecture['modality'])
            : '';
        if ($modality !== '' && !str_contains($modality, 'text') && $modality !== 'chat') {
            return false;
        }

        return true;
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
