<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

/**
 * Bandas pedagógicas abiertas (SPEC_APP_AGE_BANDS).
 */
final class AgeBand
{
    public const EARLY = 'band_early';
    public const CHILD = 'band_child';
    public const TWEEN = 'band_tween';
    public const TEEN = 'band_teen';
    public const ADULT = 'band_adult';
    public const SENIOR = 'band_senior';

    /** @var list<string> */
    public const ALL = [
        self::EARLY,
        self::CHILD,
        self::TWEEN,
        self::TEEN,
        self::ADULT,
        self::SENIOR,
    ];

    public static function fromAgeYears(int $age): string
    {
        return match (true) {
            $age <= 7 => self::EARLY,
            $age <= 10 => self::CHILD,
            $age <= 13 => self::TWEEN,
            $age <= 17 => self::TEEN,
            $age <= 64 => self::ADULT,
            default => self::SENIOR,
        };
    }

    public static function isValid(?string $band): bool
    {
        return $band !== null && in_array($band, self::ALL, true);
    }

    /** Migra ids legacy age_7 / age_9. */
    public static function fromLegacy(?string $legacy, ?int $ageYears = null): ?string
    {
        if ($legacy === null || $legacy === '') {
            return $ageYears !== null ? self::fromAgeYears($ageYears) : null;
        }
        if (in_array($legacy, self::ALL, true)) {
            return $legacy;
        }
        if ($legacy === 'age_7') {
            return ($ageYears !== null && $ageYears <= 7) ? self::EARLY : self::CHILD;
        }
        if ($legacy === 'age_9') {
            return ($ageYears !== null && $ageYears >= 11) ? self::TWEEN : self::CHILD;
        }

        return null;
    }

    public static function assertAgeYears(int $age): void
    {
        if ($age < 5 || $age > 99) {
            throw new \InvalidArgumentException('age_years invalid');
        }
    }
}
