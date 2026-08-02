<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

use Kidepik\Shared\Database\PdoFactory;
use PDO;
use PDOException;

/**
 * Colas de modelos por purpose (tabla ai_purpose_model_queues).
 * SPEC_AI_OPENROUTER_GATEWAY — editable en BD sin redeploy.
 */
class PurposeModelQueueStore
{
    private static ?array $cache = null;

    private static int $cacheFetchedAt = 0;

    private const CACHE_TTL_SECONDS = 120;

    public function __construct(private readonly ?PDO $pdo = null)
    {
    }

    /**
     * @return list<string> model ids ordenados (enabled)
     */
    public function idsForPurpose(string $purpose): array
    {
        $all = $this->loadAll();
        $rows = $all[$purpose] ?? [];
        if ($rows === []) {
            return [];
        }

        usort(
            $rows,
            static fn (array $a, array $b): int => ((int) $a['position']) <=> ((int) $b['position']),
        );

        $ids = [];
        foreach ($rows as $row) {
            $id = trim((string) ($row['model_id'] ?? ''));
            if ($id !== '') {
                $ids[] = $id;
            }
        }

        return array_values(array_unique($ids));
    }

    public static function resetCacheForTests(): void
    {
        self::$cache = null;
        self::$cacheFetchedAt = 0;
    }

    public function disableModel(string $purpose, string $modelId, string $reason = ''): bool
    {
        $pdo = $this->pdo ?? PdoFactory::fromConfig();
        if (!$pdo instanceof PDO || $purpose === '' || $modelId === '') {
            return false;
        }

        try {
            $stmt = $pdo->prepare(
                'update ai_purpose_model_queues
                 set enabled = false,
                     notes = :notes,
                     updated_at = now()
                 where purpose = :purpose and model_id = :model_id'
            );
            $stmt->execute([
                'purpose' => $purpose,
                'model_id' => $modelId,
                'notes' => $reason !== '' ? mb_substr($reason, 0, 120) : 'disabled',
            ]);
            self::resetCacheForTests();

            return $stmt->rowCount() > 0;
        } catch (PDOException) {
            return false;
        }
    }

    /**
     * Sustituye el top de la cola por modelos descubiertos (auto-refresh).
     *
     * @param list<string> $modelIds
     */
    public function replaceTopModels(string $purpose, array $modelIds, string $notes = 'auto-refresh'): int
    {
        $pdo = $this->pdo ?? PdoFactory::fromConfig();
        if (!$pdo instanceof PDO || $purpose === '') {
            return 0;
        }

        $modelIds = array_values(array_unique(array_filter(
            $modelIds,
            static fn (mixed $id): bool => is_string($id) && $id !== '',
        )));
        if ($modelIds === []) {
            return 0;
        }

        $updated = 0;
        try {
            $pdo->beginTransaction();
            $upsert = $pdo->prepare(
                'insert into ai_purpose_model_queues (purpose, model_id, position, enabled, notes, updated_at)
                 values (:purpose, :model_id, :position, true, :notes, now())
                 on conflict (purpose, model_id) do update set
                    position = excluded.position,
                    enabled = true,
                    notes = excluded.notes,
                    updated_at = now()'
            );
            foreach ($modelIds as $index => $modelId) {
                $upsert->execute([
                    'purpose' => $purpose,
                    'model_id' => $modelId,
                    'position' => $index + 1,
                    'notes' => $notes,
                ]);
                $updated++;
            }

            $placeholders = implode(',', array_fill(0, count($modelIds), '?'));
            $disable = $pdo->prepare(
                "update ai_purpose_model_queues
                 set enabled = false,
                     notes = 'superseded by auto-refresh',
                     updated_at = now()
                 where purpose = ?
                   and enabled = true
                   and model_id not in ({$placeholders})
                   and position <= ?"
            );
            $disable->execute(array_merge([$purpose], $modelIds, [count($modelIds)]));
            $pdo->commit();
            self::resetCacheForTests();
        } catch (PDOException) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            return 0;
        }

        return $updated;
    }

    /**
     * @return list<array{purpose:string,model_id:string,position:int,enabled:bool,notes?:string}>
     */
    public function listRows(?string $purpose = null): array
    {
        $pdo = $this->pdo ?? PdoFactory::fromConfig();
        if (!$pdo instanceof PDO) {
            return [];
        }

        try {
            if ($purpose !== null && $purpose !== '') {
                $stmt = $pdo->prepare(
                    'select purpose, model_id, position, enabled, notes
                     from ai_purpose_model_queues
                     where purpose = :purpose
                     order by position asc'
                );
                $stmt->execute(['purpose' => $purpose]);
            } else {
                $stmt = $pdo->query(
                    'select purpose, model_id, position, enabled, notes
                     from ai_purpose_model_queues
                     order by purpose asc, position asc'
                );
            }
            if ($stmt === false) {
                return [];
            }
            $out = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                if (!is_array($row)) {
                    continue;
                }
                $out[] = [
                    'purpose' => (string) ($row['purpose'] ?? ''),
                    'model_id' => (string) ($row['model_id'] ?? ''),
                    'position' => (int) ($row['position'] ?? 0),
                    'enabled' => (bool) ($row['enabled'] ?? true),
                    'notes' => isset($row['notes']) ? (string) $row['notes'] : null,
                ];
            }

            return $out;
        } catch (PDOException) {
            return [];
        }
    }

    /**
     * @return array<string, list<array{model_id:string,position:int}>>
     */
    private function loadAll(): array
    {
        $now = time();
        if (self::$cache !== null && ($now - self::$cacheFetchedAt) < self::CACHE_TTL_SECONDS) {
            return self::$cache;
        }

        $pdo = $this->pdo ?? PdoFactory::fromConfig();
        if (!$pdo instanceof PDO) {
            self::$cache = [];
            self::$cacheFetchedAt = $now;

            return [];
        }

        try {
            $stmt = $pdo->query(
                'select purpose, model_id, position
                 from ai_purpose_model_queues
                 where enabled = true
                 order by purpose asc, position asc'
            );
            $grouped = [];
            if ($stmt !== false) {
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    if (!is_array($row)) {
                        continue;
                    }
                    $purpose = (string) ($row['purpose'] ?? '');
                    if ($purpose === '') {
                        continue;
                    }
                    $grouped[$purpose][] = [
                        'model_id' => (string) ($row['model_id'] ?? ''),
                        'position' => (int) ($row['position'] ?? 0),
                    ];
                }
            }
            self::$cache = $grouped;
            self::$cacheFetchedAt = $now;

            return $grouped;
        } catch (PDOException) {
            // Tabla aún no migrada u otro error: degradar a env/discovery.
            self::$cache = [];
            self::$cacheFetchedAt = $now;

            return [];
        }
    }
}
