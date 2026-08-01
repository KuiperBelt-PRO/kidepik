<?php

declare(strict_types=1);

namespace Kidepik\Shared\Text;

/**
 * Normalización UTF-8 para texto de producto (diálogo, narrador, API).
 */
final class Utf8Text
{
    public static function normalize(string $text): string
    {
        if ($text === '') {
            return $text;
        }

        if (mb_check_encoding($text, 'UTF-8')) {
            return self::scrubMentorLexicon($text);
        }

        $scrubbed = mb_convert_encoding($text, 'UTF-8', 'UTF-8');
        if (is_string($scrubbed) && $scrubbed !== '') {
            return self::scrubMentorLexicon($scrubbed);
        }

        $fromLatin1 = mb_convert_encoding($text, 'UTF-8', 'ISO-8859-1');
        if (is_string($fromLatin1)) {
            return self::scrubMentorLexicon($fromLatin1);
        }

        return self::scrubMentorLexicon($text);
    }

    /**
     * Sustituye coloquios latinoamericanos o de baja calidad en prosa del mentor.
     */
    public static function scrubMentorLexicon(string $text): string
    {
        if ($text === '') {
            return $text;
        }

        $pairs = [
            'armar un examen' => 'preparar la prueba',
            'armar el examen' => 'preparar la prueba',
            'armar una prueba' => 'preparar la prueba',
            'armar la prueba' => 'preparar la prueba',
            'armar el test' => 'preparar la prueba',
        ];

        foreach ($pairs as $from => $to) {
            $text = preg_replace('/' . preg_quote($from, '/') . '/iu', $to, $text) ?? $text;
        }

        return $text;
    }
}
