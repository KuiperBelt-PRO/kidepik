<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use Kidepik\Shared\Ai\AiGateway;
use Kidepik\Shared\Config;
use PDO;

/**
 * Actualiza L2 condensed_full a partir del ledger L1 (story_beats).
 */
final class JourneyMemoryService
{
    public function __construct(
        private readonly PDO $pdo,
        private readonly ?AiGateway $gateway = null,
    ) {
    }

    /**
     * Resume si hay suficientes beats y el último resumen no cubre el tramo.
     *
     * @return array{wrote:bool,summary:?string,up_to:?int}
     */
    public function maybeCondense(string $childId, int $everyN = 3): array
    {
        $stmt = $this->pdo->prepare('select count(*) from story_beats where child_id = :id');
        $stmt->execute(['id' => $childId]);
        $count = (int) $stmt->fetchColumn();
        if ($count < $everyN || $count % $everyN !== 0) {
            return ['wrote' => false, 'summary' => null, 'up_to' => null];
        }

        return $this->condenseNow($childId);
    }

    /**
     * @return array{wrote:bool,summary:?string,up_to:?int}
     */
    public function condenseNow(string $childId): array
    {
        $beats = $this->pdo->prepare(
            'select sequence_num, narrative_text from story_beats
             where child_id = :id order by sequence_num asc'
        );
        $beats->execute(['id' => $childId]);
        $lines = [];
        foreach ($beats->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $lines[] = '#' . $row['sequence_num'] . ' ' . $row['narrative_text'];
        }
        if ($lines === []) {
            return ['wrote' => false, 'summary' => null, 'up_to' => null];
        }

        $joined = implode("\n", $lines);
        $summary = mb_substr($joined, 0, 800);
        $model = null;

        $gateway = $this->gateway ?? AiGateway::fromConfig();
        try {
            if (Config::aiMock() || $gateway->isEnabled()) {
                $gw = Config::aiMock() ? AiGateway::fromConfig() : $gateway;
                $result = $gw->complete([
                    [
                        'role' => 'system',
                        'content' => 'Resume el viaje del explorador en español de España, 2-4 frases. '
                            . 'Cita solo hechos del ledger. JSON {"summary":"..."}',
                    ],
                    ['role' => 'user', 'content' => $joined],
                ], ['purpose' => 'journey_summarizer', 'child_id' => $childId]);
                $parsed = json_decode($result['content'], true);
                if (is_array($parsed) && isset($parsed['summary']) && is_string($parsed['summary'])) {
                    $summary = $parsed['summary'];
                }
                $model = $result['model'];
            }
        } catch (\Throwable) {
            // extractivo ya en $summary
        }

        $maxSeq = $this->pdo->prepare('select coalesce(max(sequence_num),0) from story_beats where child_id = :id');
        $maxSeq->execute(['id' => $childId]);
        $upTo = (int) $maxSeq->fetchColumn();

        $this->pdo->prepare(
            'insert into story_summaries (child_id, kind, up_to_sequence, summary_text, model_used)
             values (:cid, \'condensed_full\', :up, :summary, :model)'
        )->execute([
            'cid' => $childId,
            'up' => $upTo,
            'summary' => $summary,
            'model' => $model,
        ]);

        return ['wrote' => true, 'summary' => $summary, 'up_to' => $upTo];
    }

    public function latestSummaryText(string $childId): ?string
    {
        $stmt = $this->pdo->prepare(
            "select summary_text from story_summaries
             where child_id = :id and kind = 'condensed_full'
             order by up_to_sequence desc, created_at desc limit 1"
        );
        $stmt->execute(['id' => $childId]);
        $val = $stmt->fetchColumn();

        return is_string($val) && $val !== '' ? $val : null;
    }
}
