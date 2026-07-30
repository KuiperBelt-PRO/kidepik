<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use Kidepik\Api\Controllers\ArchitectureController;
use PHPUnit\Framework\TestCase;

final class ArchitectureControllerExtendedTest extends TestCase
{
    public function testStatusHandlesSupabaseConnectionError(): void
    {
        $http = $this->createMock(Client::class);
        $http->method('get')->willThrowException(
            new ConnectException('down', new Request('GET', 'http://localhost')),
        );

        $response = (new ArchitectureController($http))->status();

        self::assertSame(200, $response->status);
        $body = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertFalse($body['supabase']['ok']);
        self::assertStringContainsString('down', $body['supabase']['detail']);
    }

    public function testStatusReportsSupabaseOk(): void
    {
        $http = $this->createMock(Client::class);
        $http->method('get')->willReturn(new Response(200));

        $response = (new ArchitectureController($http))->status();

        $body = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($body['supabase']['ok']);
    }
}
