<?php

declare(strict_types=1);

namespace Kidepik\Shared\Text;

/**
 * Extrae candidatos de nombre de tripulación desde texto libre del niño.
 */
final class DisplayNameExtractor
{
    /** @var list<string> */
    private const SKIP_WORDS = [
        'será', 'sera', 'es', 'un', 'una', 'el', 'la', 'los', 'las', 'mi', 'tu', 'su',
        'yo', 'y', 'en', 'de', 'del', 'al', 'con', 'por', 'para', 'que', 'como',
    ];

    /** @return list<string> */
    public static function candidates(string $raw): array
    {
        $raw = trim($raw);
        if ($raw === '') {
            return [];
        }

        $found = [];

        $patterns = [
            '/(?:se\s+llama|se\s+llame|nombre\s+es|me\s+llamo|ll[aá]mame|mi\s+nombre\s+es|nombre)\s*[:\s]+["«]?([\p{L}][\p{L}\'\-]{0,22}[\p{L}])/iu',
            '/["«“]([\p{L}][\p{L}\s\'\-]{0,22}[\p{L}])["»”]/u',
            '/(?:personaje\s+se\s+llama|llamar[áa])\s*[:\s]+([\p{L}][\p{L}\s\'\-]{0,22})/iu',
        ];
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $raw, $m) === 1) {
                $found[] = self::normalizeCandidate((string) $m[1]);
            }
        }

        if (self::isValidName($raw)) {
            $found[] = self::normalizeCandidate($raw);
        }

        if (preg_match('/\b([\p{L}][\p{L}\'-]{1,20})\b/u', $raw, $m) === 1) {
            $found[] = self::normalizeCandidate((string) $m[1]);
        }

        $unique = [];
        foreach ($found as $candidate) {
            if ($candidate === '' || isset($unique[$candidate])) {
                continue;
            }
            if (!self::isValidName($candidate)) {
                continue;
            }
            $unique[$candidate] = true;
        }

        return array_keys($unique);
    }

    public static function pickBest(string $raw): ?string
    {
        foreach (self::candidates($raw) as $candidate) {
            if (self::isValidName($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    public static function isValidName(string $name): bool
    {
        $trimmed = trim($name);
        if ($trimmed === '' || mb_strlen($trimmed) > 24) {
            return false;
        }

        $lower = mb_strtolower($trimmed, 'UTF-8');
        if (in_array($lower, self::SKIP_WORDS, true)) {
            return false;
        }

        return preg_match("/^[\p{L}\p{N} '\\-]+$/u", $trimmed) === 1;
    }

    private static function normalizeCandidate(string $value): string
    {
        $trimmed = trim(preg_replace('/\s+/u', ' ', $value) ?? $value);

        return mb_convert_case($trimmed, MB_CASE_TITLE, 'UTF-8');
    }
}
