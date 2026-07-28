<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use InvalidArgumentException;
use Kidepik\Api\Controllers\ParentSettingsController;
use Kidepik\Api\Router;
use Kidepik\Api\Services\ParentSettingsRepository;
use Kidepik\Api\Services\ParentSettingsService;
use Kidepik\Api\Services\SupabaseAuthService;
use PHPUnit\Framework\TestCase;

final class ParentSettingsTest extends TestCase
{
    public function testMergeFillsDefaultsFromEmpty(): void
    {
        $merged = ParentSettingsService::mergeWithDefaults([]);
        self::assertSame('fantasy', $merged['ui_theme']);
        self::assertSame('md', $merged['font_scale_ui']);
        self::assertSame(3, $merged['crew_defaults']['session_limit_per_day']);
        self::assertSame(1, $merged['schema_version']);
    }

    public function testPatchDeepMergesUiTheme(): void
    {
        $current = ParentSettingsService::defaults();
        $next = ParentSettingsService::applyPatch($current, ['ui_theme' => 'sci-fi', 'font_scale_ui' => 'lg']);
        self::assertSame('sci-fi', $next['ui_theme']);
        self::assertSame('lg', $next['font_scale_ui']);
        self::assertSame('md', $next['font_scale_play']);
    }

    public function testPatchRejectsInvalidTheme(): void
    {
        $this->expectException(InvalidArgumentException::class);
        ParentSettingsService::applyPatch(ParentSettingsService::defaults(), ['ui_theme' => 'neon']);
    }

    public function testPatchRejectsEmptySubjects(): void
    {
        $this->expectException(InvalidArgumentException::class);
        ParentSettingsService::applyPatch(ParentSettingsService::defaults(), [
            'learning' => ['active_subjects' => []],
        ]);
    }

    public function testGetSettingsRequiresAuth(): void
    {
        $response = (new Router())->dispatch('GET', '/api/v1/parents/me/settings');
        self::assertSame(401, $response->status);
    }

    public function testGetSettingsReturnsMergedDto(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willReturn([
            'sub' => '11111111-1111-1111-1111-111111111111',
            'role' => 'authenticated',
            'email' => 'padre@ejemplo.com',
        ]);

        $repo = $this->createMock(ParentSettingsRepository::class);
        $repo->expects(self::once())
            ->method('getForAuthUser')
            ->willReturn([
                'settings' => ParentSettingsService::defaults(),
                'crew_summary' => ['member_count' => 0],
            ]);

        $response = (new ParentSettingsController($auth, $repo))->show('Bearer t');
        self::assertSame(200, $response->status);
        $body = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertSame(0, $body['crew_summary']['member_count']);
        self::assertSame('fantasy', $body['settings']['ui_theme']);
    }

    public function testPatchSettingsValidates(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willReturn([
            'sub' => '11111111-1111-1111-1111-111111111111',
            'role' => 'authenticated',
            'email' => 'padre@ejemplo.com',
        ]);

        $repo = $this->createMock(ParentSettingsRepository::class);
        $repo->expects(self::once())
            ->method('patchForAuthUser')
            ->willThrowException(new InvalidArgumentException('ui_theme invalid'));

        $response = (new ParentSettingsController($auth, $repo))->update(
            'Bearer t',
            '{"ui_theme":"neon"}',
        );
        self::assertSame(422, $response->status);
    }
}
