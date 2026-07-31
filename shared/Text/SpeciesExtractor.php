<?php

declare(strict_types=1);

namespace Kidepik\Shared\Text;

/**
 * Extrae descripción de especie/criatura desde texto libre del niño.
 */
final class SpeciesExtractor
{
    /** @return list<string> */
    public static function candidates(string $raw): array
    {
        $raw = trim($raw);
        if ($raw === '') {
            return [];
        }

        $found = [];

        $patterns = [
            '/soy\s+(?:un|una)\s+([^.!?\n]{2,60})/iu',
            '/soy\s+([^.!?\n]{2,60})/iu',
            '/(?:criatura|especie|ser)\s+(?:es|un|una)?\s*[:\s]+([^.!?\n]{2,60})/iu',
            '/(?:me\s+gustaría\s+ser|quiero\s+ser)\s+([^.!?\n]{2,60})/iu',
        ];
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $raw, $m) === 1) {
                $found[] = self::normalizeCandidate((string) $m[1]);
            }
        }

        $firstSentence = trim((string) (preg_split('/[.!?\n]/u', $raw, 2)[0] ?? $raw));
        if ($firstSentence !== '') {
            $found[] = self::normalizeCandidate($firstSentence);
        }

        if (self::isValidSpecies($raw)) {
            $found[] = self::normalizeCandidate($raw);
        }

        $unique = [];
        foreach ($found as $candidate) {
            if ($candidate === '' || isset($unique[$candidate])) {
                continue;
            }
            if (!self::isValidSpecies($candidate)) {
                $trimmed = self::truncateAtWord($candidate, 40);
                if ($trimmed !== '' && self::isValidSpecies($trimmed)) {
                    $candidate = $trimmed;
                } else {
                    continue;
                }
            }
            $unique[$candidate] = true;
        }

        return array_keys($unique);
    }

    public static function pickBest(string $raw): ?string
    {
        foreach (self::candidates($raw) as $candidate) {
            if (self::isValidSpecies($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    public static function isValidSpecies(string $value): bool
    {
        $trimmed = trim($value);
        if ($trimmed === '' || mb_strlen($trimmed) < 2 || mb_strlen($trimmed) > 40) {
            return false;
        }

        return preg_match('/^[\p{L}\p{N}\s\'\-,]+$/u', $trimmed) === 1;
    }

    private static function normalizeCandidate(string $value): string
    {
        $trimmed = trim(preg_replace('/\s+/u', ' ', str_replace(',', ' ', $value)) ?? $value);

        return mb_convert_case($trimmed, MB_CASE_TITLE, 'UTF-8');
    }

    private static function truncateAtWord(string $value, int $maxLen): string
    {
        $trimmed = trim($value);
        if (mb_strlen($trimmed) <= $maxLen) {
            return $trimmed;
        }

        $slice = mb_substr($trimmed, 0, $maxLen);
        $lastSpace = mb_strrpos($slice, ' ');
        if ($lastSpace !== false && $lastSpace > 2) {
            return trim(mb_substr($slice, 0, $lastSpace));
        }

        return trim($slice);
    }
}
