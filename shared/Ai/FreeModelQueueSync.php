<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

use Kidepik\Shared\Config;
use Kidepik\Shared\Database\PdoFactory;
use Kidepik\Shared\Logging\AppLogger;
use PDO;
use PDOException;

/**
 * Sincroniza modelos free descubiertos en ai_purpose_model_queues (sin redeploy).
 */
final class FreeModelQueueSync
{
    /** @var list<string> */
    public const PURPOSES = [
        'placement_exam_composer',
        'placement_exam_batch_writer',
        'placement_item_writer',
        'dialogue',
        'journey_summarizer',
    ];

    private const STATE_KEY = 'free_model_discovery_last_run';

    public function __construct(
        private readonly ?PDO $pdo = null,
        private readonly ?FreeModelDiscovery $discovery = null,
        private readonly ?PurposeModelQueueStore $queues = null,
    ) {
    }

    public function syncIfStale(): bool
    {
        if (!Config::aiDiscoveryEnabled()) {
            return false;
        }

        $pdo = $this->pdo ?? PdoFactory::fromConfig();
        if (!$pdo instanceof PDO) {
            return false;
        }

        $last = $this->readLastRunEpoch($pdo);
        $interval = Config::aiDiscoveryIntervalHours() * 3600;
        if ($last !== null && (time() - $last) < $interval) {
            return false;
        }

        $stats = $this->sync();
        $this->writeLastRunEpoch($pdo, time());
        AppLogger::channel('ai')->info('free_model_discovery_sync', $stats);

        return true;
    }

    /**
     * @return array{purposes:int,added:int,skipped:int}
     */
    public function sync(): array
    {
        $discovery = $this->discovery ?? new FreeModelDiscovery();
        $store = $this->queues ?? new PurposeModelQueueStore($this->pdo);
        $pdo = $this->pdo ?? PdoFactory::fromConfig();

        $added = 0;
        $skipped = 0;
        $purposes = 0;
        $maxNew = Config::aiDiscoveryMaxNewPerPurpose();

        foreach (self::PURPOSES as $purpose) {
            $purposes++;
            $existing = $store->idsForPurpose($purpose);
            $existingSet = array_fill_keys($existing, true);

            try {
                $ranked = $discovery->rankedIds(null, $purpose);
            } catch (\Throwable) {
                $ranked = [];
            }

            $newIds = [];
            foreach ($ranked as $id) {
                if (isset($existingSet[$id])) {
                    continue;
                }
                $newIds[] = $id;
                if (count($newIds) >= $maxNew) {
                    break;
                }
            }

            foreach ($newIds as $modelId) {
                if ($this->appendModel($pdo, $purpose, $modelId)) {
                    $added++;
                    PurposeModelQueueStore::resetCacheForTests();
                } else {
                    $skipped++;
                }
            }
        }

        PurposeModelQueueStore::resetCacheForTests();

        return ['purposes' => $purposes, 'added' => $added, 'skipped' => $skipped];
    }

    private function readLastRunEpoch(PDO $pdo): ?int
    {
        try {
            $stmt = $pdo->prepare('select value from ai_runtime_state where key = :key');
            $stmt->execute(['key' => self::STATE_KEY]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!is_array($row)) {
                return null;
            }
            $value = trim((string) ($row['value'] ?? ''));

            return $value !== '' && ctype_digit($value) ? (int) $value : null;
        } catch (PDOException) {
            return null;
        }
    }

    private function writeLastRunEpoch(PDO $pdo, int $epoch): void
    {
        try {
            $stmt = $pdo->prepare(
                'insert into ai_runtime_state (key, value, updated_at)
                 values (:key, :value, now())
                 on conflict (key) do update set
                    value = excluded.value,
                    updated_at = now()'
            );
            $stmt->execute(['key' => self::STATE_KEY, 'value' => (string) $epoch]);
        } catch (PDOException) {
            // ignore
        }
    }

    private function appendModel(?PDO $pdo, string $purpose, string $modelId): bool
    {
        if ($pdo === null || $modelId === '') {
            return false;
        }

        try {
            $posStmt = $pdo->prepare(
                'select coalesce(max(position), 0) as max_pos
                 from ai_purpose_model_queues where purpose = :purpose'
            );
            $posStmt->execute(['purpose' => $purpose]);
            $row = $posStmt->fetch(PDO::FETCH_ASSOC);
            $nextPos = is_array($row) ? (int) ($row['max_pos'] ?? 0) + 1 : 1;

            $stmt = $pdo->prepare(
                'insert into ai_purpose_model_queues (purpose, model_id, position, enabled, notes, updated_at)
                 values (:purpose, :model_id, :position, true, :notes, now())
                 on conflict (purpose, model_id) do nothing'
            );
            $stmt->execute([
                'purpose' => $purpose,
                'model_id' => $modelId,
                'position' => $nextPos,
                'notes' => 'auto-discovery',
            ]);

            return $stmt->rowCount() > 0;
        } catch (PDOException) {
            return false;
        }
    }
}
