<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

use Kidepik\Shared\Config;

/**
 * Reescribe prompt_text del banco al tono del mundo sin tocar canonical_answer.
 */
final class PlacementItemWriter
{
    public function __construct(private readonly ?AiGateway $gateway = null)
    {
    }

    /**
     * @param array<string,mixed> $item
     * @param array<string,mixed> $child
     * @return array<string,mixed>
     */
    public function rewrite(array $item, array $child): array
    {
        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $original = (string) ($item['prompt_text'] ?? '');
        if ($original === '') {
            return $item;
        }

        $gateway = $this->gateway ?? AiGateway::fromConfig();
        if (!Config::aiMock() && !$gateway->isEnabled()) {
            return $item;
        }

        try {
            $gw = Config::aiMock() ? AiGateway::fromConfig() : $gateway;
            $result = $gw->complete([
                [
                    'role' => 'system',
                    'content' => 'Reescribe el enunciado pedagógico al tono del mundo ('
                        . $theme . ') en español de España. NO cambies la respuesta correcta ni inventes datos. '
                        . 'JSON {"prompt_text":"..."}',
                ],
                [
                    'role' => 'user',
                    'content' => json_encode([
                        'prompt_text' => $original,
                        'item_type' => $item['item_type'] ?? null,
                        'subject_id' => $item['subject_id'] ?? null,
                        'world_theme' => $theme,
                        'display_name' => $child['display_name'] ?? null,
                    ], JSON_UNESCAPED_UNICODE),
                ],
            ], ['purpose' => 'placement_item_writer', 'temperature' => 0.3, 'max_tokens' => 200]);

            $parsed = json_decode($result['content'], true);
            if (is_array($parsed) && isset($parsed['prompt_text']) && is_string($parsed['prompt_text'])) {
                $rewritten = trim($parsed['prompt_text']);
                if ($rewritten !== '' && mb_strlen($rewritten) <= 500) {
                    $item['prompt_text'] = $rewritten;
                    $item['narrative_rewritten'] = true;
                }
            }
        } catch (\Throwable) {
            // degradación: prompt del banco
        }

        return $item;
    }
}
