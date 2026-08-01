<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use Kidepik\Shared\Ai\AiCallAttemptStore;
use Kidepik\Shared\Ai\AiGateway;
use Kidepik\Shared\Ai\PurposeModelQueueStore;
use Kidepik\Shared\Config;
use Kidepik\Shared\Database\PdoFactory;
use PDO;

final class DebugAiService
{
    public function status(): array
    {
        return [
            'enabled' => Config::aiEnabled(),
            'mock' => Config::aiMock(),
            'key_present' => Config::openRouterKeyPresent(),
            'max_attempts' => Config::aiMaxModelAttempts(),
            'app_env' => Config::appEnv(),
            'debug_allowed' => Config::aiDebugEnabled(),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function queues(?string $purpose = null): array
    {
        $store = new PurposeModelQueueStore($this->pdo());

        return $store->listRows($purpose);
    }

    /**
     * @return array<string, mixed>
     */
    public function resolve(string $purpose): array
    {
        $gateway = AiGateway::fromConfig();
        $snapshot = $gateway->resolveQueueSnapshot($purpose);

        return [
            'purpose' => $purpose,
            'queue_source' => $snapshot['queue_source'],
            'resolved_models' => $snapshot['resolved_models'],
            'max_attempts' => $snapshot['max_attempts'],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function attempts(int $limit = 20): array
    {
        $store = new AiCallAttemptStore($this->pdo());

        return $store->recent($limit);
    }

    /**
     * @return array<string, mixed>
     */
    public function ping(?string $childId = null): array
    {
        $gateway = AiGateway::fromConfig();
        $messages = [
            ['role' => 'system', 'content' => 'Responde solo JSON {"ok":true}'],
            ['role' => 'user', 'content' => 'ping'],
        ];
        $result = $gateway->complete($messages, [
            'purpose' => 'dialogue',
            'temperature' => 0,
            'max_tokens' => 16,
            'child_id' => $childId,
            'capture_trace' => true,
        ]);
        $trace = $gateway->getLastTrace();

        return [
            'content_preview' => mb_substr((string) ($result['content'] ?? ''), 0, 200),
            'model' => $result['model'] ?? null,
            'trace' => $trace?->toArray(),
        ];
    }

    private function pdo(): ?PDO
    {
        return PdoFactory::fromConfig();
    }
}
