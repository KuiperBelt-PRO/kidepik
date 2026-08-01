<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

use Kidepik\Shared\Config;
use Kidepik\Shared\Database\PdoFactory;
use PDO;
use PDOException;

/**
 * Cooldown temporal por purpose+modelo tras fallos LLM (TTL por clase de error).
 */
class AiModelCooldownStore
{
    public function __construct(private readonly ?PDO $pdo = null)
    {
    }

    public function recordFailure(
        string $purpose,
        string $modelId,
        string $errorClass,
        ?int $httpStatus,
        string $errorBrief,
    ): void {
        $pdo = $this->pdo ?? PdoFactory::fromConfig();
        if (!$pdo instanceof PDO || $modelId === '') {
            return;
        }

        $hours = $this->cooldownHours($errorClass, $httpStatus);
        $expiresAt = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))
            ->modify('+' . $hours . ' hours')
            ->format('Y-m-d H:i:s');

        try {
            $stmt = $pdo->prepare(
                'insert into ai_model_cooldowns (
                    purpose, model_id, error_class, http_status, last_error_brief,
                    failure_count, expires_at, updated_at
                 ) values (
                    :purpose, :model_id, :error_class, :http_status, :brief, 1, :expires_at, now()
                 )
                 on conflict (purpose, model_id) do update set
                    error_class = excluded.error_class,
                    http_status = excluded.http_status,
                    last_error_brief = excluded.last_error_brief,
                    failure_count = ai_model_cooldowns.failure_count + 1,
                    expires_at = excluded.expires_at,
                    updated_at = now()'
            );
            $stmt->execute([
                'purpose' => $purpose,
                'model_id' => $modelId,
                'error_class' => $errorClass,
                'http_status' => $httpStatus,
                'brief' => mb_substr($errorBrief, 0, 200),
                'expires_at' => $expiresAt,
            ]);
        } catch (PDOException) {
            // Tabla no migrada u otro error: degradar sin bloquear gateway.
        }
    }

    public function clearOnSuccess(string $purpose, string $modelId): void
    {
        $pdo = $this->pdo ?? PdoFactory::fromConfig();
        if (!$pdo instanceof PDO || $modelId === '') {
            return;
        }

        try {
            $stmt = $pdo->prepare(
                'delete from ai_model_cooldowns where purpose = :purpose and model_id = :model_id'
            );
            $stmt->execute(['purpose' => $purpose, 'model_id' => $modelId]);
        } catch (PDOException) {
            // ignore
        }
    }

    /**
     * @param list<string> $modelIds
     * @return list<string>
     */
    public function filterAvailable(string $purpose, array $modelIds): array
    {
        $pdo = $this->pdo ?? PdoFactory::fromConfig();
        if (!$pdo instanceof PDO || $modelIds === []) {
            return $modelIds;
        }

        $cooldown = $this->activeCooldownIds($purpose);
        if ($cooldown === []) {
            return $modelIds;
        }

        $blocked = array_fill_keys($cooldown, true);
        $out = [];
        foreach ($modelIds as $id) {
            if (!isset($blocked[$id])) {
                $out[] = $id;
            }
        }

        return $out;
    }

    /**
     * @return list<string>
     */
    public function activeCooldownIds(string $purpose): array
    {
        $pdo = $this->pdo ?? PdoFactory::fromConfig();
        if (!$pdo instanceof PDO) {
            return [];
        }

        try {
            $stmt = $pdo->prepare(
                'select model_id from ai_model_cooldowns
                 where purpose = :purpose and expires_at > now()
                 order by expires_at asc'
            );
            $stmt->execute(['purpose' => $purpose]);
            $ids = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                if (!is_array($row)) {
                    continue;
                }
                $id = trim((string) ($row['model_id'] ?? ''));
                if ($id !== '') {
                    $ids[] = $id;
                }
            }

            return $ids;
        } catch (PDOException) {
            return [];
        }
    }

    private function cooldownHours(string $errorClass, ?int $httpStatus): int
    {
        if ($errorClass === 'compose_parse') {
            return Config::aiCooldownComposeParseHours();
        }
        if ($errorClass === 'transport' || $errorClass === 'timeout') {
            return max(1, Config::aiCooldownTransportHours());
        }
        if ($errorClass === 'empty') {
            return max(1, Config::aiCooldownEmptyHours());
        }
        if ($errorClass === 'http') {
            if ($httpStatus === 404) {
                return max(1, Config::aiCooldownNotFoundHours());
            }
            if ($httpStatus === 429) {
                return max(1, Config::aiCooldownRateLimitHours());
            }

            return max(1, Config::aiCooldownHttpHours());
        }

        return max(1, Config::aiCooldownDefaultHours());
    }
}
