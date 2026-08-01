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
