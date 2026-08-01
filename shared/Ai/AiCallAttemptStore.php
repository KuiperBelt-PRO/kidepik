<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

use Kidepik\Shared\Database\PdoFactory;
use PDO;
use PDOException;

/**
 * Persistencia de intentos LLM (debug / telemetría).
 */
final class AiCallAttemptStore
{
    public function __construct(private readonly ?PDO $pdo = null)
    {
    }

    public function persistTrace(AiAttemptTrace $trace, ?string $childId = null): void
    {
        $pdo = $this->pdo ?? PdoFactory::fromConfig();
        if (!$pdo instanceof PDO) {
            return;
        }

        $position = 0;
        foreach ($trace->attempts as $attempt) {
            try {
                $stmt = $pdo->prepare(
                    'insert into ai_call_attempts (
                        call_id, child_id, purpose, model_id, position, ok,
                        http_status, latency_ms, error_class, error_brief
                     ) values (
                        :call_id, :child_id, :purpose, :model_id, :position, :ok,
                        :http_status, :latency_ms, :error_class, :error_brief
                     )'
                );
                $stmt->execute([
                    'call_id' => $trace->callId,
                    'child_id' => $childId,
                    'purpose' => $trace->purpose,
                    'model_id' => (string) ($attempt['model_id'] ?? ''),
                    'position' => $position,
                    'ok' => (bool) ($attempt['ok'] ?? false),
                    'http_status' => isset($attempt['http_status']) ? (int) $attempt['http_status'] : null,
                    'latency_ms' => (int) ($attempt['latency_ms'] ?? 0),
                    'error_class' => isset($attempt['error_class']) ? (string) $attempt['error_class'] : null,
                    'error_brief' => isset($attempt['error_brief']) ? (string) $attempt['error_brief'] : null,
                ]);
            } catch (PDOException) {
                return;
            }
            $position++;
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function recent(int $limit = 20): array
    {
        $pdo = $this->pdo ?? PdoFactory::fromConfig();
        if (!$pdo instanceof PDO) {
            return [];
        }

        $limit = max(1, min(100, $limit));

        try {
            $stmt = $pdo->query(
                "select call_id, child_id, purpose, model_id, position, ok, http_status,
                        latency_ms, error_class, error_brief, created_at
                 from ai_call_attempts
                 order by created_at desc
                 limit {$limit}"
            );
            if ($stmt === false) {
                return [];
            }
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return is_array($rows) ? $rows : [];
        } catch (PDOException) {
            return [];
        }
    }

    /**
     * Conteos de éxito reciente por model_id para un purpose (boost de cola).
     *
     * @return array<string, int> model_id => success_count
     */
    public function successCounts(string $purpose, int $hours = 48): array
    {
        $pdo = $this->pdo ?? PdoFactory::fromConfig();
        if (!$pdo instanceof PDO || $purpose === '') {
            return [];
        }

        $hours = max(1, min(168, $hours));
        $seconds = $hours * 3600;

        try {
            $stmt = $pdo->prepare(
                'select model_id, count(*)::int as n
                 from ai_call_attempts
                 where purpose = :purpose
                   and ok = true
                   and created_at > to_timestamp(extract(epoch from now()) - :seconds)
                 group by model_id'
            );
            $stmt->execute(['purpose' => $purpose, 'seconds' => $seconds]);
            $out = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                if (!is_array($row)) {
                    continue;
                }
                $id = trim((string) ($row['model_id'] ?? ''));
                if ($id !== '') {
                    $out[$id] = (int) ($row['n'] ?? 0);
                }
            }

            return $out;
        } catch (PDOException) {
            return [];
        }
    }
}
