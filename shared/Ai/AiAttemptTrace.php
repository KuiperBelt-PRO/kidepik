<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

/**
 * Traza de intentos LLM para un complete().
 */
final class AiAttemptTrace
{
    public readonly string $callId;

    /** @param list<string> $resolvedModels */
    public function __construct(
        public readonly string $purpose,
        public readonly string $queueSource,
        public readonly array $resolvedModels,
        public readonly int $maxAttempts,
        /** @var list<array{model_id:string,ok:bool,http_status?:int,latency_ms:int,error_class?:string,error_brief?:string}> */
        public array $attempts = [],
        public ?string $winnerModel = null,
        public int $totalLatencyMs = 0,
        ?string $callId = null,
    ) {
        $this->callId = $callId ?? self::uuid4();
    }

    private static function uuid4(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'call_id' => $this->callId,
            'purpose' => $this->purpose,
            'queue_source' => $this->queueSource,
            'resolved_models' => $this->resolvedModels,
            'max_attempts' => $this->maxAttempts,
            'attempts' => $this->attempts,
            'winner_model' => $this->winnerModel,
            'total_latency_ms' => $this->totalLatencyMs,
        ];
    }
}
