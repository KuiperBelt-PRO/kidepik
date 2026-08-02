<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

/**
 * Metadatos canónicos de zona (ids, materia, etiqueta por mundo) — no copy narrativo servido al niño.
 */
final class ZoneCatalog
{
    /** @var list<string> */
    public const ZONE_IDS = ['zone_math', 'zone_language', 'zone_logic', 'zone_science', 'zone_culture'];

    /**
     * @return array{subject:string,label_fantasy:string,label_scifi:string}
     */
    public static function meta(string $zoneId): array
    {
        return match ($zoneId) {
            'zone_math' => [
                'subject' => 'math',
                'label_fantasy' => 'Bosque de los Números',
                'label_scifi' => 'Nebulosa Matemática',
            ],
            'zone_language' => [
                'subject' => 'language',
                'label_fantasy' => 'Montañas de la Gramática',
                'label_scifi' => 'Estación Léxico',
            ],
            'zone_logic' => [
                'subject' => 'logic',
                'label_fantasy' => 'Laberinto de Espejos',
                'label_scifi' => 'Laberinto de Circuitos',
            ],
            'zone_science' => [
                'subject' => 'science',
                'label_fantasy' => 'Jardines Alquímicos',
                'label_scifi' => 'Cinturón de Observatorios',
            ],
            'zone_culture' => [
                'subject' => 'culture',
                'label_fantasy' => 'Biblioteca de los Reinos',
                'label_scifi' => 'Archivo Galáctico',
            ],
            default => throw new \InvalidArgumentException('zone invalid'),
        };
    }

    public static function label(string $theme, string $zoneId): string
    {
        $m = self::meta($zoneId);

        return $theme === 'sci-fi' ? $m['label_scifi'] : $m['label_fantasy'];
    }

    public static function subjectForZone(string $zoneId): string
    {
        return self::meta($zoneId)['subject'];
    }

    public static function levelRank(string $levelId): int
    {
        return match (strtoupper($levelId)) {
            'L1' => 1,
            'L2' => 2,
            'L3' => 3,
            'L4' => 4,
            'L5' => 5,
            default => 3,
        };
    }
}
