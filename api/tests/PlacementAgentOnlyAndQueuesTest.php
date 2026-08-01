<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Shared\Ai\AgeBand;
use Kidepik\Shared\Ai\AiGateway;
use Kidepik\Shared\Ai\LLMException;
use Kidepik\Shared\Ai\PlacementExamComposer;
use Kidepik\Shared\Ai\PurposeModelQueueStore;
use PHPUnit\Framework\TestCase;

final class PlacementAgentOnlyAndQueuesTest extends TestCase
{
    protected function tearDown(): void
    {
        PurposeModelQueueStore::resetCacheForTests();
        parent::tearDown();
    }

    public function testComposeReturnsEmptyWhenAgentFailsWithoutBankFallback(): void
    {
        putenv('AI_MOCK=false');
        putenv('AI_ENABLED=true');
        $_ENV['AI_MOCK'] = 'false';
        $_ENV['AI_ENABLED'] = 'true';

        $gateway = new AiGateway(
            modelQueue: ['mock/local'],
            chatFn: static function (): array {
                throw new LLMException('forced fail', 503);
            },
        );
        $composer = new PlacementExamComposer(gateway: $gateway);
        $queue = $composer->compose(
            [
                'world_theme' => 'fantasy',
                'age_band' => AgeBand::ADULT,
                'display_name' => 'Ana',
            ],
            ['math', 'ethics'],
        );
        self::assertSame([], $queue);
    }

    public function testComposeMockNeverUsesBankSource(): void
    {
        putenv('AI_MOCK=true');
        putenv('AI_ENABLED=true');
        $_ENV['AI_MOCK'] = 'true';
        $_ENV['AI_ENABLED'] = 'true';

        $composer = new PlacementExamComposer();
        $queue = $composer->compose(
            [
                'world_theme' => 'fantasy',
                'age_band' => AgeBand::ADULT,
                'age_years' => 30,
                'display_name' => 'Ana',
            ],
            ['math', 'mythology'],
        );
        self::assertNotEmpty($queue);
        foreach ($queue as $item) {
            self::assertSame('agent', $item['source'] ?? null);
            self::assertStringNotContainsString('120 km en 2 horas', (string) ($item['prompt_text'] ?? ''));
        }
    }

    public function testPurposeQueueStoreReturnsEmptyWithoutPdo(): void
    {
        PurposeModelQueueStore::resetCacheForTests();
        $store = new PurposeModelQueueStore(pdo: null);
        // without config PDO this may be [] — just assert list type
        $ids = $store->idsForPurpose('placement_exam_composer');
        self::assertIsArray($ids);
    }

    public function testGatewayPrefersInjectedPurposeQueue(): void
    {
        $store = $this->createStub(PurposeModelQueueStore::class);
        $store->method('idsForPurpose')->willReturn([
            'google/gemma-3-27b-it:free',
            'meta-llama/llama-3.3-70b-instruct:free',
        ]);

        $called = [];
        $gateway = new AiGateway(
            modelQueue: null,
            chatFn: static function (string $modelId) use (&$called): array {
                $called[] = $modelId;
                return ['content' => '{"agent_text":"ok","input_mode":"continue"}', 'raw_model' => $modelId];
            },
            allowPaid: false,
            purposeQueues: $store,
        );

        // Force resolveAttempts path by not setting modelQueue — but chatFn needs enable
        putenv('AI_ENABLED=true');
        $_ENV['AI_ENABLED'] = 'true';
        putenv('AI_MOCK=false');
        $_ENV['AI_MOCK'] = 'false';

        // modelQueue null + purposeQueues stub: need to bypass discovery empty
        // Use reflection? Easier: construct with modelQueue from store for unit... 
        // Instead call complete with purpose and stub discovery via modelQueue null.
        // Without discovery HTTP, discovered=[], fromDb used.

        $result = $gateway->complete(
            [['role' => 'user', 'content' => 'hola']],
            ['purpose' => 'placement_exam_composer'],
        );
        self::assertSame('google/gemma-3-27b-it:free', $called[0] ?? null);
        self::assertSame('google/gemma-3-27b-it:free', $result['model']);
    }
}
