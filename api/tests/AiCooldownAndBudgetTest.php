<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Shared\Ai\AiGateway;
use Kidepik\Shared\Ai\AiModelCooldownStore;
use Kidepik\Shared\Ai\LLMException;
use Kidepik\Shared\Ai\PurposeModelQueueStore;
use PHPUnit\Framework\TestCase;

final class AiCooldownAndBudgetTest extends TestCase
{
    public function testGatewaySkipsModelsInCooldown(): void
    {
        $queueStore = $this->createStub(PurposeModelQueueStore::class);
        $queueStore->method('idsForPurpose')->willReturn(['blocked:free', 'ok:free']);

        $cooldown = $this->createStub(AiModelCooldownStore::class);
        $cooldown->method('filterAvailable')->willReturnCallback(
            static function (string $purpose, array $ids): array {
                return array_values(array_filter($ids, static fn (string $id): bool => $id !== 'blocked:free'));
            },
        );
        $cooldown->method('activeCooldownIds')->willReturn(['blocked:free']);

        $calls = [];
        $gateway = new AiGateway(
            chatFn: static function (string $model, array $messages, array $opts) use (&$calls): array {
                $calls[] = $model;

                return ['content' => '{"ok":true}', 'raw_model' => $model];
            },
            purposeQueues: $queueStore,
            cooldownStore: $cooldown,
        );

        $result = $gateway->complete([['role' => 'user', 'content' => 'hola']], ['purpose' => 'dialogue']);
        self::assertSame(['ok:free'], $calls);
        self::assertSame('ok:free', $result['model']);
    }

    public function testGatewayWallBudgetStopsFurtherAttempts(): void
    {
        putenv('AI_GATEWAY_WALL_BUDGET_SECONDS=1');
        $_ENV['AI_GATEWAY_WALL_BUDGET_SECONDS'] = '1';

        $gateway = new AiGateway(
            modelQueue: ['slow:free', 'good:free'],
            chatFn: static function (string $model, array $messages, array $opts): array {
                if ($model === 'slow:free') {
                    usleep(1_200_000);

                    throw new LLMException('slow fail', 500);
                }

                return ['content' => 'ok', 'raw_model' => $model];
            },
        );

        try {
            $gateway->complete([['role' => 'user', 'content' => 'x']]);
            self::fail('expected wall budget exception');
        } catch (LLMException $e) {
            self::assertStringContainsString('wall budget', strtolower($e->getMessage()));
        }
    }

    public function testCooldownStoreFiltersExpired(): void
    {
        $store = new AiModelCooldownStore(pdo: null);
        $filtered = $store->filterAvailable('dialogue', ['a:free', 'b:free']);
        self::assertSame(['a:free', 'b:free'], $filtered);
    }
}
