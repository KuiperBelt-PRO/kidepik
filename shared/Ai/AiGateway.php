<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

use Kidepik\Shared\Config;
use Kidepik\Shared\Logging\AppLogger;

/**
 * Orquesta intentos free rankeados vía OpenRouter.
 */
final class AiGateway
{
    private ?AiAttemptTrace $lastTrace = null;

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
        private ?AiUsageTracker $usageTracker = null,
        private ?AiCallAttemptStore $attemptStore = null,
        private ?AiModelCooldownStore $cooldownStore = null,
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

    public function getLastTrace(): ?AiAttemptTrace
    {
        return $this->lastTrace;
    }

    /**
     * @return array{queue_source:string,resolved_models:list<string>,max_attempts:int}
     */
    public function resolveQueueSnapshot(string $purpose): array
    {
        return $this->buildResolution($purpose);
    }

    /**
     * @param list<array{role:string,content:string}> $messages
     * @param array{temperature?:float,max_tokens?:int,response_format?:array,purpose?:string,child_id?:string,capture_trace?:bool} $opts
     * @return array{content:string,provider:string,model:string,usage?:array,trace?:array<string,mixed>}
     */
    public function complete(array $messages, array $opts = []): array
    {
        if (!$this->isEnabled() && $this->chatFn === null) {
            throw new LLMException('AI disabled', 503);
        }

        $purpose = (string) ($opts['purpose'] ?? 'dialogue');
        $resolution = $this->buildResolution($purpose);
        $attempts = $resolution['resolved_models'];
        $preferred = $opts['preferred_models'] ?? null;
        $exclude = $opts['exclude_models'] ?? null;
        if (is_array($preferred) && $preferred !== []) {
            $merged = [];
            $seen = [];
            foreach ($preferred as $id) {
                if (!is_string($id) || $id === '' || isset($seen[$id])) {
                    continue;
                }
                $seen[$id] = true;
                $merged[] = $id;
            }
            foreach ($attempts as $id) {
                if (isset($seen[$id])) {
                    continue;
                }
                $seen[$id] = true;
                $merged[] = $id;
            }
            $attempts = array_slice($merged, 0, $resolution['max_attempts']);
        }
        if (is_array($exclude) && $exclude !== []) {
            $blocked = [];
            foreach ($exclude as $id) {
                if (is_string($id) && $id !== '') {
                    $blocked[$id] = true;
                }
            }
            if ($blocked !== []) {
                $attempts = array_values(array_filter(
                    $attempts,
                    static fn (string $id): bool => !isset($blocked[$id]),
                ));
            }
        }
        if ($attempts === []) {
            throw new LLMException('no free models available', 503);
        }

        $captureTrace = (bool) ($opts['capture_trace'] ?? false) || Config::aiDebugEnabled();
        $childId = isset($opts['child_id']) ? (string) $opts['child_id'] : null;

        $trace = $captureTrace
            ? new AiAttemptTrace(
                $purpose,
                $resolution['queue_source'],
                $attempts,
                $resolution['max_attempts'],
            )
            : null;

        $last = null;
        $wallStart = hrtime(true);
        $wallBudgetMs = Config::aiGatewayWallBudgetSeconds() * 1000;
        $cooldown = $this->cooldownStore ?? new AiModelCooldownStore();

        foreach ($attempts as $modelId) {
            $elapsedMs = (int) round((hrtime(true) - $wallStart) / 1_000_000);
            if ($elapsedMs >= $wallBudgetMs) {
                $budgetErr = new LLMException('gateway wall budget exceeded', 503);
                if ($trace !== null) {
                    $trace->attempts[] = [
                        'model_id' => $modelId,
                        'ok' => false,
                        'http_status' => null,
                        'latency_ms' => 0,
                        'error_class' => 'budget',
                        'error_brief' => 'wall budget exceeded',
                    ];
                }
                throw $budgetErr;
            }

            if (!$this->allowPaid && !$this->looksFreeId($modelId) && $modelId !== 'mock/local') {
                continue;
            }

            if ($this->modelQueue === null && $cooldown->filterAvailable($purpose, [$modelId]) === []) {
                continue;
            }

            $started = hrtime(true);
            try {
                $chatOpts = [
                    'temperature' => $opts['temperature'] ?? 0.68,
                ];
                if (isset($opts['purpose']) && is_string($opts['purpose'])) {
                    $chatOpts['purpose'] = $opts['purpose'];
                }
                if (isset($opts['max_tokens'])) {
                    $chatOpts['max_tokens'] = (int) $opts['max_tokens'];
                }
                if (isset($opts['response_format']) && is_array($opts['response_format'])) {
                    $chatOpts['response_format'] = $opts['response_format'];
                }
                $result = $this->invokeChat($modelId, $messages, $chatOpts);
                $latencyMs = (int) round((hrtime(true) - $started) / 1_000_000);

                if ($trace !== null) {
                    $trace->attempts[] = [
                        'model_id' => $modelId,
                        'ok' => true,
                        'latency_ms' => $latencyMs,
                    ];
                    $trace->winnerModel = $result['raw_model'] ?? $modelId;
                    $trace->totalLatencyMs += $latencyMs;
                }

                $this->usageTracker ??= new AiUsageTracker();
                $this->usageTracker->recordSuccess($purpose, $childId, [
                    'provider' => 'openrouter',
                    'model' => $result['raw_model'] ?? $modelId,
                    'usage' => $result['usage'] ?? null,
                ]);

                if ($this->modelQueue === null) {
                    $cooldown->clearOnSuccess($purpose, $modelId);
                }

                if ($trace !== null && Config::aiDebugEnabled()) {
                    $this->attemptStore ??= new AiCallAttemptStore();
                    $this->attemptStore->persistTrace($trace, $childId);
                    $this->logAttemptLine($trace);
                }

                $this->lastTrace = $trace;

                $out = [
                    'content' => $result['content'],
                    'provider' => 'openrouter',
                    'model' => $result['raw_model'] ?? $modelId,
                    'usage' => $result['usage'] ?? null,
                ];
                if ($trace !== null && ($opts['capture_trace'] ?? false)) {
                    $out['trace'] = $trace->toArray();
                }

                return $out;
            } catch (LLMException $e) {
                $latencyMs = (int) round((hrtime(true) - $started) / 1_000_000);
                $classified = self::classifyLlmError($e);
                if ($trace !== null) {
                    $trace->attempts[] = [
                        'model_id' => $modelId,
                        'ok' => false,
                        'http_status' => $e->status > 0 ? $e->status : null,
                        'latency_ms' => $latencyMs,
                        'error_class' => $classified['error_class'],
                        'error_brief' => $classified['error_brief'],
                    ];
                    $trace->totalLatencyMs += $latencyMs;
                    $this->logAttemptLine($trace, $modelId, false, $classified);
                }
                if ($this->modelQueue === null) {
                    $cooldown->recordFailure(
                        $purpose,
                        $modelId,
                        $classified['error_class'],
                        $e->status > 0 ? $e->status : null,
                        $classified['error_brief'],
                    );
                }
                $last = $e;
                continue;
            }
        }

        if ($trace !== null && Config::aiDebugEnabled()) {
            $this->attemptStore ??= new AiCallAttemptStore();
            $this->attemptStore->persistTrace($trace, $childId);
        }
        $this->lastTrace = $trace;

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

        try {
            return $client->chat($modelId, $messages, $opts);
        } catch (LLMException $e) {
            if ($e->status === 400 && isset($opts['response_format'])) {
                unset($opts['response_format']);

                return $client->chat($modelId, $messages, $opts);
            }

            throw $e;
        }
    }

    /**
     * @return array{queue_source:string,resolved_models:list<string>,max_attempts:int}
     */
    private function buildResolution(string $purpose): array
    {
        $max = Config::aiMaxModelAttempts();

        if ($this->modelQueue !== null) {
            return [
                'queue_source' => 'injected',
                'resolved_models' => array_values($this->modelQueue),
                'max_attempts' => $max,
            ];
        }

        $fromDb = $this->purposeQueueIds($purpose);
        $discovered = [];
        try {
            $discovery = $this->discovery ?? new FreeModelDiscovery();
            $discovered = $discovery->rankedIds(null, $purpose);
        } catch (\Throwable) {
            $discovered = [];
        }

        $cooldown = $this->cooldownStore ?? new AiModelCooldownStore();
        if ($this->modelQueue === null) {
            $skippedCooldown = array_values(array_unique(array_merge(
                array_diff($fromDb, $cooldown->filterAvailable($purpose, $fromDb)),
                array_diff($discovered, $cooldown->filterAvailable($purpose, $discovered)),
            )));
            if ($skippedCooldown !== [] && Config::aiDebugEnabled()) {
                AppLogger::channel('ai')->debug('models_in_cooldown', [
                    'purpose' => $purpose,
                    'skipped' => $skippedCooldown,
                ]);
            }
            $fromDb = $cooldown->filterAvailable($purpose, $fromDb);
            $discovered = $cooldown->filterAvailable($purpose, $discovered);
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
                $ordered = $this->fillAttempts($ordered, $discovered, $max, $this->allowPaid);
                $ordered = $this->boostByRecentSuccess($purpose, $ordered);

                return [
                    'queue_source' => 'db',
                    'resolved_models' => $ordered,
                    'max_attempts' => $max,
                ];
            }
        }

        if ($discovered !== []) {
            $ids = $this->boostByRecentSuccess($purpose, array_slice($discovered, 0, $max));

            return [
                'queue_source' => 'discovery',
                'resolved_models' => $ids,
                'max_attempts' => $max,
            ];
        }

        $preference = Config::aiModelPreferenceSeed($purpose);
        if ($preference === []) {
            return [
                'queue_source' => 'env_seed',
                'resolved_models' => [],
                'max_attempts' => $max,
            ];
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

        return [
            'queue_source' => 'env_seed',
            'resolved_models' => $this->boostByRecentSuccess($purpose, array_slice($ids, 0, $max)),
            'max_attempts' => $max,
        ];
    }

    /**
     * @param list<string> $ids
     * @return list<string>
     */
    private function boostByRecentSuccess(string $purpose, array $ids): array
    {
        if ($ids === [] || $this->modelQueue !== null) {
            return $ids;
        }

        try {
            $this->attemptStore ??= new AiCallAttemptStore();
            $counts = $this->attemptStore->successCounts($purpose, Config::aiSuccessBoostHours());
        } catch (\Throwable) {
            return $ids;
        }

        if ($counts === []) {
            return $ids;
        }

        $scored = [];
        foreach ($ids as $pos => $id) {
            $scored[] = ['id' => $id, 'score' => $counts[$id] ?? 0, 'pos' => $pos];
        }
        usort(
            $scored,
            static fn (array $a, array $b): int => ($b['score'] <=> $a['score']) ?: ($a['pos'] <=> $b['pos']),
        );

        return array_map(static fn (array $r): string => $r['id'], $scored);
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

    /**
     * @param list<string> $ordered
     * @param list<string> $discovered
     * @return list<string>
     */
    private function fillAttempts(array $ordered, array $discovered, int $max, bool $allowPaid): array
    {
        if (count($ordered) >= $max) {
            return array_slice($ordered, 0, $max);
        }

        $seen = array_fill_keys($ordered, true);
        foreach ($discovered as $id) {
            if (isset($seen[$id])) {
                continue;
            }
            if (!$allowPaid && !$this->looksFreeId($id) && $id !== 'mock/local') {
                continue;
            }
            $seen[$id] = true;
            $ordered[] = $id;
            if (count($ordered) >= $max) {
                break;
            }
        }

        return $ordered;
    }

    /**
     * @return array{error_class:string,error_brief:string}
     */
    private static function classifyLlmError(LLMException $e): array
    {
        $msg = $e->getMessage();
        $brief = mb_substr($msg, 0, 160);
        if (str_contains(mb_strtolower($msg), 'transport')) {
            return ['error_class' => 'transport', 'error_brief' => $brief];
        }
        if (str_contains(mb_strtolower($msg), 'timeout')) {
            return ['error_class' => 'timeout', 'error_brief' => $brief];
        }
        if (str_contains(mb_strtolower($msg), 'empty content')) {
            return ['error_class' => 'empty', 'error_brief' => $brief];
        }
        if (str_contains(mb_strtolower($msg), 'invalid json')) {
            return ['error_class' => 'json', 'error_brief' => $brief];
        }
        if ($e->status >= 400) {
            return ['error_class' => 'http', 'error_brief' => $brief];
        }

        return ['error_class' => 'other', 'error_brief' => $brief];
    }

    /**
     * @param array{error_class:string,error_brief:string}|null $classified
     */
    private function logAttemptLine(
        AiAttemptTrace $trace,
        ?string $modelId = null,
        bool $ok = true,
        ?array $classified = null,
    ): void {
        $last = $trace->attempts[count($trace->attempts) - 1] ?? null;
        $context = [
            'purpose' => $trace->purpose,
            'call_id' => $trace->callId,
            'model' => $modelId ?? ($last['model_id'] ?? ''),
            'ok' => $ok,
            'http_status' => $last['http_status'] ?? null,
            'latency_ms' => $last['latency_ms'] ?? 0,
            'error_class' => $classified['error_class'] ?? ($last['error_class'] ?? null),
            'error_brief' => $classified['error_brief'] ?? ($last['error_brief'] ?? null),
            'queue_source' => $trace->queueSource,
            'resolved_models' => $trace->resolvedModels,
        ];
        $logger = AppLogger::channel('ai');
        if ($ok) {
            $logger->debug('llm_attempt', $context);
        } else {
            $logger->warning('llm_attempt', $context);
        }
    }
}
