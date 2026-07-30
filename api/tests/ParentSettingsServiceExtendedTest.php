<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use InvalidArgumentException;
use Kidepik\Api\Services\ParentSettingsService;
use PHPUnit\Framework\TestCase;

final class ParentSettingsServiceExtendedTest extends TestCase
{
    public function testMergeWithDefaultsDeepMerge(): void
    {
        $merged = ParentSettingsService::mergeWithDefaults([
            'learning' => ['active_subjects' => ['math']],
            'narrative' => ['avoid_themes' => ['fear']],
        ]);

        self::assertSame(['math'], $merged['learning']['active_subjects']);
        self::assertSame(['fear'], $merged['narrative']['avoid_themes']);
        self::assertSame('fantasy', $merged['ui_theme']);
    }

    public function testValidateAllEnumFailures(): void
    {
        $base = ParentSettingsService::defaults();

        $this->expectException(InvalidArgumentException::class);
        ParentSettingsService::applyPatch($base, ['ui_theme' => 'neon']);
    }

    public function testValidateReduceMotionInvalid(): void
    {
        $base = ParentSettingsService::defaults();

        $this->expectException(InvalidArgumentException::class);
        ParentSettingsService::applyPatch($base, ['reduce_motion' => 'sometimes']);
    }

    public function testValidateCrewDefaultsInvalid(): void
    {
        $base = ParentSettingsService::defaults();

        $this->expectException(InvalidArgumentException::class);
        ParentSettingsService::applyPatch($base, ['crew_defaults' => 'bad']);
    }

    public function testValidateCrewSessionLimitInvalid(): void
    {
        $base = ParentSettingsService::defaults();

        $this->expectException(InvalidArgumentException::class);
        ParentSettingsService::applyPatch($base, [
            'crew_defaults' => ['session_limit_per_day' => 0],
        ]);
    }

    public function testValidateCrewMaxMinutesInvalid(): void
    {
        $base = ParentSettingsService::defaults();

        $this->expectException(InvalidArgumentException::class);
        ParentSettingsService::applyPatch($base, [
            'crew_defaults' => ['max_session_minutes' => 11],
        ]);
    }

    public function testValidateCrewBoolFields(): void
    {
        $base = ParentSettingsService::defaults();

        $this->expectException(InvalidArgumentException::class);
        ParentSettingsService::applyPatch($base, [
            'crew_defaults' => ['require_exit_pin' => 'yes'],
        ]);
    }

    public function testValidateLearningInvalid(): void
    {
        $base = ParentSettingsService::defaults();

        $this->expectException(InvalidArgumentException::class);
        ParentSettingsService::applyPatch($base, ['learning' => null]);
    }

    public function testValidateLearningAdaptationPolicy(): void
    {
        $base = ParentSettingsService::defaults();

        $this->expectException(InvalidArgumentException::class);
        ParentSettingsService::applyPatch($base, [
            'learning' => ['adaptation_policy' => 'wild'],
        ]);
    }

    public function testValidateLearningSubjectInvalid(): void
    {
        $base = ParentSettingsService::defaults();

        $this->expectException(InvalidArgumentException::class);
        ParentSettingsService::applyPatch($base, [
            'learning' => ['active_subjects' => ['']],
        ]);
    }

    public function testValidateNarrativeInvalid(): void
    {
        $base = ParentSettingsService::defaults();

        $this->expectException(InvalidArgumentException::class);
        ParentSettingsService::applyPatch($base, ['narrative' => 'bad']);
    }

    public function testValidateNarrativeAvoidThemesInvalid(): void
    {
        $base = ParentSettingsService::defaults();

        $this->expectException(InvalidArgumentException::class);
        ParentSettingsService::applyPatch($base, [
            'narrative' => ['avoid_themes' => ['aliens']],
        ]);
    }

    public function testValidatePrivacyInvalid(): void
    {
        $base = ParentSettingsService::defaults();

        $this->expectException(InvalidArgumentException::class);
        ParentSettingsService::applyPatch($base, ['privacy' => null]);
    }

    public function testValidatePrivacyAnalyticsInvalid(): void
    {
        $base = ParentSettingsService::defaults();

        $this->expectException(InvalidArgumentException::class);
        ParentSettingsService::applyPatch($base, [
            'privacy' => ['analytics_opt_in' => 'yes'],
        ]);
    }

    public function testValidatePrivacyRetentionInvalid(): void
    {
        $base = ParentSettingsService::defaults();

        $this->expectException(InvalidArgumentException::class);
        ParentSettingsService::applyPatch($base, [
            'privacy' => ['story_retention' => 'forever'],
        ]);
    }

    public function testApplyPatchValidCrewDefaults(): void
    {
        $base = ParentSettingsService::defaults();
        $patched = ParentSettingsService::applyPatch($base, [
            'crew_defaults' => [
                'session_limit_per_day' => 5,
                'max_session_minutes' => 20,
                'font_scale_play' => 'xl',
            ],
        ]);

        self::assertSame(5, $patched['crew_defaults']['session_limit_per_day']);
        self::assertSame(20, $patched['crew_defaults']['max_session_minutes']);
        self::assertSame('xl', $patched['crew_defaults']['font_scale_play']);
    }
}
