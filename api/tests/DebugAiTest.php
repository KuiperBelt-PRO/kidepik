<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Router;
use Kidepik\Shared\Ai\AiGateway;
use Kidepik\Shared\Ai\LLMException;
use Kidepik\Shared\Config;
use PHPUnit\Framework\TestCase;

final class DebugAiTest extends TestCase
{
    private string $prevAppEnv;
    private string $prevDebugAi;

    protected function setUp(): void
    {
        $this->prevAppEnv = (string) getenv('APP_ENV');
        $this->prevDebugAi = (string) getenv('APP_DEBUG_AI');
        $_ENV['APP_ENV'] = 'local';
        $_ENV['APP_DEBUG_AI'] = 'true';
        putenv('APP_ENV=local');
        putenv('APP_DEBUG_AI=true');
    }

    protected function tearDown(): void
    {
        $_ENV['APP_ENV'] = $this->prevAppEnv;
        $_ENV['APP_DEBUG_AI'] = $this->prevDebugAi;
        putenv('APP_ENV=' . $this->prevAppEnv);
        putenv('APP_DEBUG_AI=' . $this->prevDebugAi);
    }

    public function testGatewayRecordsTraceOnFallback(): void
    {
        $gateway = new AiGateway(
            modelQueue: ['bad:free', 'good:free'],
            chatFn: static function (string $model): array {
                if ($model === 'bad:free') {
                    throw new LLMException('upstream HTTP 429', 429);
                }

                return ['content' => '{"ok":true}', 'raw_model' => $model];
            },
        );

        $gateway->complete(
            [['role' => 'user', 'content' => 'hola']],
            ['purpose' => 'dialogue', 'capture_trace' => true],
        );

        $trace = $gateway->getLastTrace();
        self::assertNotNull($trace);
        self::assertSame('injected', $trace->queueSource);
        self::assertCount(2, $trace->attempts);
        self::assertFalse($trace->attempts[0]['ok']);
        self::assertTrue($trace->attempts[1]['ok']);
        self::assertSame('good:free', $trace->winnerModel);
    }

    public function testDebugRoutesHiddenWhenDebugDisabled(): void
    {
        $_ENV['APP_DEBUG_AI'] = 'false';
        putenv('APP_DEBUG_AI=false');

        $router = new Router();
        self::assertSame(404, $router->dispatch('GET', '/api/v1/debug/ai/status')->status);
        self::assertSame(404, $router->dispatch('GET', '/api/v1/debug/ai/queues')->status);
    }

    public function testShouldAttachDebugResponseRequiresHeader(): void
    {
        self::assertTrue(Config::shouldAttachDebugResponse('1'));
        self::assertFalse(Config::shouldAttachDebugResponse('0'));
        self::assertFalse(Config::shouldAttachDebugResponse(null));
    }
}
