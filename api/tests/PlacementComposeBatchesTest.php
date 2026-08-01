<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Shared\Ai\AgeBand;
use Kidepik\Shared\Ai\AiCallAttemptStore;
use Kidepik\Shared\Ai\AiGateway;
use Kidepik\Shared\Ai\LlmJsonPayload;
use Kidepik\Shared\Ai\PlacementExamComposer;
use Kidepik\Shared\Ai\PurposeModelQueueStore;
use Kidepik\Shared\Ai\SubjectCatalog;
use PHPUnit\Framework\TestCase;

final class PlacementComposeBatchesTest extends TestCase
{
    protected function tearDown(): void
    {
        PurposeModelQueueStore::resetCacheForTests();
        putenv('AI_COMPOSE_BATCH_MAX_SLOTS');
        putenv('AI_COMPOSE_BATCH_CONCURRENCY');
        putenv('AI_COMPOSE_STICKY_WINNER');
        unset($_ENV['AI_COMPOSE_BATCH_MAX_SLOTS'], $_ENV['AI_COMPOSE_BATCH_CONCURRENCY'], $_ENV['AI_COMPOSE_STICKY_WINNER']);
        parent::tearDown();
    }

    public function testChunkSlotsRespectsMax(): void
    {
        $slots = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        $chunks = PlacementExamComposer::chunkSlots($slots, 4);
        self::assertCount(2, $chunks);
        self::assertSame(['a', 'b', 'c', 'd'], $chunks[0]);
        self::assertSame(['e', 'f', 'g', 'h'], $chunks[1]);
        self::assertSame([$slots], PlacementExamComposer::chunkSlots($slots, 8));
        self::assertSame([], PlacementExamComposer::chunkSlots([], 4));
    }

    public function testComposeSingleBatchWhenFewSlots(): void
    {
        putenv('AI_MOCK=true');
        putenv('AI_ENABLED=true');
        putenv('AI_COMPOSE_BATCH_MAX_SLOTS=4');
        $_ENV['AI_MOCK'] = 'true';
        $_ENV['AI_ENABLED'] = 'true';
        $_ENV['AI_COMPOSE_BATCH_MAX_SLOTS'] = '4';

        $composer = new PlacementExamComposer();
        $queue = $composer->compose(
            [
                'world_theme' => 'fantasy',
                'age_band' => AgeBand::CHILD,
                'display_name' => 'Lua',
            ],
            ['math', 'language'],
        );
        self::assertCount(2, $queue);
        $debug = $composer->getLastComposeDebug();
        self::assertSame('ok', $debug['outcome']);
        self::assertCount(1, $debug['batches'] ?? []);
        self::assertSame(2, $debug['batches'][0]['slot_count'] ?? null);
    }

    public function testComposeManySlotsProducesMultipleBatches(): void
    {
        putenv('AI_MOCK=true');
        putenv('AI_ENABLED=true');
        putenv('AI_COMPOSE_BATCH_MAX_SLOTS=4');
        putenv('AI_COMPOSE_BATCH_CONCURRENCY=3');
        $_ENV['AI_MOCK'] = 'true';
        $_ENV['AI_ENABLED'] = 'true';
        $_ENV['AI_COMPOSE_BATCH_MAX_SLOTS'] = '4';
        $_ENV['AI_COMPOSE_BATCH_CONCURRENCY'] = '3';

        $subjects = array_slice(SubjectCatalog::ALL, 0, 8);
        $composer = new PlacementExamComposer();
        $queue = $composer->compose(
            [
                'world_theme' => 'sci-fi',
                'age_band' => AgeBand::ADULT,
                'age_years' => 34,
                'display_name' => 'Vatardar',
            ],
            $subjects,
        );
        self::assertNotEmpty($queue);
        $debug = $composer->getLastComposeDebug();
        self::assertSame('ok', $debug['outcome']);
        $batches = $debug['batches'] ?? [];
        self::assertGreaterThanOrEqual(2, count($batches));
        foreach ($batches as $batch) {
            self::assertTrue((bool) ($batch['ok'] ?? false));
            self::assertLessThanOrEqual(4, (int) ($batch['slot_count'] ?? 99));
        }
        self::assertCount((int) $debug['slot_count'], $queue);
    }

    public function testLlmJsonPayloadExtractsFromMarkdownFence(): void
    {
        $decoded = LlmJsonPayload::decodeObject('```json
{"items":[{"slot":0,"subject_id":"math"}]}
```');
        self::assertIsArray($decoded);
        self::assertCount(1, $decoded['items'] ?? []);
    }

    public function testLlmJsonPayloadRepairsTrailingComma(): void
    {
        $decoded = LlmJsonPayload::decodeObject('{"items":[{"slot":0,"subject_id":"math",},]}');
        self::assertIsArray($decoded);
        self::assertCount(1, $decoded['items'] ?? []);
    }

    public function testLlmJsonPayloadStripsThinkBlocks(): void
    {
        $decoded = LlmJsonPayload::decodeObject('razonando el enunciado{"items":[{"slot":1,"subject_id":"science"}]}');
        self::assertIsArray($decoded);
        self::assertSame(1, $decoded['items'][0]['slot'] ?? null);
    }

    public function testLlmJsonPayloadExtractComposeItemsFromAlternatives(): void
    {
        $fromItem = LlmJsonPayload::extractComposeItems(['item' => ['slot' => 2, 'subject_id' => 'math']]);
        self::assertCount(1, $fromItem ?? []);
        self::assertSame(2, $fromItem[0]['slot'] ?? null);

        $fromList = LlmJsonPayload::extractComposeItems([['slot' => 3, 'subject_id' => 'language']]);
        self::assertCount(1, $fromList ?? []);

        self::assertNull(LlmJsonPayload::extractComposeItems(['agent_text' => 'hi', 'input_mode' => 'text']));
    }

    public function testComposeRejectsDialogueEnvelopeAsWrongSchema(): void
    {
        putenv('AI_MOCK=false');
        putenv('AI_ENABLED=true');
        putenv('AI_COMPOSE_BATCH_MAX_SLOTS=4');
        $_ENV['AI_MOCK'] = 'false';
        $_ENV['AI_ENABLED'] = 'true';
        $_ENV['AI_COMPOSE_BATCH_MAX_SLOTS'] = '4';

        $gateway = new AiGateway(
            modelQueue: ['mock:free'],
            chatFn: static function (): array {
                return [
                    'content' => '{"agent_text":"Hola","input_mode":"text","choices":[]}',
                    'raw_model' => 'mock:free',
                ];
            },
        );

        $composer = new PlacementExamComposer(gateway: $gateway);
        $queue = $composer->compose(
            ['world_theme' => 'fantasy', 'age_band' => AgeBand::CHILD, 'display_name' => 'Lua'],
            ['math'],
        );
        self::assertSame([], $queue);
        $debug = $composer->getLastComposeDebug();
        $batches = $debug['batches'] ?? [];
        self::assertNotEmpty($batches);
        self::assertSame('wrong_schema', $batches[0]['outcome'] ?? null);
    }

    public function testGatewayExcludeModelsSkipsBlocked(): void
    {
        putenv('AI_MOCK=false');
        putenv('AI_ENABLED=true');
        $_ENV['AI_MOCK'] = 'false';
        $_ENV['AI_ENABLED'] = 'true';

        $called = [];
        $gateway = new AiGateway(
            modelQueue: ['bad:free', 'good:free'],
            chatFn: static function (string $model) use (&$called): array {
                $called[] = $model;

                return ['content' => '{"ok":true}', 'raw_model' => $model];
            },
        );

        $gateway->complete(
            [['role' => 'user', 'content' => 'x']],
            ['purpose' => 'placement_exam_composer', 'exclude_models' => ['bad:free']],
        );
        self::assertSame(['good:free'], $called);
    }

    public function testGatewayPreferredModelsAreTriedFirst(): void
    {
        putenv('AI_MOCK=false');
        putenv('AI_ENABLED=true');
        $_ENV['AI_MOCK'] = 'false';
        $_ENV['AI_ENABLED'] = 'true';

        $called = [];
        $gateway = new AiGateway(
            modelQueue: ['second:free', 'first:free'],
            chatFn: static function (string $model) use (&$called): array {
                $called[] = $model;

                return ['content' => '{"ok":true}', 'raw_model' => $model];
            },
        );

        $gateway->complete(
            [['role' => 'user', 'content' => 'x']],
            ['purpose' => 'placement_exam_composer', 'preferred_models' => ['first:free']],
        );
        self::assertSame(['first:free'], $called);
    }

    public function testSuccessCountsAcceptsPurposeAndReturnsMap(): void
    {
        $store = new AiCallAttemptStore(pdo: null);
        $counts = $store->successCounts('placement_exam_composer', 48);
        self::assertIsArray($counts);
        foreach ($counts as $modelId => $n) {
            self::assertIsString($modelId);
            self::assertIsInt($n);
        }
    }
}
