<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Psr7\Request;
use Kidepik\Api\Services\AuthException;
use Kidepik\Api\Services\SupabaseAuthService;
use PHPUnit\Framework\TestCase;

final class SupabaseAuthServiceNetworkTest extends TestCase
{
    public function testUnreachableSupabaseThrows(): void
    {
        $http = $this->createMock(\GuzzleHttp\Client::class);
        $http->method('get')->willThrowException(
            new ConnectException('connection refused', new Request('GET', 'http://invalid')),
        );

        $service = new SupabaseAuthService($http);

        $this->expectException(AuthException::class);
        $service->validateBearer('Bearer token');
    }
}
