<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

/**
 * Validación post-LLM de narrativa de aventura.
 */
final class ZoneNarrativeGuard
{
    /**
     * @param list<string> $expectedZoneIds
     * @return string|null error message
     */
    public static function validatePitchBundle(?array $parsed, array $expectedZoneIds): ?string
    {
        if (!is_array($parsed)) {
            return 'JSON inválido';
        }
        $bridge = trim((string) ($parsed['mentor_bridge'] ?? ''));
        if ($bridge === '' || mb_strlen($bridge) > 600) {
            return 'mentor_bridge inválido';
        }
        $options = $parsed['options'] ?? null;
        if (!is_array($options) || count($options) < 2) {
            return 'options insuficientes';
        }
        $whys = [];
        foreach ($options as $opt) {
            if (!is_array($opt)) {
                return 'option inválida';
            }
            $id = (string) ($opt['id'] ?? '');
            if (!in_array($id, $expectedZoneIds, true)) {
                return 'zone_id no coincide con plan';
            }
            $desc = trim((string) ($opt['description'] ?? ''));
            $why = trim((string) ($opt['why_for_you'] ?? ''));
            if ($desc === '' || $why === '' || mb_strlen($desc) > 280 || mb_strlen($why) > 200) {
                return 'description o why_for_you inválidos';
            }
            if (preg_match('/\bL[1-5]\b/i', $why . ' ' . $desc)) {
                return 'revela niveles L*';
            }
            if (in_array(mb_strtolower($why), $whys, true)) {
                return 'why_for_you duplicados';
            }
            $whys[] = mb_strtolower($why);
            $err = self::validateZoneVocabulary($id, $desc . ' ' . $why);
            if ($err !== null) {
                return $err;
            }
        }

        return null;
    }

    /**
     * @return string|null
     */
    public static function validateZoneVocabulary(string $zoneId, string $text): ?string
    {
        $lower = mb_strtolower($text);
        foreach (ZoneBible::forbiddenWords($zoneId) as $word) {
            if ($word !== '' && str_contains($lower, mb_strtolower($word))) {
                return "vocabulario prohibido en {$zoneId}: {$word}";
            }
        }

        return null;
    }

    /**
     * @return string|null
     */
    public static function validateSceneText(string $zoneId, string $text, int $maxChars = 900): ?string
    {
        $t = trim($text);
        if ($t === '' || mb_strlen($t) > $maxChars) {
            return 'agent_text longitud inválida';
        }

        return self::validateZoneVocabulary($zoneId, $t);
    }

    /**
     * @return string|null
     */
    public static function validateChallengeEnvelope(?array $parsed, string $zoneId, string $stem): ?string
    {
        if (!is_array($parsed)) {
            return 'JSON inválido';
        }
        $wrapper = trim((string) ($parsed['narrative_wrapper'] ?? ''));
        $prompt = trim((string) ($parsed['prompt_text'] ?? ''));
        if ($wrapper === '' || $prompt === '') {
            return 'wrapper o prompt vacío';
        }
        if (!str_contains($prompt, $stem) && !str_contains($wrapper . $prompt, mb_substr($stem, 0, 20))) {
            // El enunciado curricular debe permanecer reconocible
            if (!preg_match('/\d/', $prompt) && preg_match('/\d/', $stem)) {
                return 'prompt no conserva el ítem curricular';
            }
        }
        $combined = $wrapper . ' ' . $prompt;

        return self::validateZoneVocabulary($zoneId, $combined);
    }

    /**
     * @return string|null
     */
    public static function validateWaitingBundle(?array $parsed): ?string
    {
        if (!is_array($parsed)) {
            return 'JSON inválido';
        }
        $lines = $parsed['lines'] ?? null;
        if (!is_array($lines) || count($lines) < 1) {
            return 'lines vacío';
        }
        foreach ($lines as $line) {
            if (!is_string($line) || trim($line) === '' || mb_strlen($line) > 90) {
                return 'línea de espera inválida';
            }
        }

        return null;
    }
}
