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
class FreeModelQueueSync
{
    /** @var list<string> */
    public const PURPOSES = [
        'placement_exam_composer',
        'placement_exam_batch_writer',
        'placement_item_writer',
        'dialogue',
        'journey_summarizer',
        'adventure_pitch',
        'adventure_scene',
        'adventure_challenge',
        'adventure_waiting',
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

        $last = $this->readStateEpoch($pdo, self::STATE_KEY);
        $interval = Config::aiDiscoveryIntervalHours() * 3600;
        if ($last !== null && (time() - $last) < $interval) {
            return false;
        }

        $stats = $this->sync();
        $this->writeStateEpoch($pdo, self::STATE_KEY, time());
        AppLogger::channel('ai')->info('free_model_discovery_sync', $stats);

        return true;
    }

    /**
     * Refresh reactivo tras agotar la cola de un purpose (SPEC_AI_OPENROUTER_GATEWAY §4.5.1).
     */
    public function refreshPurposeOnExhaustion(string $purpose): bool
    {
        if (!Config::aiDiscoveryEnabled() || $purpose === '') {
            return false;
        }

        $pdo = $this->pdo ?? PdoFactory::fromConfig();
        if (!$pdo instanceof PDO) {
            return false;
        }

        $stateKey = 'queue_refresh_' . $purpose;
        $last = $this->readStateEpoch($pdo, $stateKey);
        $minInterval = Config::aiQueueRefreshMinMinutes() * 60;
        if ($last !== null && (time() - $last) < $minInterval) {
            return false;
        }

        $stats = $this->rebuildPurposeQueue($purpose, 'auto-refresh-exhaustion');
        if (($stats['promoted'] ?? 0) <= 0) {
            return false;
        }

        $this->writeStateEpoch($pdo, $stateKey, time());
        AppLogger::channel('ai')->warning('free_model_queue_refresh', [
            'purpose' => $purpose,
            'promoted' => $stats['promoted'],
            'disabled' => $stats['disabled'],
        ]);

        return true;
    }

    /**
     * Deshabilita un modelo en cola tras 404 upstream.
     */
    public function markModelUnavailable(string $purpose, string $modelId, string $reason): void
    {
        if ($purpose === '' || $modelId === '') {
            return;
        }

        $store = $this->queues ?? new PurposeModelQueueStore($this->pdo);
        $store->disableModel($purpose, $modelId, $reason);
    }

    /**
     * @return array{purposes:int,added:int,skipped:int,rebuilt:int}
     */
    public function sync(): array
    {
        $discovery = $this->discovery ?? new FreeModelDiscovery();
        $store = $this->queues ?? new PurposeModelQueueStore($this->pdo);
        $pdo = $this->pdo ?? PdoFactory::fromConfig();

        $added = 0;
        $skipped = 0;
        $rebuilt = 0;
        $purposes = 0;
        $maxNew = Config::aiDiscoveryMaxNewPerPurpose();

        foreach (self::PURPOSES as $purpose) {
            $purposes++;
            $existing = $store->idsForPurpose($purpose);
            if ($existing === []) {
                $stats = $this->rebuildPurposeQueue($purpose, 'auto-discovery-bootstrap');
                if (($stats['promoted'] ?? 0) > 0) {
                    $rebuilt++;
                }
                continue;
            }

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

        return [
            'purposes' => $purposes,
            'added' => $added,
            'skipped' => $skipped,
            'rebuilt' => $rebuilt,
        ];
    }

    /**
     * @return array{promoted:int,disabled:int}
     */
    private function rebuildPurposeQueue(string $purpose, string $notes): array
    {
        $discovery = $this->discovery ?? new FreeModelDiscovery();
        $store = $this->queues ?? new PurposeModelQueueStore($this->pdo);
        $pdo = $this->pdo ?? PdoFactory::fromConfig();

        try {
            $ranked = $discovery->rankedIds(null, $purpose);
        } catch (\Throwable) {
            $ranked = [];
        }

        $top = array_slice($ranked, 0, Config::aiDiscoveryRebuildTop());
        if ($top === []) {
            return ['promoted' => 0, 'disabled' => 0];
        }

        $disabled = $this->disableCooldownNotFound($pdo, $purpose);
        $promoted = $store->replaceTopModels($purpose, $top, $notes);

        return ['promoted' => $promoted, 'disabled' => $disabled];
    }

    private function disableCooldownNotFound(?PDO $pdo, string $purpose): int
    {
        if (!$pdo instanceof PDO) {
            return 0;
        }

        try {
            $stmt = $pdo->prepare(
                'select model_id from ai_model_cooldowns
                 where purpose = :purpose
                   and http_status = 404
                   and expires_at > now()'
            );
            $stmt->execute(['purpose' => $purpose]);
            $store = $this->queues ?? new PurposeModelQueueStore($pdo);
            $count = 0;
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                if (!is_array($row)) {
                    continue;
                }
                $id = trim((string) ($row['model_id'] ?? ''));
                if ($id !== '' && $store->disableModel($purpose, $id, 'upstream 404 cooldown')) {
                    $count++;
                }
            }

            return $count;
        } catch (PDOException) {
            return 0;
        }
    }

    private function readStateEpoch(PDO $pdo, string $key): ?int
    {
        try {
            $stmt = $pdo->prepare('select value from ai_runtime_state where key = :key');
            $stmt->execute(['key' => $key]);
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

    private function writeStateEpoch(PDO $pdo, string $key, int $epoch): void
    {
        try {
            $stmt = $pdo->prepare(
                'insert into ai_runtime_state (key, value, updated_at)
                 values (:key, :value, now())
                 on conflict (key) do update set
                    value = excluded.value,
                    updated_at = now()'
            );
            $stmt->execute(['key' => $key, 'value' => (string) $epoch]);
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
