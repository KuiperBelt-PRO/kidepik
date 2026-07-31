<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use PDO;

/**
 * Empaqueta memoria L2 (condensado) + L3 (ventana reciente) para prompts.
 *
 * @see SPEC_APP_JOURNEY_MEMORY.md §4
 */
final class JourneyContextPack
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @return array{
     *   journey_summary: ?string,
     *   recent_beats: list<array{sequence:int,text:string,kind:?string}>,
     *   recent_turns: list<array{sequence:int,role:string,text:string}>,
     *   truncated: bool
     * }
     */
    public function build(
        string $childId,
        int $maxRecentBeats = 6,
        int $maxRecentTurns = 8,
        int $maxChars = 4000,
    ): array {
        $summary = $this->latestSummary($childId);
        $beats = $this->recentBeats($childId, $maxRecentBeats);
        $turns = $this->recentTurns($childId, $maxRecentTurns);

        $truncated = false;
        $budget = $maxChars - mb_strlen((string) ($summary ?? ''));
        if ($budget < 200) {
            $budget = 200;
        }

        // Truncar primero turnos antiguos de L3, luego beats antiguos.
        while ($this->estimateChars($beats, $turns) > $budget && count($turns) > 1) {
            array_shift($turns);
            $truncated = true;
        }
        while ($this->estimateChars($beats, $turns) > $budget && count($beats) > 1) {
            array_shift($beats);
            $truncated = true;
        }

        return [
            'journey_summary' => $summary,
            'recent_beats' => $beats,
            'recent_turns' => $turns,
            'truncated' => $truncated,
        ];
    }

    /**
     * @param array{
     *   journey_summary: ?string,
     *   recent_beats: list<array{sequence:int,text:string,kind:?string}>,
     *   recent_turns: list<array{sequence:int,role:string,text:string}>,
     *   truncated?: bool
     * } $pack
     */
    public function toPromptBlock(array $pack): string
    {
        $parts = [];
        $summary = $pack['journey_summary'] ?? null;
        if (is_string($summary) && $summary !== '') {
            $parts[] = "JOURNEY_CONDENSED (L2):\n" . $summary;
        } else {
            $parts[] = 'JOURNEY_CONDENSED (L2): (sin resumen aún)';
        }

        $beatLines = [];
        foreach ($pack['recent_beats'] as $b) {
            $kind = $b['kind'] ?? '';
            $beatLines[] = '#' . $b['sequence'] . ($kind !== '' ? " [$kind]" : '') . ' ' . $b['text'];
        }
        $parts[] = "RECENT_BEATS (L3):\n" . ($beatLines !== [] ? implode("\n", $beatLines) : '(ninguno)');

        $turnLines = [];
        foreach ($pack['recent_turns'] as $t) {
            $turnLines[] = $t['role'] . ': ' . $t['text'];
        }
        $parts[] = "RECENT_TURNS (L3):\n" . ($turnLines !== [] ? implode("\n", $turnLines) : '(ninguno)');

        return implode("\n\n", $parts);
    }

    private function latestSummary(string $childId): ?string
    {
        $stmt = $this->pdo->prepare(
            "select summary_text from story_summaries
             where child_id = :id and kind = 'condensed_full'
             order by up_to_sequence desc, created_at desc
             limit 1"
        );
        $stmt->execute(['id' => $childId]);
        $val = $stmt->fetchColumn();

        return is_string($val) && $val !== '' ? $val : null;
    }

    /**
     * @return list<array{sequence:int,text:string,kind:?string}>
     */
    private function recentBeats(string $childId, int $limit): array
    {
        $stmt = $this->pdo->prepare(
            'select sequence_num, narrative_text, beat_kind
             from story_beats where child_id = :id
             order by sequence_num desc
             limit :lim'
        );
        $stmt->bindValue('id', $childId);
        $stmt->bindValue('lim', $limit, PDO::PARAM_INT);
        $stmt->execute();
        $rows = array_reverse($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
        $out = [];
        foreach ($rows as $row) {
            $out[] = [
                'sequence' => (int) $row['sequence_num'],
                'text' => (string) $row['narrative_text'],
                'kind' => isset($row['beat_kind']) ? (string) $row['beat_kind'] : null,
            ];
        }

        return $out;
    }

    /**
     * @return list<array{sequence:int,role:string,text:string}>
     */
    private function recentTurns(string $childId, int $limit): array
    {
        $stmt = $this->pdo->prepare(
            "select sequence, role, text from dialogue_turns
             where child_id = :id and role in ('mentor','agent','explorer')
             order by created_at desc
             limit :lim"
        );
        $stmt->bindValue('id', $childId);
        $stmt->bindValue('lim', $limit, PDO::PARAM_INT);
        $stmt->execute();
        $rows = array_reverse($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
        $out = [];
        foreach ($rows as $row) {
            $out[] = [
                'sequence' => (int) $row['sequence'],
                'role' => (string) $row['role'],
                'text' => (string) $row['text'],
            ];
        }

        return $out;
    }

    /**
     * @param list<array{sequence:int,text:string,kind:?string}> $beats
     * @param list<array{sequence:int,role:string,text:string}> $turns
     */
    private function estimateChars(array $beats, array $turns): int
    {
        $n = 0;
        foreach ($beats as $b) {
            $n += mb_strlen($b['text']);
        }
        foreach ($turns as $t) {
            $n += mb_strlen($t['text']);
        }

        return $n;
    }
}
