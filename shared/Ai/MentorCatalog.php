<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

/**
 * Fichas canónicas del mentor (SPEC_APP_MENTOR).
 */
final class MentorCatalog
{
    public const NEUTRAL = 'mentor_neutral_host';
    public const FANTASY = 'mentor_fantasy_guardian';
    public const SCIFI = 'mentor_scifi_architect';

    public static function idForWorldTheme(?string $worldTheme): string
    {
        return match ($worldTheme) {
            'fantasy' => self::FANTASY,
            'sci-fi' => self::SCIFI,
            default => self::NEUTRAL,
        };
    }

    /** @return array{mentor_id:string,world_theme:?string,display_name:string,short_description:string,appearance:string,voice_traits:list<string>,address_form:string} */
    public static function profile(string $mentorId): array
    {
        return match ($mentorId) {
            self::FANTASY => [
                'mentor_id' => self::FANTASY,
                'world_theme' => 'fantasy',
                'display_name' => 'El Guardián del Conocimiento',
                'short_description' => 'Sabio que guía al explorador por los reinos y custodia el saber frente al desequilibrio.',
                'appearance' => 'Figura encapuchada de luz suave y runas tenues; ojos amables; farol de saber.',
                'voice_traits' => ['paciente', 'sereno', 'nunca humilla', 'celebra la curiosidad'],
                'address_form' => '{display_name}',
            ],
            self::SCIFI => [
                'mentor_id' => self::SCIFI,
                'world_theme' => 'sci-fi',
                'display_name' => 'El Arquitecto del Saber',
                'short_description' => 'Veterano de la Academia que cartografía el conocimiento frente al Vacío.',
                'appearance' => 'Piloto-archivista con luces de mapa; hologramas de rutas; cicatriz de una página en blanco.',
                'voice_traits' => ['claro', 'navegador', 'humor seco suave', 'respetuoso'],
                'address_form' => '{display_name}',
            ],
            default => [
                'mentor_id' => self::NEUTRAL,
                'world_theme' => null,
                'display_name' => 'KidepiK',
                'short_description' => 'Anfitrión que presenta el umbral del viaje antes de elegir mundo.',
                'appearance' => 'Presencia neutra de marca, sin sesgo fantasy ni sci-fi.',
                'voice_traits' => ['cálido', 'breve', 'imparcial'],
                'address_form' => 'explorador',
            ],
        };
    }
}
