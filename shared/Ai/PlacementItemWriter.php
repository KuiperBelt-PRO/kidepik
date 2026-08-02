<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

use Kidepik\Shared\Config;

/**
 * Prepara y reescribe ítems de placement al tono del mundo sin tocar canonical_answer.
 * SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE — preparación en bloque al inicio del examen.
 */
final class PlacementItemWriter
{
    public function __construct(
        private readonly ?AiGateway $gateway = null,
        private readonly ?PlacementNarrator $narrator = null,
    ) {
    }

    /**
     * Prepara toda la cola del examen de una vez (narrativa local + reescritura LLM opcional en lote).
     *
     * @param list<array<string,mixed>> $queue
     * @param array<string,mixed> $child
     * @return list<array<string,mixed>>
     */
    public function prepareQueue(array $queue, array $child): array
    {
        if ($queue === []) {
            return [];
        }

        $narrator = $this->narrator ?? new PlacementNarrator();
        $prepared = $narrator->decorateItems($queue, $child);

        $gateway = $this->gateway ?? AiGateway::fromConfig();
        if (!$gateway->isEnabled()) {
            return $prepared;
        }

        try {
            $rewritten = $this->rewriteQueueBatch($gateway, $prepared, $child);
            if ($rewritten !== null) {
                return $rewritten;
            }
        } catch (\Throwable) {
            // degradación: presentación local ya aplicada
        }

        return $prepared;
    }

    /**
     * @param array<string,mixed> $item
     * @param array<string,mixed> $child
     * @return array<string,mixed>
     */
    public function rewrite(array $item, array $child): array
    {
        $prepared = $this->prepareQueue([$item], $child);

        return $prepared[0] ?? $item;
    }

    /**
     * @param list<array<string,mixed>> $queue
     * @param array<string,mixed> $child
     * @return list<array<string,mixed>>|null
     */
    private function rewriteQueueBatch(AiGateway $gateway, array $queue, array $child): ?array
    {
        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $band = AgeBand::fromLegacy(
            $child['age_band'] ?? null,
            isset($child['age_years']) ? (int) $child['age_years'] : null,
        ) ?? AgeBand::CHILD;
        [$minWords, $maxWords] = SubjectCatalog::proseWordRange($band);

        $payload = [];
        foreach ($queue as $item) {
            $payload[] = [
                'item_key' => $item['item_key'] ?? null,
                'prompt_text' => $item['prompt_text'] ?? '',
                'narrative_wrapper' => $item['narrative_wrapper'] ?? '',
                'item_type' => $item['item_type'] ?? null,
                'subject_id' => $item['subject_id'] ?? null,
            ];
        }

        $result = $gateway->complete([
            [
                'role' => 'system',
                'content' => 'Eres el mentor del mundo (' . $theme . '). Reescribe TODOS los enunciados pedagógicos '
                    . 'en castellano de España (no latinoamericano) con prosa literaria del género, acorde a age_band=' . $band
                    . '. Longitud orientativa del prompt_text: ' . $minWords . '-' . $maxWords . ' palabras '
                    . 'si añades contexto; si no, mantén claridad. Varía la forma de plantear cada pregunta. '
                    . 'NO cambies respuestas correctas ni inventes datos. No uses «armar un examen». '
                    . 'JSON {"items":[{"item_key":"...","prompt_text":"...","narrative_wrapper":"..."}]} '
                    . '— un objeto por ítem, mismo item_key.',
            ],
            [
                'role' => 'user',
                'content' => json_encode([
                    'world_theme' => $theme,
                    'age_band' => $band,
                    'display_name' => $child['display_name'] ?? null,
                    'items' => $payload,
                ], JSON_UNESCAPED_UNICODE),
            ],
        ], ['purpose' => 'placement_exam_batch_writer', 'temperature' => 0.35, 'max_tokens' => 2200]);

        $parsed = json_decode($result['content'], true);
        if (!is_array($parsed) || !is_array($parsed['items'] ?? null)) {
            return null;
        }

        $byKey = [];
        foreach ($parsed['items'] as $row) {
            if (!is_array($row)) {
                continue;
            }
            $key = (string) ($row['item_key'] ?? '');
            if ($key !== '') {
                $byKey[$key] = $row;
            }
        }

        if ($byKey === []) {
            return null;
        }

        $narrator = $this->narrator ?? new PlacementNarrator();
        $total = count($queue);
        $out = [];
        foreach ($queue as $index => $item) {
            $key = (string) ($item['item_key'] ?? '');
            $patch = $byKey[$key] ?? null;
            if (is_array($patch)) {
                if (isset($patch['prompt_text']) && is_string($patch['prompt_text'])) {
                    $rewritten = trim($patch['prompt_text']);
                    if ($rewritten !== '' && mb_strlen($rewritten) <= 800) {
                        $item['prompt_text'] = $rewritten;
                        $item['narrative_rewritten'] = true;
                    }
                }
                if (isset($patch['narrative_wrapper']) && is_string($patch['narrative_wrapper'])) {
                    $wrap = trim($patch['narrative_wrapper']);
                    if ($wrap !== '' && mb_strlen($wrap) <= 500) {
                        $item['narrative_wrapper'] = $wrap;
                    }
                }
            }
            $out[] = $this->finalizePresentation($narrator, $child, $item, $index, $total);
        }

        return $out;
    }

    /**
     * @param array<string,mixed> $item
     * @param array<string,mixed> $child
     * @return array<string,mixed>
     */
    private function finalizePresentation(
        PlacementNarrator $narrator,
        array $child,
        array $item,
        int $index,
        int $total,
    ): array {
        $item['presentation_text'] = $narrator->wrapItem($child, $item, $index, $total);

        return $item;
    }
}
