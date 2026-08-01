<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

/**
 * Plantillas narrativas por zona (SPEC_APP_ADVENTURE_ZONE_BIBLE).
 */
final class ZoneNarrativeCatalog
{
    /**
     * Llegada unificada Z0–Z2 (3 párrafos en un solo turno).
     */
    public static function arrivalText(string $theme, string $zoneId, string $displayName = 'explorador'): string
    {
        $steps = 3;
        $name = $displayName !== '' ? $displayName : 'explorador';

        if ($theme === 'sci-fi') {
            return match ($zoneId) {
                'zone_logic' => "Aterrizamos en el Laberinto de Circuitos. Los pasillos repiten señales y cada pantalla muestra una salida distinta.\n\n"
                    . "Un técnico holográfico —el Vigía de Secuencias— proyecta un mapa a medias: «{$name}, sin orden claro nos perderemos entre copias falsas.»\n\n"
                    . "Hay {$steps} secuencias que abrir la ruta. Cuando quieras, afrontamos la primera.",
                'zone_language' => "Llegamos a la Estación Léxico. Las traducciones se cortan a mitad de frase y el Vacío se lleva palabras clave.\n\n"
                    . "Una voz de la consola —la Intérprete Orbital— susurra: «{$name}, recomponer el léxico es la única forma de hablar con otros mundos.»\n\n"
                    . "Faltan {$steps} ecos de palabra por restaurar. ¿Empezamos?",
                'zone_science' => "Entramos en el Cinturón de Observatorios. Los sensores están mudos y los datos llegan incompletos.\n\n"
                    . "El biólogo de estación se acerca: «{$name}, hace falta observar con calma para devolver la luz a las mediciones.»\n\n"
                    . "Quedan {$steps} semillas de observación por despertar. Listo cuando tú digas.",
                'zone_culture' => "Abrimos el Archivo Galáctico. Las crónicas parpadean con páginas en blanco.\n\n"
                    . "El curador del archivo ajusta sus gafas: «{$name}, sin memoria escrita, los planetas pierden su historia.»\n\n"
                    . "Hay {$steps} páginas perdidas por recuperar. Vamos paso a paso.",
                default => "Entramos en la Nebulosa Matemática. Las señales numéricas titilan y las naves podrían perderse.\n\n"
                    . "Una IA de navegación parpadea: «{$name}, sin cálculos firmes esta nebulosa nos traga.»\n\n"
                    . "Necesitamos {$steps} balizas numéricas. Cuando quieras, la primera prueba.",
            };
        }

        return match ($zoneId) {
            'zone_logic' => "Entramos en el Laberinto de Espejos. Los pasillos se repiten y cada reflejo muestra una salida distinta; solo una es real.\n\n"
                . "El Vigía de los Espejos aparece en un cristal roto: «{$name}, si no ordenamos las secuencias, los espejos nos confunden con salidas falsas.»\n\n"
                . "Hay {$steps} pruebas para abrir la salida. Cuando quieras, empezamos por la primera.",
            'zone_language' => "Subimos a las Montañas de la Gramática. El viento se lleva sílabas y los ecos suenan rotos.\n\n"
                . "El Escriba del Viento deja flotar su pluma: «{$name}, hay que recomponer las palabras antes de que el viento las borre del todo.»\n\n"
                . "Quedan {$steps} ecos por restaurar. ¿Empezamos?",
            'zone_science' => "Cruzamos los Jardines Alquímicos. Las plantas han perdido color y los frascos están vacíos.\n\n"
                . "El Alquimista del Rocío se inclina: «{$name}, la curiosidad puede despertar lo que el frío apagó.»\n\n"
                . "Faltan {$steps} semillas de observación. Listo cuando tú digas.",
            'zone_culture' => "Entramos en la Biblioteca de los Reinos. Los tomos tienen páginas en blanco y el polvo cubre las estanterías.\n\n"
                . "El Archivista de los Reinos enciende una lámpara: «{$name}, sin memoria escrita, los reinos olvidan quiénes son.»\n\n"
                . "Hay {$steps} páginas perdidas por recuperar. Vamos paso a paso.",
            default => "Entramos en el Bosque de los Números. Entre árboles de runas, el conteo se ha vuelto niebla.\n\n"
                . "La Guardiana del Bosque —musgo y luz verde— te mira: «{$name}, recupera los fragmentos de número y el bosque volverá a cantar.»\n\n"
                . "Necesitamos {$steps} fragmentos. Cuando quieras, afrontamos el primero.",
        };
    }

    public static function challengeIntroText(
        string $theme,
        string $zoneId,
        int $gateIndex,
        int $stepsTotal,
        string $prompt,
    ): string {
        $n = $gateIndex + 1;
        $label = "prueba {$n} de {$stepsTotal}";

        if ($theme === 'sci-fi') {
            $lead = match ($zoneId) {
                'zone_logic' => "El Vigía de Secuencias enciende un panel del laberinto ({$label}). Para abrir la salida correcta:",
                'zone_language' => "La Intérprete Orbital proyecta una frase a medias en la consola ({$label}):",
                'zone_science' => "Un observatorio muestra una lectura incompleta en pantalla ({$label}):",
                'zone_culture' => "El curador del archivo señala una página en blanco ({$label}):",
                default => "La consola de la nebulosa muestra una baliza numérica ({$label}):",
            };
        } else {
            $lead = match ($zoneId) {
                'zone_logic' => "El Vigía de los Espejos ilumina un cristal con símbolos en fila ({$label}). Para saber qué reflejo es la salida real:",
                'zone_language' => "El Escriba del Viento deja flotar una frase rota en el aire ({$label}):",
                'zone_science' => "El Alquimista del Rocío señala un frasco con una etiqueta borrosa ({$label}):",
                'zone_culture' => "El Archivista abre un libro a una página incompleta ({$label}):",
                default => "La Guardiana del Bosque señala una runa en el tronco ({$label}):",
            };
        }

        return $lead . "\n\n" . trim($prompt);
    }

    public static function challengeSuccessText(string $theme, string $zoneId): string
    {
        if ($theme === 'sci-fi') {
            return match ($zoneId) {
                'zone_logic' => '¡Bien! La secuencia encaja y el panel abre un pasillo verdadero.',
                'zone_language' => '¡Correcto! La traducción vuelve a tener sentido.',
                'zone_science' => '¡Buena observación! Los sensores registran la lectura.',
                'zone_culture' => '¡Exacto! La página recupera su texto.',
                default => '¡Baliza estabilizada! La señal gana claridad.',
            };
        }

        return match ($zoneId) {
            'zone_logic' => '¡Correcto! Un espejo deja de mentir y muestra la salida.',
            'zone_language' => '¡Bien dicho! El eco suena entero otra vez.',
            'zone_science' => '¡Buen ojo! El frasco vuelve a brillar con color.',
            'zone_culture' => '¡Exacto! La página vuelve a contar la historia.',
            default => '¡La runa encaja! Otro fragmento del bosque vuelve a brillar.',
        };
    }

    public static function challengeNearMissText(string $theme, string $zoneId): string
    {
        if ($theme === 'sci-fi') {
            return match ($zoneId) {
                'zone_logic' => 'Casi. El panel parpadea, pero ya vimos cómo va la secuencia.',
                'zone_language' => 'No del todo. La consola guarda la pista para el siguiente intento.',
                'zone_science' => 'Casi. Los datos titilan, pero aprendimos algo.',
                'zone_culture' => 'Casi. El archivo deja una marca para seguir buscando.',
                default => 'El eco se resiste, pero la baliza deja una pista clara.',
            };
        }

        return match ($zoneId) {
            'zone_logic' => 'Casi. El cristal parpadea otra vez, pero ya vimos el patrón.',
            'zone_language' => 'No del todo. El viento guarda la sílaba que faltaba.',
            'zone_science' => 'Casi. El frasco titila, pero la curiosidad ya despertó.',
            'zone_culture' => 'Casi. El libro marca la página para volver a intentarlo.',
            default => 'La runa titila sin abrirse del todo, pero ya sabemos cómo seguir.',
        };
    }

    public static function betweenText(string $theme, string $zoneId, int $nextGate, int $stepsTotal): string
    {
        $n = $nextGate + 1;
        if ($theme === 'sci-fi') {
            return match ($zoneId) {
                'zone_logic' => "Más adentro del laberinto, otra secuencia parpadea ({$n} de {$stepsTotal}).",
                'zone_language' => "Otro panel de la estación pide palabras ({$n} de {$stepsTotal}).",
                'zone_science' => "Un observatorio más aguarda datos ({$n} de {$stepsTotal}).",
                'zone_culture' => "Otro estante del archivo espera ({$n} de {$stepsTotal}).",
                default => "Otra baliza numérica titila ({$n} de {$stepsTotal}).",
            };
        }

        return match ($zoneId) {
            'zone_logic' => "Un corredor nuevo de espejos se abre ({$n} de {$stepsTotal}).",
            'zone_language' => "Otro eco resuena en la cumbre ({$n} de {$stepsTotal}).",
            'zone_science' => "Otro rincón del jardín pide atención ({$n} de {$stepsTotal}).",
            'zone_culture' => "Otro pasillo de la biblioteca aguarda ({$n} de {$stepsTotal}).",
            default => "Otro sendero del bosque brilla ({$n} de {$stepsTotal}).",
        };
    }

    public static function questCompleteText(string $theme, string $zoneId): string
    {
        if ($theme === 'sci-fi') {
            return match ($zoneId) {
                'zone_logic' => 'Las secuencias del laberinto encajan. Esta zona ya puede guiar a otros cadetes.',
                'zone_language' => 'La estación vuelve a traducir con claridad. Buen trabajo en el léxico.',
                'zone_science' => 'Los observatorios recuperan señal. El cinturón respira de nuevo.',
                'zone_culture' => 'Las crónicas del archivo vuelven a tener sentido.',
                default => 'Las balizas de la nebulosa brillan estables.',
            };
        }

        return match ($zoneId) {
            'zone_logic' => 'Los espejos muestran un solo camino verdadero. El laberinto queda en calma.',
            'zone_language' => 'Los ecos de las montañas suenan enteros otra vez.',
            'zone_science' => 'Los jardines recuperan color. La observación ha dado fruto.',
            'zone_culture' => 'Las páginas perdidas vuelven a los tomos. La biblioteca agradece tu paso.',
            default => 'Los fragmentos de número brillan en el claro. El bosque vuelve a contar.',
        };
    }

    public static function zoneSubject(string $zoneId): string
    {
        return match ($zoneId) {
            'zone_logic' => 'logic',
            'zone_language' => 'language',
            'zone_science' => 'science',
            'zone_culture' => 'culture',
            default => 'math',
        };
    }
}
