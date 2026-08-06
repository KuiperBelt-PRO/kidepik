<?php

declare(strict_types=1);

namespace Kidepik\Shared\Catalogs;

/**
 * Niveles L1–L5 y rangos por mundo (ex helpers de PlacementBank).
 */
final class ProgressionRanks
{
    public static function levelIndex(string $levelId): int
    {
        return match ($levelId) {
            'L1' => 1,
            'L2' => 2,
            'L3' => 3,
            'L4' => 4,
            'L5' => 5,
            default => 1,
        };
    }

    /** @return array{id:string,label_child:string,tier:int} */
    public static function rankForGeneral(string $worldTheme, string $generalLevel): array
    {
        $tier = self::levelIndex($generalLevel);
        if ($worldTheme === 'sci-fi') {
            $map = [
                1 => ['id' => 'scifi_recruit', 'label_child' => 'Recluta estelar', 'tier' => 1],
                2 => ['id' => 'scifi_cadet', 'label_child' => 'Cadete explorador', 'tier' => 2],
                3 => ['id' => 'scifi_ensign', 'label_child' => 'Alférez de ruta', 'tier' => 3],
                4 => ['id' => 'scifi_lieutenant', 'label_child' => 'Teniente de nebulosa', 'tier' => 4],
                5 => ['id' => 'scifi_captain', 'label_child' => 'Capitán del saber', 'tier' => 5],
            ];
        } else {
            $map = [
                1 => ['id' => 'fantasy_spark', 'label_child' => 'Chispa del reino', 'tier' => 1],
                2 => ['id' => 'fantasy_apprentice', 'label_child' => 'Aprendiz de los reinos', 'tier' => 2],
                3 => ['id' => 'fantasy_adept', 'label_child' => 'Adepto del artefacto', 'tier' => 3],
                4 => ['id' => 'fantasy_guardian', 'label_child' => 'Guardián del saber', 'tier' => 4],
                5 => ['id' => 'fantasy_archon', 'label_child' => 'Archón del equilibrio', 'tier' => 5],
            ];
        }

        return $map[$tier] ?? $map[1];
    }
}
