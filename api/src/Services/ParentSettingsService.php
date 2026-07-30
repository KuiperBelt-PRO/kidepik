<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use InvalidArgumentException;

/**
 * Merge y validación de parent_accounts.settings (jsonb).
 */
final class ParentSettingsService
{
    public const SCHEMA_VERSION = 1;

    public const MEMBER_LIMIT = 10;

    /**
     * @return array<string, mixed>
     */
    public static function defaults(): array
    {
        return [
            'ui_theme' => 'fantasy',
            'font_scale_ui' => 'md',
            'font_scale_play' => 'md',
            'reduce_motion' => 'system',
            'world_intensity' => 'lively',
            'crew_defaults' => [
                'session_limit_per_day' => 3,
                'max_session_minutes' => 10,
                'require_exit_pin' => false,
                'allow_solo_start' => true,
                'lock_world_theme' => true,
                'font_scale_play' => 'md',
            ],
            'learning' => [
                'adaptation_policy' => 'balanced',
                'active_subjects' => ['math', 'language', 'logic', 'science', 'culture'],
                'show_levels_to_child' => false,
                'pause_adaptation' => false,
            ],
            'narrative' => [
                'creativity' => 'balanced',
                'avoid_themes' => [],
                'resume_mode' => 'continue',
            ],
            'privacy' => [
                'story_retention' => 'full',
                'analytics_opt_in' => false,
            ],
            'schema_version' => self::SCHEMA_VERSION,
        ];
    }

    /**
     * @param mixed $stored
     * @return array<string, mixed>
     */
    public static function mergeWithDefaults(mixed $stored): array
    {
        $base = self::defaults();
        if (!is_array($stored)) {
            return $base;
        }

        return self::deepMerge($base, $stored);
    }

    /**
     * @param array<string, mixed> $current
     * @param array<string, mixed> $patch
     * @return array<string, mixed>
     */
    public static function applyPatch(array $current, array $patch): array
    {
        $merged = self::deepMerge($current, $patch);
        self::validate($merged);

        return $merged;
    }

    /**
     * @param array<string, mixed> $settings
     */
    public static function validate(array $settings): void
    {
        self::assertEnum($settings['ui_theme'] ?? null, ['fantasy', 'sci-fi'], 'ui_theme');
        self::assertEnum($settings['font_scale_ui'] ?? null, ['md', 'lg', 'xl'], 'font_scale_ui');
        self::assertEnum($settings['font_scale_play'] ?? null, ['md', 'lg', 'xl'], 'font_scale_play');
        self::assertEnum($settings['reduce_motion'] ?? null, ['system', 'always', 'never'], 'reduce_motion');
        self::assertEnum($settings['world_intensity'] ?? null, ['calm', 'lively'], 'world_intensity');

        $crew = $settings['crew_defaults'] ?? null;
        if (!is_array($crew)) {
            throw new InvalidArgumentException('crew_defaults invalid');
        }
        $limit = $crew['session_limit_per_day'] ?? null;
        if ($limit !== null && (!is_int($limit) || $limit < 1 || $limit > 12)) {
            throw new InvalidArgumentException('crew_defaults.session_limit_per_day invalid');
        }
        self::assertSessionMinutes(
            $crew['max_session_minutes'] ?? null,
            'crew_defaults.max_session_minutes',
        );
        self::assertEnum($crew['font_scale_play'] ?? null, ['md', 'lg', 'xl'], 'crew_defaults.font_scale_play');
        if (!is_bool($crew['require_exit_pin'] ?? null)) {
            throw new InvalidArgumentException('crew_defaults.require_exit_pin invalid');
        }
        if (!is_bool($crew['allow_solo_start'] ?? null)) {
            throw new InvalidArgumentException('crew_defaults.allow_solo_start invalid');
        }
        if (!is_bool($crew['lock_world_theme'] ?? null)) {
            throw new InvalidArgumentException('crew_defaults.lock_world_theme invalid');
        }

        $learning = $settings['learning'] ?? null;
        if (!is_array($learning)) {
            throw new InvalidArgumentException('learning invalid');
        }
        self::assertEnum(
            $learning['adaptation_policy'] ?? null,
            ['balanced', 'easier', 'harder'],
            'learning.adaptation_policy',
        );
        $subjects = $learning['active_subjects'] ?? null;
        if (!is_array($subjects) || $subjects === []) {
            throw new InvalidArgumentException('learning.active_subjects must be non-empty');
        }
        foreach ($subjects as $subject) {
            if (!is_string($subject) || $subject === '') {
                throw new InvalidArgumentException('learning.active_subjects invalid');
            }
        }

        $narrative = $settings['narrative'] ?? null;
        if (!is_array($narrative)) {
            throw new InvalidArgumentException('narrative invalid');
        }
        self::assertEnum($narrative['creativity'] ?? null, ['conservative', 'balanced'], 'narrative.creativity');
        self::assertEnum($narrative['resume_mode'] ?? null, ['continue', 'recap'], 'narrative.resume_mode');
        $allowedThemes = ['fear', 'darkness', 'conflict', 'peril'];
        $avoid = $narrative['avoid_themes'] ?? [];
        if (!is_array($avoid)) {
            throw new InvalidArgumentException('narrative.avoid_themes invalid');
        }
        foreach ($avoid as $theme) {
            if (!is_string($theme) || !in_array($theme, $allowedThemes, true)) {
                throw new InvalidArgumentException('narrative.avoid_themes invalid');
            }
        }

        $privacy = $settings['privacy'] ?? null;
        if (!is_array($privacy)) {
            throw new InvalidArgumentException('privacy invalid');
        }
        self::assertEnum(
            $privacy['story_retention'] ?? null,
            ['full', 'days_30', 'days_90'],
            'privacy.story_retention',
        );
        if (!is_bool($privacy['analytics_opt_in'] ?? null)) {
            throw new InvalidArgumentException('privacy.analytics_opt_in invalid');
        }
    }

    /**
     * @param array<string, mixed> $base
     * @param array<string, mixed> $over
     * @return array<string, mixed>
     */
    private static function deepMerge(array $base, array $over): array
    {
        foreach ($over as $key => $value) {
            if (is_array($value) && isset($base[$key]) && is_array($base[$key]) && self::isAssoc($value)) {
                $base[$key] = self::deepMerge($base[$key], $value);
            } else {
                $base[$key] = $value;
            }
        }

        return $base;
    }

    /**
     * @param array<mixed> $arr
     */
    private static function isAssoc(array $arr): bool
    {
        if ($arr === []) {
            // [] no se distingue de {} en PHP; tratar vacío como reemplazo (listas).
            return false;
        }

        return array_keys($arr) !== range(0, count($arr) - 1);
    }

    /**
     * @param list<int|string> $allowed
     */
    private static function assertEnum(mixed $value, array $allowed, string $field): void
    {
        if (!in_array($value, $allowed, true)) {
            throw new InvalidArgumentException($field . ' invalid');
        }
    }

    private static function assertSessionMinutes(mixed $value, string $field): void
    {
        if (!is_numeric($value)) {
            throw new InvalidArgumentException($field . ' invalid');
        }
        $mins = (int) $value;
        if ((float) $value !== (float) $mins || $mins < 5 || $mins > 120 || $mins % 5 !== 0) {
            throw new InvalidArgumentException($field . ' invalid');
        }
    }
}
