<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Http\JsonResponse;
use PHPUnit\Framework\TestCase;

final class JsonResponseTest extends TestCase
{
    public function testOkEncodesJson(): void
    {
        $response = JsonResponse::ok(['status' => 'ok', 'n' => 1]);

        self::assertSame(200, $response->status);
        self::assertSame('{"status":"ok","n":1}', $response->body);
        self::assertArrayHasKey('Content-Type', $response->headers);
    }

    public function testErrorUsesDetailField(): void
    {
        $response = JsonResponse::error('nope', 422);

        self::assertSame(422, $response->status);
        $body = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('nope', $body['detail']);
    }
}
