<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

use InvalidArgumentException;

/**
 * Catálogo canónico de materias (SPEC_APP_SUBJECT_CATALOG).
 */
final class SubjectCatalog
{
    public const MATH = 'math';
    public const LANGUAGE = 'language';
    public const READING = 'reading';
    public const LOGIC = 'logic';
    public const SCIENCE = 'science';
    public const CULTURE = 'culture';
    public const GEOGRAPHY = 'geography';
    public const HISTORY = 'history';
    public const MYTHOLOGY = 'mythology';
    public const ETHICS = 'ethics';
    public const COMMUNICATION = 'communication';
    public const POLITICS = 'politics';
    public const ARTS = 'arts';
    public const SPORTS = 'sports';
    public const FINANCE = 'finance';

    /** @var list<string> */
    public const ALL = [
        self::MATH,
        self::LANGUAGE,
        self::READING,
        self::LOGIC,
        self::SCIENCE,
        self::CULTURE,
        self::GEOGRAPHY,
        self::HISTORY,
        self::MYTHOLOGY,
        self::ETHICS,
        self::COMMUNICATION,
        self::POLITICS,
        self::ARTS,
        self::SPORTS,
        self::FINANCE,
    ];

    /** @var array<string,float> */
    public const WEIGHTS = [
        self::MATH => 0.13,
        self::LANGUAGE => 0.13,
        self::READING => 0.09,
        self::LOGIC => 0.09,
        self::SCIENCE => 0.09,
        self::CULTURE => 0.06,
        self::GEOGRAPHY => 0.06,
        self::HISTORY => 0.08,
        self::MYTHOLOGY => 0.04,
        self::ETHICS => 0.05,
        self::COMMUNICATION => 0.04,
        self::POLITICS => 0.03,
        self::ARTS => 0.04,
        self::SPORTS => 0.03,
        self::FINANCE => 0.04,
    ];

    /** @var array<string,array{label:string,family:string,zone_id:?string}> */
    public const META = [
        self::MATH => ['label' => 'Matemáticas', 'family' => 'fundamentals', 'zone_id' => 'zone_math'],
        self::LANGUAGE => ['label' => 'Lengua y gramática', 'family' => 'fundamentals', 'zone_id' => 'zone_language'],
        self::READING => ['label' => 'Comprensión lectora', 'family' => 'fundamentals', 'zone_id' => 'zone_language'],
        self::LOGIC => ['label' => 'Lógica y razonamiento', 'family' => 'fundamentals', 'zone_id' => 'zone_logic'],
        self::SCIENCE => ['label' => 'Ciencias naturales', 'family' => 'sciences', 'zone_id' => 'zone_science'],
        self::CULTURE => ['label' => 'Cultura general', 'family' => 'humanities', 'zone_id' => 'zone_culture'],
        self::GEOGRAPHY => ['label' => 'Geografía', 'family' => 'humanities', 'zone_id' => 'zone_culture'],
        self::HISTORY => ['label' => 'Historia', 'family' => 'humanities', 'zone_id' => 'zone_culture'],
        self::MYTHOLOGY => ['label' => 'Mitología', 'family' => 'humanities', 'zone_id' => null],
        self::ETHICS => ['label' => 'Ética y moral', 'family' => 'society', 'zone_id' => null],
        self::COMMUNICATION => ['label' => 'Comunicación', 'family' => 'society', 'zone_id' => null],
        self::POLITICS => ['label' => 'Política y ciudadanía', 'family' => 'society', 'zone_id' => null],
        self::ARTS => ['label' => 'Arte (plástica, música, cine…)', 'family' => 'expression', 'zone_id' => null],
        self::SPORTS => ['label' => 'Deporte y salud', 'family' => 'expression', 'zone_id' => null],
        self::FINANCE => ['label' => 'Finanzas y economía cotidiana', 'family' => 'life', 'zone_id' => null],
    ];

    /** @var array<string,list<string>> */
    private const BASE_BY_BAND = [
        AgeBand::EARLY => [
            self::MATH, self::LANGUAGE, self::LOGIC, self::SCIENCE, self::ARTS, self::COMMUNICATION,
        ],
        AgeBand::CHILD => [
            self::MATH, self::LANGUAGE, self::READING, self::LOGIC, self::SCIENCE,
            self::ARTS, self::COMMUNICATION, self::SPORTS,
        ],
        AgeBand::TWEEN => [
            self::MATH, self::LANGUAGE, self::READING, self::LOGIC, self::SCIENCE,
            self::CULTURE, self::GEOGRAPHY, self::HISTORY, self::MYTHOLOGY, self::ETHICS,
            self::ARTS, self::COMMUNICATION, self::SPORTS,
        ],
        AgeBand::TEEN => [
            self::MATH, self::LANGUAGE, self::READING, self::LOGIC, self::SCIENCE,
            self::CULTURE, self::GEOGRAPHY, self::HISTORY, self::MYTHOLOGY, self::ETHICS,
            self::ARTS, self::COMMUNICATION, self::SPORTS, self::POLITICS, self::FINANCE,
        ],
        AgeBand::ADULT => self::ALL,
        AgeBand::SENIOR => self::ALL,
    ];

    /** @return list<string> */
    public static function ids(): array
    {
        return self::ALL;
    }

    public static function isValid(?string $id): bool
    {
        return $id !== null && in_array($id, self::ALL, true);
    }

    /** @return array<string,float> */
    public static function defaultWeights(): array
    {
        return self::WEIGHTS;
    }

    /** @return list<string> */
    public static function baseSubjectsForBand(string $ageBand): array
    {
        return self::BASE_BY_BAND[$ageBand] ?? self::BASE_BY_BAND[AgeBand::CHILD];
    }

    /**
     * @param list<mixed> $raw
     * @return list<string>
     */
    public static function normalizeActiveSubjects(array $raw): array
    {
        $out = [];
        foreach ($raw as $id) {
            if (!is_string($id) || $id === '') {
                continue;
            }
            if (!self::isValid($id)) {
                continue;
            }
            if (!in_array($id, $out, true)) {
                $out[] = $id;
            }
        }
        if ($out === []) {
            throw new InvalidArgumentException('learning.active_subjects must be non-empty');
        }
        if (count($out) > 16) {
            throw new InvalidArgumentException('learning.active_subjects exceeds maximum');
        }

        return $out;
    }

    /**
     * @param list<string> $active
     * @return array<string,float>
     */
    public static function renormalizeWeights(array $active): array
    {
        $active = self::normalizeActiveSubjects($active);
        $sum = 0.0;
        $raw = [];
        foreach ($active as $id) {
            $w = self::WEIGHTS[$id] ?? 0.0;
            $raw[$id] = $w;
            $sum += $w;
        }
        if ($sum <= 0.0) {
            $n = count($active);
            $eq = 1.0 / $n;
            $out = [];
            foreach ($active as $id) {
                $out[$id] = $eq;
            }

            return $out;
        }
        $out = [];
        foreach ($raw as $id => $w) {
            $out[$id] = $w / $sum;
        }

        return $out;
    }

    /**
     * @param list<string>|null $household
     * @return list<string>
     */
    public static function suggestActiveSubjects(string $ageBand, ?array $household = null): array
    {
        $base = self::baseSubjectsForBand($ageBand);
        $extra = [];
        if (is_array($household)) {
            foreach ($household as $id) {
                if (is_string($id) && self::isValid($id) && !in_array($id, $base, true)) {
                    $extra[] = $id;
                }
            }
        }

        return array_values(array_unique(array_merge($base, $extra)));
    }

    /** @return array<string,list<string>> */
    public static function families(): array
    {
        $out = [];
        foreach (self::META as $id => $meta) {
            $fam = $meta['family'];
            $out[$fam] ??= [];
            $out[$fam][] = $id;
        }

        return $out;
    }

    /**
     * @return array{0:int,1:int} min/max difficulty inclusive
     */
    public static function difficultyRange(string $ageBand): array
    {
        return match ($ageBand) {
            AgeBand::EARLY => [1, 1],
            AgeBand::CHILD => [1, 2],
            AgeBand::TWEEN => [2, 3],
            AgeBand::TEEN => [2, 4],
            AgeBand::ADULT => [3, 5],
            AgeBand::SENIOR => [2, 4],
            default => [1, 2],
        };
    }

    /** @return list<string> */
    public static function extraChallengeSubjects(string $ageBand): array
    {
        if (in_array($ageBand, [AgeBand::TEEN, AgeBand::ADULT, AgeBand::SENIOR], true)) {
            return [self::MATH, self::LANGUAGE];
        }

        return [];
    }

    /** @return list<string> */
    public static function allowedItemTypes(string $ageBand): array
    {
        return match ($ageBand) {
            AgeBand::EARLY => ['mcq'],
            AgeBand::CHILD => ['mcq', 'short_text'],
            default => ['mcq', 'short_text', 'numeric'],
        };
    }

    /**
     * Plan de materias del examen: 1 por activa + extras teen/adult/senior.
     *
     * @param list<string> $activeSubjects
     * @return list<string>
     */
    public static function examSubjectSlots(string $ageBand, array $activeSubjects): array
    {
        try {
            $subjects = self::normalizeActiveSubjects($activeSubjects);
        } catch (InvalidArgumentException) {
            $subjects = self::baseSubjectsForBand($ageBand);
        }
        $extras = self::extraChallengeSubjects($ageBand);
        $slots = [];
        foreach ($subjects as $subject) {
            $slots[] = $subject;
            if (in_array($subject, $extras, true)) {
                $slots[] = $subject;
            }
        }

        return $slots;
    }

    /**
     * @return array{0:int,1:int} min/max words for mentor prose
     */
    public static function proseWordRange(string $ageBand): array
    {
        return match ($ageBand) {
            AgeBand::EARLY => [20, 45],
            AgeBand::CHILD => [30, 60],
            AgeBand::TWEEN => [40, 80],
            AgeBand::TEEN => [50, 100],
            AgeBand::ADULT => [55, 120],
            AgeBand::SENIOR => [45, 100],
            default => [30, 60],
        };
    }

    /**
     * @return list<array{id:string,label:string,family:string,zone_id:?string}>
     */
    public static function listForUi(): array
    {
        $out = [];
        foreach (self::ALL as $id) {
            $meta = self::META[$id];
            $out[] = [
                'id' => $id,
                'label' => $meta['label'],
                'family' => $meta['family'],
                'zone_id' => $meta['zone_id'],
            ];
        }

        return $out;
    }
}
