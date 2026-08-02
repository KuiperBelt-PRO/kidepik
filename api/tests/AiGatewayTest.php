<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Shared\Config;
use Kidepik\Shared\Ai\AgeBand;
use Kidepik\Shared\Ai\AiModelCooldownStore;
use Kidepik\Shared\Ai\AiGateway;
use Kidepik\Shared\Ai\FreeModelCatalog;
use Kidepik\Shared\Ai\FreeModelDiscovery;
use Kidepik\Shared\Ai\FreeModelQueueSync;
use Kidepik\Shared\Ai\FreeModelRanker;
use Kidepik\Shared\Ai\LLMException;
use Kidepik\Shared\Ai\MentorCatalog;
use Kidepik\Shared\Ai\MockAiGateway;
use Kidepik\Shared\Ai\PurposeModelQueueStore;
use PHPUnit\Framework\TestCase;

final class AiGatewayTest extends TestCase
{
    public function testCatalogKeepsOnlyFreeChatModels(): void
    {
        $catalog = new FreeModelCatalog();
        $free = $catalog->filterFree([
            ['id' => 'paid/model', 'pricing' => ['prompt' => '0.001', 'completion' => '0.002']],
            ['id' => 'acme/good:free', 'pricing' => ['prompt' => '0', 'completion' => '0'], 'name' => 'Good', 'context_length' => 8192],
            ['id' => 'acme/zero', 'pricing' => ['prompt' => 0, 'completion' => 0], 'context_length' => 4096],
            ['id' => 'openrouter/auto', 'pricing' => ['prompt' => '0', 'completion' => '0'], 'context_length' => 8192],
            ['id' => 'acme/embed:free', 'pricing' => ['prompt' => '0', 'completion' => '0']],
            ['id' => 'google/lyria-3-clip-preview', 'pricing' => ['prompt' => '0', 'completion' => '0'], 'architecture' => ['output_modalities' => ['audio']]],
            ['id' => 'deny/me:free', 'pricing' => ['prompt' => '0', 'completion' => '0']],
        ], ['deny/me:free']);

        $ids = array_column($free, 'id');
        self::assertSame(['acme/good:free'], $ids);
    }

    public function testCatalogKeepsOnlyFreeModels(): void
    {
        $this->testCatalogKeepsOnlyFreeChatModels();
    }

    public function testRankerOrdersByPreferenceThenScore(): void
    {
        $ranker = new FreeModelRanker();
        $ranked = $ranker->rank([
            ['id' => 'b:free', 'fail_count_window' => 0],
            ['id' => 'a:free', 'fail_count_window' => 0, 'last_success_at' => '2026-01-01'],
            ['id' => 'c:free', 'fail_count_window' => 5],
        ], ['a:free', 'b:free', 'c:free']);

        self::assertSame('a:free', $ranked[0]['id']);
        self::assertSame('c:free', $ranked[count($ranked) - 1]['id']);
    }

    public function testGatewayFallsBackToNextModel(): void
    {
        $calls = [];
        $gateway = new AiGateway(
            modelQueue: ['bad:free', 'good:free'],
            chatFn: static function (string $model, array $messages, array $opts) use (&$calls): array {
                $calls[] = $model;
                if ($model === 'bad:free') {
                    throw new LLMException('upstream HTTP 429', 429);
                }

                return ['content' => '{"agent_text":"ok","input_mode":"continue"}', 'raw_model' => $model];
            },
        );

        $result = $gateway->complete([['role' => 'user', 'content' => 'hola']]);
        self::assertSame(['bad:free', 'good:free'], $calls);
        self::assertSame('good:free', $result['model']);
        self::assertStringContainsString('ok', $result['content']);
    }

    public function testGatewaySkipsPaidWhenNotAllowed(): void
    {
        $gateway = new AiGateway(
            modelQueue: ['paid/model', 'ok:free'],
            chatFn: static fn (string $model, array $m, array $o): array => [
                'content' => 'hi',
                'raw_model' => $model,
            ],
            allowPaid: false,
        );

        $result = $gateway->complete([['role' => 'user', 'content' => 'x']]);
        self::assertSame('ok:free', $result['model']);
    }

    public function testRankerQualityProfilePrefersLargerInstructModels(): void
    {
        $ranker = new FreeModelRanker();
        $ranked = $ranker->rank([
            ['id' => 'google/gemma-3-27b-it:free', 'context_length' => 8192],
            ['id' => 'meta-llama/llama-3.3-70b-instruct:free', 'context_length' => 131072],
            ['id' => 'tiny/embed:free', 'context_length' => 4096],
        ], [], FreeModelRanker::PROFILE_QUALITY);

        self::assertSame('meta-llama/llama-3.3-70b-instruct:free', $ranked[0]['id']);
    }

    public function testDiscoveryRanksFreeModelsForDialoguePurpose(): void
    {
        $discovery = new FreeModelDiscovery();
        $ranked = $discovery->rankedIds([
            ['id' => 'google/gemma-3-27b-it:free', 'pricing' => ['prompt' => '0', 'completion' => '0'], 'context_length' => 8192],
            ['id' => 'meta-llama/llama-3.3-70b-instruct:free', 'pricing' => ['prompt' => '0', 'completion' => '0'], 'context_length' => 131072],
            ['id' => 'qwen/qwen3-30b-a3b:free', 'pricing' => ['prompt' => '0', 'completion' => '0'], 'context_length' => 32768],
        ], 'dialogue');

        self::assertSame('meta-llama/llama-3.3-70b-instruct:free', $ranked[0]);
    }

    public function testQualityPurposesFlagNarrativeRankingProfile(): void
    {
        self::assertTrue(Config::aiUsesQualityFreeModels('dialogue'));
        self::assertTrue(Config::aiUsesQualityFreeModels('journey_summarizer'));
        self::assertTrue(Config::aiUsesQualityFreeModels('placement_exam_composer'));
        self::assertFalse(Config::aiUsesQualityFreeModels('embedding_index'));
    }

    public function testGatewayUsesDiscoveryRankingForDialogue(): void
    {
        PurposeModelQueueStore::resetCacheForTests();

        $discovery = new class extends FreeModelDiscovery {
            /** @return list<string> */
            public function rankedIds(?array $rawOverride = null, string $purpose = 'dialogue'): array
            {
                return [
                    'meta-llama/llama-3.3-70b-instruct:free',
                    'google/gemma-3-27b-it:free',
                ];
            }
        };

        $queueStore = $this->createStub(PurposeModelQueueStore::class);
        $queueStore->method('idsForPurpose')->willReturn([]);

        $calls = [];
        $gateway = new AiGateway(
            chatFn: static function (string $model, array $messages, array $opts) use (&$calls): array {
                $calls[] = $model;

                return ['content' => '{"agent_text":"ok","input_mode":"continue"}', 'raw_model' => $model];
            },
            discovery: $discovery,
            purposeQueues: $queueStore,
        );

        $gateway->complete([['role' => 'user', 'content' => 'hola']], ['purpose' => 'dialogue']);
        self::assertContains($calls[0], [
            'meta-llama/llama-3.3-70b-instruct:free',
            'google/gemma-3-27b-it:free',
        ]);
    }

    public function testGatewayRefreshesQueueOnceAfterAllModelsFail(): void
    {
        putenv('OPENROUTER_API_KEY=sk-test');
        putenv('AI_DISCOVERY_SYNC=true');
        putenv('AI_ENABLED=true');
        $_ENV['OPENROUTER_API_KEY'] = 'sk-test';
        $_ENV['AI_DISCOVERY_SYNC'] = 'true';
        $_ENV['AI_ENABLED'] = 'true';

        $calls = 0;
        $sync = $this->createMock(FreeModelQueueSync::class);
        $sync->expects(self::once())
            ->method('refreshPurposeOnExhaustion')
            ->with('dialogue')
            ->willReturn(true);

        $queueStore = $this->createStub(PurposeModelQueueStore::class);
        $queueStore->method('idsForPurpose')->willReturn(['test-dead-only:free']);

        $cooldown = $this->createStub(AiModelCooldownStore::class);
        $cooldown->method('filterAvailable')->willReturnArgument(1);

        $gateway = new AiGateway(
            modelQueue: null,
            chatFn: static function () use (&$calls): array {
                $calls++;
                if ($calls <= 1) {
                    throw new LLMException('all dead', 503);
                }

                return ['content' => '{"agent_text":"ok"}', 'raw_model' => 'fresh/model:free'];
            },
            discovery: new class extends FreeModelDiscovery {
                public function rankedIds(?array $rawOverride = null, string $purpose = 'dialogue'): array
                {
                    return [];
                }
            },
            purposeQueues: $queueStore,
            cooldownStore: $cooldown,
            queueSync: $sync,
        );

        $result = $gateway->complete([['role' => 'user', 'content' => 'hola']], ['purpose' => 'dialogue']);
        self::assertSame(2, $calls);
        self::assertStringContainsString('ok', $result['content']);
    }

    public function testMockEnvelopeForInjectedTestsOnly(): void
    {
        $out = MockAiGateway::complete('mock/local', [
            ['role' => 'user', 'content' => 'quiero fantasía'],
        ], ['purpose' => 'dialogue']);
        $json = json_decode($out['content'], true);
        self::assertIsArray($json);
        self::assertArrayHasKey('agent_text', $json);
        self::assertArrayHasKey('input_mode', $json);
    }

    public function testConfigNeverAllowsPaidOrMock(): void
    {
        putenv('AI_ALLOW_PAID=true');
        putenv('AI_MOCK=true');
        $_ENV['AI_ALLOW_PAID'] = 'true';
        $_ENV['AI_MOCK'] = 'true';

        self::assertFalse(Config::aiAllowPaid());
        self::assertFalse(Config::aiMock());
    }

    public function testAgeBandMapping(): void
    {
        self::assertSame(AgeBand::EARLY, AgeBand::fromAgeYears(6));
        self::assertSame(AgeBand::ADULT, AgeBand::fromAgeYears(42));
        self::assertSame(AgeBand::SENIOR, AgeBand::fromAgeYears(70));
        self::assertSame(AgeBand::CHILD, AgeBand::fromLegacy('age_7', 8));
    }

    public function testMentorCatalog(): void
    {
        self::assertSame(MentorCatalog::FANTASY, MentorCatalog::idForWorldTheme('fantasy'));
        self::assertSame('El Arquitecto del Saber', MentorCatalog::profile(MentorCatalog::SCIFI)['display_name']);
        self::assertSame(MentorCatalog::NEUTRAL, MentorCatalog::idForWorldTheme(null));
    }
}
