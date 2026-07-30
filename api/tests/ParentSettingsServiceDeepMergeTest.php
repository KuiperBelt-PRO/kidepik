<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Services\ParentSettingsService;
use PHPUnit\Framework\TestCase;

final class ParentSettingsServiceDeepMergeTest extends TestCase
{
    public function testDeepMergeReplacesEmptyList(): void
    {
        $merged = ParentSettingsService::mergeWithDefaults([
            'learning' => ['active_subjects' => ['math']],
        ]);

        self::assertSame(['math'], $merged['learning']['active_subjects']);
    }

    public function testApplyPatchNarrativeAvoidThemes(): void
    {
        $base = ParentSettingsService::defaults();
        $patched = ParentSettingsService::applyPatch($base, [
            'narrative' => ['avoid_themes' => ['fear', 'darkness']],
        ]);

        self::assertSame(['fear', 'darkness'], $patched['narrative']['avoid_themes']);
    }

    public function testApplyPatchPrivacyRetention(): void
    {
        $base = ParentSettingsService::defaults();
        $patched = ParentSettingsService::applyPatch($base, [
            'privacy' => ['story_retention' => 'days_30', 'analytics_opt_in' => true],
        ]);

        self::assertSame('days_30', $patched['privacy']['story_retention']);
        self::assertTrue($patched['privacy']['analytics_opt_in']);
    }
}
