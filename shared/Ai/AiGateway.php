<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

use Kidepik\Shared\Config;

/**
 * Orquesta intentos free rankeados vía OpenRouter.
 */
final class AiGateway
{
    /**
     * @param list<string>|null $modelQueue cola explícita (tests); null = discovery/preferencia
     * @param callable(string,list<array{role:string,content:string}>,array):array|null $chatFn
     */
    public function __construct(
        private ?array $modelQueue = null,
        private $chatFn = null,
        private bool $allowPaid = false,
        private FreeModelCatalog $catalog = new FreeModelCatalog(),
        private FreeModelRanker $ranker = new FreeModelRanker(),
        private ?FreeModelDiscovery $discovery = null,
        private ?PurposeModelQueueStore $purposeQueues = null,
    ) {
    }

    public static function fromConfig(): self
    {
        if (Config::aiMock()) {
            return new self(modelQueue: ['mock/local'], chatFn: [MockAiGateway::class, 'complete']);
        }

        return new self(allowPaid: Config::aiAllowPaid());
    }

    public function isEnabled(): bool
    {
        return Config::aiEnabled();
    }

    /**
     * @param list<array{role:string,content:string}> $messages
     * @param array{temperature?:float,max_tokens?:int,response_format?:array,purpose?:string,child_id?:string} $opts
     * @return array{content:string,provider:string,model:string,usage?:array}
     */
    public function complete(array $messages, array $opts = []): array
    {
        if (!$this->isEnabled() && $this->chatFn === null) {
            throw new LLMException('AI disabled', 503);
        }

        $attempts = $this->resolveAttempts($opts['purpose'] ?? 'dialogue');
        if ($attempts === []) {
            throw new LLMException('no free models available', 503);
        }

        $last = null;
        foreach ($attempts as $modelId) {
            if (!$this->allowPaid && !$this->looksFreeId($modelId) && $modelId !== 'mock/local') {
                continue;
            }
            try {
                $result = $this->invokeChat($modelId, $messages, $opts);

                return [
                    'content' => $result['content'],
                    'provider' => 'openrouter',
                    'model' => $result['raw_model'] ?? $modelId,
                    'usage' => $result['usage'] ?? null,
                ];
            } catch (LLMException $e) {
                $last = $e;
                continue;
            }
        }

        throw $last ?? new LLMException('all free models failed', 503);
    }

    /**
     * @param list<array{role:string,content:string}> $messages
     * @param array{temperature?:float,max_tokens?:int,response_format?:array} $opts
     * @return array{content:string,usage?:array,raw_model?:string}
     */
    private function invokeChat(string $modelId, array $messages, array $opts): array
    {
        if ($this->chatFn !== null) {
            $fn = $this->chatFn;
            $out = $fn($modelId, $messages, $opts);
            if (!is_array($out) || !isset($out['content']) || !is_string($out['content'])) {
                throw new LLMException('invalid mock response', 500);
            }

            return $out;
        }

        $key = Config::openRouterApiKey();
        if ($key === '') {
            throw new LLMException('OPENROUTER_API_KEY missing', 503);
        }

        $client = new LLMClient(
            Config::openRouterBaseUrl(),
            $key,
            Config::aiTimeoutSeconds(),
            [
                'HTTP-Referer' => Config::aiHttpReferer(),
                'X-Title' => Config::aiAppTitle(),
            ],
        );

        return $client->chat($modelId, $messages, $opts);
    }

    /**
     * Orden: cola BD por purpose → discovery+ranking (con semilla env) → semilla env sola.
     *
     * @return list<string>
     */
    private function resolveAttempts(string $purpose): array
    {
        if ($this->modelQueue !== null) {
            return array_values($this->modelQueue);
        }

        $max = Config::aiMaxModelAttempts();

        $fromDb = $this->purposeQueueIds($purpose);
        $discovered = [];
        try {
            $discovery = $this->discovery ?? new FreeModelDiscovery();
            $discovered = $discovery->rankedIds(null, $purpose);
        } catch (\Throwable) {
            $discovered = [];
        }

        if ($fromDb !== []) {
            $ordered = [];
            $seen = [];
            foreach ($fromDb as $id) {
                if (!$this->allowPaid && !$this->looksFreeId($id)) {
                    continue;
                }
                if (isset($seen[$id])) {
                    continue;
                }
                $seen[$id] = true;
                $ordered[] = $id;
            }
            foreach ($discovered as $id) {
                if (isset($seen[$id])) {
                    continue;
                }
                if (!$this->allowPaid && !$this->looksFreeId($id) && $id !== 'mock/local') {
                    continue;
                }
                $seen[$id] = true;
                $ordered[] = $id;
            }
            if ($ordered !== []) {
                return array_slice($ordered, 0, $max);
            }
        }

        if ($discovered !== []) {
            return array_slice($discovered, 0, $max);
        }

        $preference = Config::aiModelPreferenceSeed($purpose);
        if ($preference === []) {
            return [];
        }

        $seed = [];
        foreach ($preference as $id) {
            if ($this->allowPaid || $this->looksFreeId($id)) {
                $seed[] = ['id' => $id, 'context_length' => 8192, 'last_success_at' => null, 'fail_count_window' => 0];
            }
        }
        $profile = Config::aiUsesQualityFreeModels($purpose)
            ? FreeModelRanker::PROFILE_QUALITY
            : FreeModelRanker::PROFILE_DEFAULT;
        $ranked = $this->ranker->rank($seed, $preference, $profile);
        $ids = array_map(static fn (array $r): string => $r['id'], $ranked);

        return array_slice($ids, 0, $max);
    }

    /** @return list<string> */
    private function purposeQueueIds(string $purpose): array
    {
        $store = $this->purposeQueues ?? new PurposeModelQueueStore();

        return $store->idsForPurpose($purpose);
    }

    private function looksFreeId(string $modelId): bool
    {
        return str_ends_with($modelId, ':free') || $modelId === 'mock/local';
    }
}
