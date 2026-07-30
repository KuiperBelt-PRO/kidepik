<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use InvalidArgumentException;
use Kidepik\Api\Controllers\ParentSettingsController;
use Kidepik\Api\Services\ParentSettingsRepository;
use Kidepik\Api\Services\SupabaseAuthService;
use PHPUnit\Framework\TestCase;

final class ParentSettingsControllerErrorsTest extends TestCase
{
    public function testPatchInvalidJson(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willReturn([
            'sub' => '11111111-1111-1111-1111-111111111111',
            'email' => 'a@b.com',
        ]);

        $response = (new ParentSettingsController($auth))->update('Bearer t', '{bad');

        self::assertSame(422, $response->status);
    }

    public function testPatchValidationError(): void
    {
        $auth = $this->createMock(SupabaseAuthService::class);
        $auth->method('validateBearer')->willReturn([
            'sub' => '11111111-1111-1111-1111-111111111111',
            'email' => 'a@b.com',
        ]);
        $repo = $this->createMock(ParentSettingsRepository::class);
        $repo->method('getMergedSettingsForParentId')->willReturn([
            'ui_theme' => 'fantasy',
            'font_scale_ui' => 'md',
            'font_scale_play' => 'md',
            'reduce_motion' => 'system',
            'world_intensity' => 'lively',
            'crew_defaults' => [],
            'learning' => ['active_subjects' => ['math']],
            'narrative' => [],
            'privacy' => [],
            'schema_version' => 1,
        ]);
        $repo->method('patchForAuthUser')
            ->willThrowException(new InvalidArgumentException('ui_theme invalid'));

        $response = (new ParentSettingsController($auth, $repo))->update(
            'Bearer t',
            json_encode(['ui_theme' => 'neon'], JSON_THROW_ON_ERROR),
        );

        self::assertSame(422, $response->status);
    }
}
