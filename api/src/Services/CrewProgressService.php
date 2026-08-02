<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use Kidepik\Shared\Ai\PlacementBank;
use Kidepik\Shared\Ai\SubjectCatalog;
use Kidepik\Shared\Ai\ZoneCatalog;
use Kidepik\Shared\Ai\ZonePitchPlanner;
use PDO;

/**
 * Progreso pedagógico y estado del viaje para la ficha tutor (SPEC_APP_CREW_PROGRESS).
 */
final class CrewProgressService
{
    private const THRESHOLD_UP = 0.80;

    public function __construct(
        private readonly PDO $pdo,
        private readonly PlacementBank $bank = new PlacementBank(),
    ) {
    }

    /**
     * @param array<string,mixed> $childRow fila children + settings decodificados en mapDetail
     * @return array{progress:array<string,mixed>,journey:array<string,mixed>}
     */
    public function buildForChild(array $childRow): array
    {
        $childId = (string) ($childRow['id'] ?? '');
        $theme = (string) ($childRow['world_theme'] ?? 'fantasy');
        $track = (string) ($childRow['rank_track'] ?? ($theme === 'sci-fi' ? 'sci-fi' : 'fantasy'));
        $generalLevel = $this->nullableString($childRow['general_level'] ?? null);
        $placementStatus = (string) ($childRow['placement_status'] ?? 'pending');
        $settings = is_array($childRow['settings'] ?? null) ? $childRow['settings'] : [];
        $learning = is_array($settings['learning'] ?? null) ? $settings['learning'] : [];
        $activeSubjects = is_array($learning['active_subjects'] ?? null)
            ? $learning['active_subjects']
            : [];

        $subjectLevels = $this->fetchSubjectLevels($childId);
        $journeySettings = is_array($settings['journey'] ?? null) ? $settings['journey'] : [];
        $zonesCompleted = AdventureService::completedZoneIds(['settings' => $settings]);
        $activeZoneId = $this->nullableString($journeySettings['active_zone_id'] ?? null);
        $activeQuest = $this->fetchActiveQuest($childId);

        $subjectsDto = [];
        $percentSum = 0.0;
        $percentWeight = 0.0;
        $unevaluated = 0;

        foreach ($activeSubjects as $subjectId) {
            if (!is_string($subjectId) || $subjectId === '') {
                continue;
            }
            $meta = SubjectCatalog::META[$subjectId] ?? null;
            if (!is_array($meta)) {
                continue;
            }
            $row = $subjectLevels[$subjectId] ?? null;
            $levelId = is_array($row) ? $this->nullableString($row['level_id'] ?? null) : null;
            $rolling = is_array($row) && isset($row['accuracy_rolling']) ? (float) $row['accuracy_rolling'] : null;
            $recentAttempts = is_array($row) ? 1 : 0;
            $zoneId = $meta['zone_id'] ?? null;
            $zoneLabel = is_string($zoneId) ? AdventureService::zoneTitle($theme, $zoneId) : null;

            $levelProgress = $levelId !== null
                ? $this->levelProgress($levelId, $rolling, $recentAttempts, (string) $meta['label'])
                : null;

            if ($levelProgress !== null) {
                $weight = SubjectCatalog::defaultWeights()[$subjectId] ?? 0.05;
                $percentSum += $levelProgress['percent_to_next'] * $weight;
                $percentWeight += $weight;
            } else {
                $unevaluated++;
            }

            $subjectsDto[] = [
                'subject_id' => $subjectId,
                'label' => (string) $meta['label'],
                'family' => (string) $meta['family'],
                'zone_id' => is_string($zoneId) ? $zoneId : null,
                'zone_label' => $zoneLabel,
                'level_id' => $levelId,
                'level_progress' => $levelProgress,
                'zone_status' => $this->zoneStatus($levelId, $zoneId, $zonesCompleted, $activeZoneId, $activeQuest),
                'recent_attempts' => $recentAttempts,
            ];
        }

        $rank = $this->rankDto($track, $this->nullableString($childRow['rank_id'] ?? null), $generalLevel, $theme);
        $rankNext = $rank !== null ? $this->rankNextDto($track, (int) ($rank['tier'] ?? 1), $theme) : null;
        $rankEligible = $rankNext !== null
            && $generalLevel !== null
            && $this->bank->levelIndex($generalLevel) >= $this->bank->levelIndex((string) ($rankNext['min_general_level'] ?? 'L5'));

        $generalProgress = null;
        if ($placementStatus === 'completed' && $generalLevel !== null) {
            $percent = $percentWeight > 0 ? (int) round($percentSum / $percentWeight) : 10;
            $next = $this->nextLevel($generalLevel);
            $hint = $unevaluated > 0
                ? "{$unevaluated} materias pendientes de examen."
                : ($next !== null
                    ? "Nivel general {$generalLevel} — {$percent} % del camino hacia {$next}."
                    : "Nivel general {$generalLevel} — nivel máximo.");
            $generalProgress = [
                'current' => $generalLevel,
                'next' => $next,
                'percent_to_next' => max(0, min(100, $percent)),
                'hint_tutor' => $hint,
            ];
        }

        $levelsForPitch = [];
        foreach ($subjectLevels as $sid => $row) {
            if (is_array($row) && isset($row['level_id'])) {
                $levelsForPitch[(string) $sid] = (string) $row['level_id'];
            }
        }
        $seed = ZonePitchPlanner::sessionSeed($childId, 'crew-progress');
        $zoneIds = ZonePitchPlanner::planZoneIds($levelsForPitch, $zonesCompleted, $seed);
        $pending = array_map(
            static fn (string $zoneId): array => [
                'id' => $zoneId,
                'label' => ZoneCatalog::label($theme, $zoneId),
            ],
            $zoneIds,
        );

        return [
            'progress' => [
                'general_level' => $generalLevel,
                'general_progress' => $generalProgress,
                'rank' => $rank,
                'rank_next' => $rankNext,
                'rank_eligible_now' => $rankEligible,
                'subjects' => $subjectsDto,
                'placement_completed_at' => $this->placementCompletedAt($childId),
            ],
            'journey' => [
                'chapter_id' => (string) ($journeySettings['chapter_id'] ?? 'C1_first_zone'),
                'chapter_label' => 'Primer destino',
                'active_zone_id' => $activeZoneId,
                'active_zone_label' => $activeZoneId !== null ? AdventureService::zoneTitle($theme, $activeZoneId) : null,
                'fragments_restored' => (int) ($journeySettings['fragments_restored'] ?? 0),
                'zones_completed' => $zonesCompleted,
                'zones_completed_labels' => array_map(
                    static fn (string $z): string => AdventureService::zoneTitle($theme, $z),
                    $zonesCompleted,
                ),
                'pending_destinations' => array_map(
                    static fn (array $z): array => ['id' => (string) $z['id'], 'label' => (string) $z['label']],
                    $pending,
                ),
                'active_quest' => $activeQuest,
            ],
        ];
    }

    /**
     * @return array<string,array{level_id:string,accuracy_rolling:?float}>
     */
    private function fetchSubjectLevels(string $childId): array
    {
        $stmt = $this->pdo->prepare(
            'select subject_id, level_id, accuracy_rolling from user_subject_levels where child_id = :id',
        );
        $stmt->execute(['id' => $childId]);
        $out = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            if (!is_array($row)) {
                continue;
            }
            $sid = (string) ($row['subject_id'] ?? '');
            if ($sid === '') {
                continue;
            }
            $out[$sid] = [
                'level_id' => (string) ($row['level_id'] ?? 'L1'),
                'accuracy_rolling' => isset($row['accuracy_rolling']) ? (float) $row['accuracy_rolling'] : null,
            ];
        }

        return $out;
    }

    /**
     * @return array{id:string,zone_id:string,title_child:string,steps_done:int,steps_total:int}|null
     */
    private function fetchActiveQuest(string $childId): ?array
    {
        $stmt = $this->pdo->prepare(
            "select id, zone_id, title_child, steps_done, steps_total
             from narrative_quests where child_id = :id and status = 'active'
             order by updated_at desc nulls last limit 1",
        );
        $stmt->execute(['id' => $childId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            return null;
        }

        return [
            'id' => (string) ($row['id'] ?? ''),
            'zone_id' => (string) ($row['zone_id'] ?? ''),
            'title_child' => (string) ($row['title_child'] ?? ''),
            'steps_done' => (int) ($row['steps_done'] ?? 0),
            'steps_total' => (int) ($row['steps_total'] ?? AdventureService::ZONE_INTRO_GATES),
        ];
    }

    private function placementCompletedAt(string $childId): ?string
    {
        $stmt = $this->pdo->prepare(
            "select completed_at from placement_exams
             where child_id = :id and status = 'completed'
             order by completed_at desc nulls last limit 1",
        );
        $stmt->execute(['id' => $childId]);
        $val = $stmt->fetchColumn();

        return is_string($val) && $val !== '' ? $val : null;
    }

    /**
     * @return array{current:string,next:?string,percent_to_next:int,hint_tutor:string}
     */
    private function levelProgress(string $levelId, ?float $rolling, int $recentAttempts, string $subjectLabel): array
    {
        $accuracy = $rolling ?? 0.5;
        $idx = $this->bank->levelIndex($levelId);
        if ($idx >= 5) {
            return [
                'current' => 'L5',
                'next' => null,
                'percent_to_next' => 100,
                'hint_tutor' => 'Nivel máximo en esta materia.',
            ];
        }
        $percent = $recentAttempts < 1
            ? 10
            : (int) max(0, min(100, round(($accuracy / self::THRESHOLD_UP) * 100)));
        $next = 'L' . ($idx + 1);
        $hint = $accuracy >= self::THRESHOLD_UP && $recentAttempts >= 4
            ? "Cerca de subir a {$next} en {$subjectLabel}."
            : ($accuracy < 0.5
                ? 'Convendría reforzar en la aventura.'
                : "Nivel {$levelId} en {$subjectLabel}.");

        return [
            'current' => $levelId,
            'next' => $next,
            'percent_to_next' => $percent,
            'hint_tutor' => $hint,
        ];
    }

    /**
     * @param list<string> $zonesCompleted
     * @param array{id:string,zone_id:string}|null $activeQuest
     */
    private function zoneStatus(
        ?string $levelId,
        mixed $zoneId,
        array $zonesCompleted,
        ?string $activeZoneId,
        ?array $activeQuest,
    ): string {
        if ($levelId === null) {
            return 'not_evaluated';
        }
        if (!is_string($zoneId) || $zoneId === '') {
            return 'not_visited';
        }
        if (in_array($zoneId, $zonesCompleted, true)) {
            return 'completed';
        }
        if ($activeZoneId === $zoneId || ($activeQuest !== null && ($activeQuest['zone_id'] ?? '') === $zoneId)) {
            return 'in_progress';
        }

        return 'not_visited';
    }

    /**
     * @return array{id:string,track:string,tier:int,label_child:string,label_tutor:string}|null
     */
    private function rankDto(string $track, ?string $rankId, ?string $generalLevel, string $theme): ?array
    {
        if ($generalLevel === null) {
            return null;
        }
        $base = $this->bank->rankForGeneral($theme, $generalLevel);
        if ($rankId !== null && $rankId !== '') {
            $fromId = $this->rankById($track, $rankId, $theme);
            if ($fromId !== null) {
                $base = $fromId;
            }
        }

        return [
            'id' => (string) ($base['id'] ?? ''),
            'track' => $track === 'sci-fi' ? 'sci-fi' : 'fantasy',
            'tier' => (int) ($base['tier'] ?? 1),
            'label_child' => (string) ($base['label_child'] ?? ''),
            'label_tutor' => (string) ($base['label_child'] ?? ''),
        ];
    }

    /**
     * @return array{id:string,track:string,tier:int,label_child:string,label_tutor:string,min_general_level:string}|null
     */
    private function rankNextDto(string $track, int $currentTier, string $theme): ?array
    {
        if ($currentTier >= 5) {
            return null;
        }
        $nextTier = $currentTier + 1;
        $level = 'L' . $nextTier;
        $rank = $this->bank->rankForGeneral($theme, $level);

        return [
            'id' => (string) ($rank['id'] ?? ''),
            'track' => $track === 'sci-fi' ? 'sci-fi' : 'fantasy',
            'tier' => $nextTier,
            'label_child' => (string) ($rank['label_child'] ?? ''),
            'label_tutor' => (string) ($rank['label_child'] ?? ''),
            'min_general_level' => $level,
        ];
    }

    /**
     * @return array{id:string,label_child:string,tier:int}|null
     */
    private function rankById(string $track, string $rankId, string $theme): ?array
    {
        for ($tier = 1; $tier <= 5; $tier++) {
            $rank = $this->bank->rankForGeneral($theme, 'L' . $tier);
            if (($rank['id'] ?? '') === $rankId) {
                return $rank;
            }
        }
        unset($track);

        return null;
    }

    private function nextLevel(string $levelId): ?string
    {
        $idx = $this->bank->levelIndex($levelId);

        return $idx >= 5 ? null : 'L' . ($idx + 1);
    }

    private function nullableString(mixed $value): ?string
    {
        if (!is_string($value) || trim($value) === '') {
            return null;
        }

        return $value;
    }
}
