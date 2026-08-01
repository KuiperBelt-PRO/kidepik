<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

/**
 * Valida ítems de placement generados por el agente (scoring PHP).
 */
final class PlacementItemValidator
{
    /**
     * @param array<string,mixed> $raw
     * @param list<string> $allowedTypes
     * @return array<string,mixed>|null
     */
    public function normalize(
        array $raw,
        string $expectedSubject,
        string $ageBand,
        int $minDiff,
        int $maxDiff,
        array $allowedTypes,
        int $slotIndex,
        bool $lenientMcq = false,
    ): ?array {
        $subject = (string) ($raw['subject_id'] ?? $expectedSubject);
        if ($subject !== $expectedSubject || !SubjectCatalog::isValid($subject)) {
            $subject = $expectedSubject;
        }

        $type = (string) ($raw['item_type'] ?? 'mcq');
        if (!in_array($type, $allowedTypes, true)) {
            $type = $allowedTypes[0] ?? 'mcq';
        }

        $diff = (int) ($raw['difficulty'] ?? $minDiff);
        if ($diff < $minDiff || $diff > $maxDiff) {
            $diff = (int) floor(($minDiff + $maxDiff) / 2);
        }

        $prompt = trim((string) ($raw['prompt_text'] ?? ''));
        if ($prompt === '' || mb_strlen($prompt) > 800) {
            return null;
        }

        $key = trim((string) ($raw['item_key'] ?? ''));
        if ($key === '' || mb_strlen($key) > 80) {
            $key = sprintf('agent_%s_%d_%s', $subject, $slotIndex, substr(sha1($prompt), 0, 8));
        }

        $item = [
            'item_key' => $key,
            'subject_id' => $subject,
            'item_type' => $type,
            'difficulty' => $diff,
            'prompt_text' => $prompt,
            'source' => 'agent',
            'bands' => [$ageBand],
        ];

        $wrap = trim((string) ($raw['narrative_wrapper'] ?? ''));
        if ($wrap !== '' && mb_strlen($wrap) <= 500) {
            $item['narrative_wrapper'] = $wrap;
        }

        $expl = trim((string) ($raw['explanation'] ?? ''));
        if ($expl !== '' && mb_strlen($expl) <= 400) {
            $item['explanation'] = $expl;
        }

        $canonical = is_array($raw['canonical_answer'] ?? null) ? $raw['canonical_answer'] : [];

        if ($type === 'mcq') {
            $options = $this->normalizeOptions($raw['options'] ?? null);
            if ($options === null) {
                return null;
            }
            $want = (string) ($canonical['option_id'] ?? '');
            $ids = array_map(static fn (array $o): string => (string) $o['id'], $options);
            if ($want === '' || !in_array($want, $ids, true)) {
                return null;
            }
            if (!$lenientMcq && !$this->mcqOptionsArePlausible($options, $want, $prompt, $ageBand)) {
                return null;
            }
            $item['options'] = $options;
            $item['canonical_answer'] = ['option_id' => $want];

            return $item;
        }

        if ($type === 'numeric') {
            if (!isset($canonical['numeric']) || !is_numeric((string) $canonical['numeric'])) {
                return null;
            }
            $item['canonical_answer'] = [
                'numeric' => (float) $canonical['numeric'],
                'tolerance' => isset($canonical['tolerance']) ? (float) $canonical['tolerance'] : 0.0,
            ];

            return $item;
        }

        // short_text
        $keywords = $canonical['keywords'] ?? null;
        if (!is_array($keywords) || $keywords === []) {
            return null;
        }
        $clean = [];
        foreach ($keywords as $kw) {
            if (is_string($kw) && trim($kw) !== '') {
                $clean[] = trim($kw);
            }
        }
        if ($clean === []) {
            return null;
        }
        $item['canonical_answer'] = ['keywords' => array_values(array_unique($clean))];

        return $item;
    }

    /**
     * @param mixed $options
     * @return list<array{id:string,label:string}>|null
     */
    private function normalizeOptions(mixed $options): ?array
    {
        if (!is_array($options) || count($options) < 2 || count($options) > 5) {
            return null;
        }
        $out = [];
        $seen = [];
        foreach ($options as $opt) {
            if (!is_array($opt)) {
                return null;
            }
            $id = trim((string) ($opt['id'] ?? ''));
            $label = trim((string) ($opt['label'] ?? ''));
            if ($id === '' || $label === '' || isset($seen[$id])) {
                return null;
            }
            $seen[$id] = true;
            $out[] = ['id' => $id, 'label' => $label];
        }

        return $out;
    }

    /**
     * Rechaza MCQ con distractores obvios o desequilibrados (típico de modelos pequeños).
     *
     * @param list<array{id:string,label:string}> $options
     */
    private function mcqOptionsArePlausible(
        array $options,
        string $correctId,
        string $prompt,
        string $ageBand,
    ): bool {
        $correctLabel = '';
        $wrongLabels = [];
        foreach ($options as $opt) {
            $label = trim((string) ($opt['label'] ?? ''));
            if ((string) ($opt['id'] ?? '') === $correctId) {
                $correctLabel = $label;
            } else {
                $wrongLabels[] = $label;
            }
        }

        if ($correctLabel === '' || $wrongLabels === []) {
            return false;
        }

        if (count(array_unique($wrongLabels)) < count($wrongLabels)) {
            return false;
        }

        $strictBand = in_array($ageBand, [AgeBand::TEEN, AgeBand::ADULT, AgeBand::SENIOR], true);
        $correctLen = mb_strlen($correctLabel);
        $promptLower = mb_strtolower($prompt);

        if ($strictBand && $correctLen >= 28) {
            $minWrongLen = max(20, (int) floor($correctLen * 0.42));
            foreach ($wrongLabels as $wrong) {
                if (mb_strlen($wrong) < $minWrongLen) {
                    return false;
                }
            }
        }

        foreach ($wrongLabels as $wrong) {
            if ($this->looksLikeAbsurdDistractor($wrong, $promptLower)) {
                return false;
            }
        }

        if ($strictBand && count($options) < 3 && ($correctLen >= 28 || mb_strlen($prompt) >= 60)) {
            return false;
        }

        return true;
    }

    private function looksLikeAbsurdDistractor(string $label, string $promptLower): bool
    {
        $lower = mb_strtolower(trim($label));
        if ($lower === '') {
            return true;
        }

        $absurdNeedles = [
            'color de la bandera',
            'elegir el color',
            'precio del pan',
            'fijar el precio del pan',
            'sabor de la',
            'tamaño del castillo',
            'nombre del dragón',
            'contar las estrellas',
            'número de ventanas',
            'color del cielo',
            'elegir un animal',
            'tirar una moneda',
        ];

        foreach ($absurdNeedles as $needle) {
            if (str_contains($lower, $needle) && !str_contains($promptLower, $needle)) {
                return true;
            }
        }

        if (preg_match('/\b(elegir|fijar|poner|decidir)\s+(el|la|los|las)\s+(color|precio|sabor|tamaño|nombre)\b/u', $lower)
            && !preg_match('/\b(color|precio|sabor|tamaño|nombre)\b/u', $promptLower)) {
            return true;
        }

        return false;
    }
}
