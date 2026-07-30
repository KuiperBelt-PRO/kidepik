<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Shared\Storage\UploadPlan;
use PHPUnit\Framework\TestCase;

final class UploadPlanTest extends TestCase
{
    public function testToArrayWithFields(): void
    {
        $plan = new UploadPlan(
            uploadUrl: '/upload',
            method: 'POST',
            fields: ['token' => 'abc'],
            publicUrl: '/media/x',
            token: 'abc',
            expiresIn: 60,
        );

        $array = $plan->toArray();

        self::assertSame('/upload', $array['upload']['url']);
        self::assertSame(['token' => 'abc'], $array['upload']['fields']);
        self::assertSame('/media/x', $array['public_url']);
    }

    public function testToArrayWithoutFields(): void
    {
        $plan = new UploadPlan(
            uploadUrl: '/upload',
            method: 'PUT',
            fields: [],
            publicUrl: '/media/y',
            token: 'tok',
            expiresIn: 120,
        );

        $array = $plan->toArray();

        self::assertArrayNotHasKey('fields', $array['upload']);
        self::assertSame('tok', $array['token']);
    }
}
