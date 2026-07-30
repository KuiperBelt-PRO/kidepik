<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use InvalidArgumentException;
use Kidepik\Api\Controllers\CrewController;
use Kidepik\Api\Services\CrewService;
use Kidepik\Api\Services\ParentAccountService;
use Kidepik\Api\Services\ParentSettingsService;
use Kidepik\Api\Services\SupabaseAuthService;
use Kidepik\Shared\Config;
use Kidepik\Shared\Database\MigrationRunner;
use Kidepik\Shared\Database\PdoFactory;
use Kidepik\Shared\Storage\LocalFilesystemDriver;
use Kidepik\Shared\Storage\UploadTokenStore;
use PHPUnit\Framework\TestCase;

final class ParentSettingsServiceTest extends TestCase
{
    public function testApplyPatchRejectsInvalidFontScale(): void
    {
        $current = ParentSettingsService::defaults();

        $this->expectException(InvalidArgumentException::class);
        ParentSettingsService::applyPatch($current, ['font_scale_ui' => 'xxl']);
    }

    public function testApplyPatchRejectsEmptySubjects(): void
    {
        $current = ParentSettingsService::defaults();

        $this->expectException(InvalidArgumentException::class);
        ParentSettingsService::applyPatch($current, [
            'learning' => ['active_subjects' => []],
        ]);
    }

    public function testMergeWithDefaultsHandlesNull(): void
    {
        $merged = ParentSettingsService::mergeWithDefaults(null);
        self::assertSame('fantasy', $merged['ui_theme']);
    }
}
