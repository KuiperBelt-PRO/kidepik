<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

/**
 * Selección pedagógica de zone_ids con variabilidad por semilla de sesión.
 */
final class ZonePitchPlanner
{
    /**
     * @param array<string, string> $subjectLevels
     * @param list<string> $excludeZoneIds
     * @return list<string>
     */
    public static function planZoneIds(
        array $subjectLevels,
        array $excludeZoneIds,
        string $seed,
        int $limit = 3,
    ): array {
        $limit = max(2, min(3, $limit));
        $candidates = [];
        foreach (ZoneCatalog::ZONE_IDS as $zoneId) {
            if (in_array($zoneId, $excludeZoneIds, true)) {
                continue;
            }
            $subject = ZoneCatalog::subjectForZone($zoneId);
            $level = $subjectLevels[$subject] ?? 'L3';
            $candidates[] = [
                'id' => $zoneId,
                'weakness' => ZoneCatalog::levelRank($level),
                'subject' => $subject,
            ];
        }
        if ($candidates === []) {
            return [];
        }

        usort($candidates, static fn (array $a, array $b): int => $a['weakness'] <=> $b['weakness']);
        $weakest = $candidates[0]['weakness'];
        $pool = array_slice($candidates, 0, min(4, count($candidates)));

        $mustInclude = null;
        foreach ($pool as $c) {
            if ($c['weakness'] === $weakest) {
                $mustInclude = $c['id'];
                break;
            }
        }

        $ids = array_column($pool, 'id');
        $ids = self::shuffleWithSeed($ids, $seed);

        $picked = [];
        if ($mustInclude !== null) {
            $picked[] = $mustInclude;
            $ids = array_values(array_filter($ids, static fn (string $id): bool => $id !== $mustInclude));
        }
        foreach ($ids as $id) {
            if (count($picked) >= $limit) {
                break;
            }
            if (!in_array($id, $picked, true)) {
                $picked[] = $id;
            }
        }

        return array_slice($picked, 0, $limit);
    }

    public static function sessionSeed(string $childId, string $sessionId): string
    {
        return hash('xxh128', $childId . '|' . $sessionId . '|' . date('Y-m-d'));
    }

    /**
     * @param list<string> $ids
     * @return list<string>
     */
    private static function shuffleWithSeed(array $ids, string $seed): array
    {
        usort($ids, static function (string $a, string $b) use ($seed): int {
            $ha = crc32($seed . '|' . $a);
            $hb = crc32($seed . '|' . $b);

            return $ha <=> $hb;
        });

        return $ids;
    }
}
