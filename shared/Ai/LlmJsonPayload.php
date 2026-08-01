<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

/**
 * Extrae y repara JSON de respuestas LLM (markdown, ruido, comas finales, etc.).
 */
final class LlmJsonPayload
{
    /**
     * @return array<string,mixed>|null
     */
    public static function decodeObject(string $content): ?array
    {
        foreach (self::candidateStrings($content) as $raw) {
            if ($raw === '') {
                continue;
            }
            $parsed = json_decode($raw, true);
            if (is_array($parsed)) {
                return $parsed;
            }
        }

        return null;
    }

    /**
     * Normaliza la raíz del compose a lista de ítems.
     *
     * @param array<string,mixed> $parsed
     * @return list<array<string,mixed>>|null
     */
    public static function extractComposeItems(array $parsed): ?array
    {
        if (isset($parsed['agent_text'], $parsed['input_mode'])) {
            return null;
        }

        if (isset($parsed['items']) && is_array($parsed['items'])) {
            return self::filterItemRows($parsed['items']);
        }

        if (isset($parsed['item']) && is_array($parsed['item'])) {
            return self::filterItemRows([$parsed['item']]);
        }

        if ($parsed !== [] && array_is_list($parsed)) {
            return self::filterItemRows($parsed);
        }

        foreach (['questions', 'entries', 'data'] as $key) {
            if (isset($parsed[$key]) && is_array($parsed[$key])) {
                $rows = self::filterItemRows($parsed[$key]);
                if ($rows !== []) {
                    return $rows;
                }
            }
        }

        if (isset($parsed['prompt_text'], $parsed['subject_id'])) {
            return [$parsed];
        }

        return null;
    }

    /**
     * @return list<string>
     */
    public static function candidateStrings(string $content): array
    {
        $content = self::stripNoise($content);
        $candidates = [];
        $push = static function (string $s) use (&$candidates): void {
            $s = trim($s);
            if ($s !== '' && !in_array($s, $candidates, true)) {
                $candidates[] = $s;
            }
        };

        $push($content);
        $extracted = self::extractJsonString($content);
        $push($extracted);
        $push(self::repairJsonString($extracted));
        $push(self::repairJsonString($content));

        return $candidates;
    }

    public static function extractJsonString(string $content): string
    {
        $content = trim($content);
        if ($content === '') {
            return '';
        }

        if (preg_match('/```(?:json)?\s*([\s\S]*?)```/i', $content, $match)) {
            return trim($match[1]);
        }

        $start = strpos($content, '{');
        $end = strrpos($content, '}');
        if ($start !== false && $end !== false && $end > $start) {
            return substr($content, $start, $end - $start + 1);
        }

        $start = strpos($content, '[');
        $end = strrpos($content, ']');
        if ($start !== false && $end !== false && $end > $start) {
            return substr($content, $start, $end - $start + 1);
        }

        return $content;
    }

    public static function repairJsonString(string $json): string
    {
        $json = trim($json);
        if ($json === '') {
            return '';
        }

        // Comas finales ilegales antes de ] o }.
        $json = preg_replace('/,\s*([}\]])/', '$1', $json) ?? $json;
        // Saltos de línea sin escape dentro de strings (heurística conservadora).
        $json = preg_replace("/[\x00-\x08\x0B\x0C\x0E-\x1F]/", ' ', $json) ?? $json;

        return trim($json);
    }

    private static function stripNoise(string $content): string
    {
        $content = trim($content);
        if ($content === '') {
            return '';
        }

        // Razonamiento oculto (DeepSeek / algunos Nemotron).
        $content = preg_replace('/[\s\S]*?<\/think>/i', '', $content) ?? $content;
        $content = preg_replace('/<reasoning>[\s\S]*?<\/reasoning>/i', '', $content) ?? $content;

        return trim($content);
    }

    /**
     * @param list<mixed> $rows
     * @return list<array<string,mixed>>
     */
    private static function filterItemRows(array $rows): array
    {
        $out = [];
        foreach ($rows as $row) {
            if (is_array($row)) {
                $out[] = $row;
            }
        }

        return $out;
    }
}
