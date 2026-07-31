<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

/**
 * Banco de ítems de placement + scoring PHP (SPEC_APP_PLACEMENT_EXAM).
 */
final class PlacementBank
{
    /** @var list<string> */
    public const SUBJECTS = ['math', 'language', 'logic', 'science', 'culture'];

    /** @var array<string,float> */
    public const WEIGHTS = [
        'math' => 0.30,
        'language' => 0.30,
        'logic' => 0.20,
        'science' => 0.10,
        'culture' => 0.10,
    ];

    /** @param array<string,mixed>|null $decoded */
    public function __construct(private ?array $decoded = null)
    {
    }

    public static function fromDefaultFile(): self
    {
        $path = __DIR__ . '/placement_bank/default.json';
        $raw = is_readable($path) ? file_get_contents($path) : false;
        $data = is_string($raw) ? json_decode($raw, true) : null;

        return new self(is_array($data) ? $data : []);
    }

    /**
     * @param list<string>|null $activeSubjects
     * @return list<array<string,mixed>>
     */
    public function pickQueue(string $ageBand, ?array $activeSubjects = null, int $maxItems = 5): array
    {
        $subjects = $activeSubjects ?: self::SUBJECTS;
        $subjects = array_values(array_filter(
            $subjects,
            static fn (string $s): bool => in_array($s, self::SUBJECTS, true)
        ));
        if ($subjects === []) {
            $subjects = self::SUBJECTS;
        }

        $queue = [];
        foreach ($subjects as $subject) {
            if (count($queue) >= $maxItems) {
                break;
            }
            $item = $this->pickOne($subject, $ageBand);
            if ($item !== null) {
                $queue[] = $item;
            }
        }

        return $queue;
    }

    /** @return array<string,mixed>|null */
    private function pickOne(string $subject, string $ageBand): ?array
    {
        $bank = $this->decoded[$subject] ?? [];
        if (!is_array($bank)) {
            return null;
        }
        $candidates = [];
        foreach ($bank as $row) {
            if (!is_array($row)) {
                continue;
            }
            $bands = $row['bands'] ?? null;
            if (is_array($bands) && $bands !== [] && !in_array($ageBand, $bands, true)) {
                continue;
            }
            $candidates[] = $row;
        }
        if ($candidates === []) {
            $first = $bank[0] ?? null;
            if (!is_array($first)) {
                return null;
            }
            $candidates = [$first];
        }

        $chosen = $candidates[array_key_first($candidates)];
        $chosen['subject_id'] = $subject;

        return $chosen;
    }

    /**
     * @param array<string,mixed> $item
     * @param array{kind:string,option_id?:string,text?:string} $reply
     */
    public function score(array $item, array $reply): float
    {
        $type = (string) ($item['item_type'] ?? 'mcq');
        $canonical = is_array($item['canonical_answer'] ?? null) ? $item['canonical_answer'] : [];

        if ($type === 'mcq') {
            $want = (string) ($canonical['option_id'] ?? '');
            $got = (string) ($reply['option_id'] ?? '');

            return ($want !== '' && $want === $got) ? 1.0 : 0.0;
        }

        if ($type === 'numeric') {
            $want = (float) ($canonical['numeric'] ?? 0);
            $tol = (float) ($canonical['tolerance'] ?? 0);
            $raw = $reply['text'] ?? $reply['option_id'] ?? '';
            if (!is_numeric((string) $raw)) {
                return 0.0;
            }
            $got = (float) $raw;

            return abs($got - $want) <= $tol ? 1.0 : 0.0;
        }

        // short_text: keyword match
        $text = mb_strtolower(trim((string) ($reply['text'] ?? '')));
        $keywords = $canonical['keywords'] ?? [];
        if (!is_array($keywords) || $keywords === []) {
            return $text !== '' ? 0.5 : 0.0;
        }
        foreach ($keywords as $kw) {
            if (!is_string($kw)) {
                continue;
            }
            if ($text === mb_strtolower($kw) || str_contains($text, mb_strtolower($kw))) {
                return 1.0;
            }
        }

        return $text !== '' ? 0.0 : 0.0;
    }

    /**
     * @param array<string,list<float>> $scoresBySubject
     * @return array{subjects:array<string,string>,general:string}
     */
    public function computeLevels(array $scoresBySubject): array
    {
        $levels = [];
        foreach (self::SUBJECTS as $subject) {
            $scores = $scoresBySubject[$subject] ?? [];
            if ($scores === []) {
                continue;
            }
            $avg = array_sum($scores) / count($scores);
            $levels[$subject] = $this->scoreToLevel($avg);
        }

        $active = array_keys($levels);
        $weightSum = 0.0;
        $weighted = 0.0;
        foreach ($active as $subject) {
            $w = self::WEIGHTS[$subject] ?? 0.0;
            $weightSum += $w;
            $weighted += $w * $this->levelIndex($levels[$subject]);
        }
        if ($weightSum <= 0) {
            return ['subjects' => $levels, 'general' => 'L1'];
        }
        $g = (int) round($weighted / $weightSum);
        $g = max(1, min(5, $g));

        return ['subjects' => $levels, 'general' => 'L' . $g];
    }

    public function scoreToLevel(float $score): string
    {
        return match (true) {
            $score < 0.35 => 'L1',
            $score < 0.55 => 'L2',
            $score < 0.70 => 'L3',
            $score < 0.85 => 'L4',
            default => 'L5',
        };
    }

    public function levelIndex(string $levelId): int
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

    /**
     * Promote effective band one step if strong performance.
     */
    public function promoteBand(string $ageBand, string $generalLevel, array $subjectLevels): string
    {
        $order = AgeBand::ALL;
        $idx = array_search($ageBand, $order, true);
        if ($idx === false) {
            return $ageBand;
        }
        $strongGeneral = in_array($generalLevel, ['L4', 'L5'], true);
        $strongSubjects = 0;
        foreach ($subjectLevels as $lvl) {
            if (in_array($lvl, ['L4', 'L5'], true)) {
                $strongSubjects++;
            }
        }
        if ($strongGeneral || $strongSubjects >= 2) {
            return $order[min(count($order) - 1, $idx + 1)];
        }

        return $ageBand;
    }

    public function rankForGeneral(string $worldTheme, string $generalLevel): array
    {
        $tier = $this->levelIndex($generalLevel);
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
