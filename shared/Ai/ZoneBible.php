<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

/**
 * Constraints de zona para prompts y validador (no copy servido).
 */
final class ZoneBible
{
    /**
     * @return list<string>
     */
    public static function forbiddenWords(string $zoneId): array
    {
        $common = ['L1', 'L2', 'L3', 'L4', 'L5', 'nivel L'];
        return match ($zoneId) {
            'zone_logic' => array_merge($common, ['bosque', 'musgo', 'claro', 'hoja', 'sendero', 'runa', 'árbol']),
            'zone_math' => array_merge($common, ['espejo', 'cristal', 'laberinto']),
            'zone_language' => array_merge($common, ['espejo', 'runa numérica']),
            'zone_science' => array_merge($common, ['espejo', 'biblioteca']),
            'zone_culture' => array_merge($common, ['espejo', 'runa']),
            default => $common,
        };
    }

    public static function excerpt(string $theme, string $zoneId): string
    {
        $label = ZoneCatalog::label($theme, $zoneId);
        $forbidden = implode(', ', self::forbiddenWords($zoneId));

        return match ($zoneId) {
            'zone_logic' => "Zona: {$label}. Escenario: pasillos de espejos/circuitos, secuencias y patrones. "
                . "NPC arquetipo: Vigía de los Espejos / Vigía de Secuencias. Prohibido vocabulario: {$forbidden}.",
            'zone_math' => "Zona: {$label}. Escenario: runas numéricas, conteo, bosque de cifras o nebulosa de señales. "
                . "NPC: Guardiana del Bosque / IA de navegación. Prohibido: {$forbidden}.",
            'zone_language' => "Zona: {$label}. Escenario: viento, ecos, gramática, traducción. "
                . "NPC: Escriba del Viento / Intérprete Orbital. Prohibido: {$forbidden}.",
            'zone_science' => "Zona: {$label}. Escenario: observación, plantas, sensores, datos. "
                . "NPC: Alquimista del Rocío / biólogo de estación. Prohibido: {$forbidden}.",
            'zone_culture' => "Zona: {$label}. Escenario: archivos, tomos, memoria de reinos. "
                . "NPC: Archivista / Curador. Prohibido: {$forbidden}.",
            default => "Zona: {$label}. Prohibido: {$forbidden}.",
        };
    }
}
