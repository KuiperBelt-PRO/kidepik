<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use Kidepik\Shared\Ai\MentorCatalog;
use PDO;

/**
 * Timeline L1 unificado para lectura tutor (SPEC_APP_JOURNEY_MEMORY §1.2 / §6).
 */
final class JourneyTimelineService
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @return array{
     *   events: list<array{id:string,member_id:string,at:string,kind:string,ref_table:string,ref_id:string,summary:string}>,
     *   next_cursor: ?string,
     *   summary: ?string
     * }
     */
    public function page(string $childId, ?string $cursor = null, int $limit = 30): array
    {
        $limit = max(1, min(100, $limit));
        $labels = $this->labelsForChild($childId);
        $events = $this->collectEvents($childId);
        usort($events, static fn (array $a, array $b): int => strcmp($b['at'], $a['at']));

        $offset = 0;
        if ($cursor !== null && $cursor !== '') {
            $decoded = base64_decode($cursor, true);
            if (is_string($decoded) && ctype_digit($decoded)) {
                $offset = (int) $decoded;
            }
        }

        $slice = array_slice($events, $offset, $limit);
        $nextOffset = $offset + count($slice);
        $nextCursor = $nextOffset < count($events) ? base64_encode((string) $nextOffset) : null;

        return [
            'events' => $slice,
            'next_cursor' => $nextCursor,
            'summary' => (new JourneyMemoryService($this->pdo))->latestSummaryText($childId),
            'explorer_label' => $labels['explorer'],
            'mentor_label' => $labels['mentor'],
        ];
    }

    /**
     * @return array{explorer:string,mentor:string}
     */
    private function labelsForChild(string $childId): array
    {
        $explorer = 'Explorador';
        $mentor = 'Mentor';
        try {
            $stmt = $this->pdo->prepare(
                'select display_name, world_theme, mentor_id from children where id = :id limit 1'
            );
            $stmt->execute(['id' => $childId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (is_array($row)) {
                if (is_string($row['display_name'] ?? null) && trim($row['display_name']) !== '') {
                    $explorer = trim($row['display_name']);
                }
                $mentorId = is_string($row['mentor_id'] ?? null) && $row['mentor_id'] !== ''
                    ? (string) $row['mentor_id']
                    : MentorCatalog::idForWorldTheme($row['world_theme'] ?? null);
                $mentor = (string) (MentorCatalog::profile($mentorId)['display_name'] ?? $mentor);
            }
        } catch (\Throwable) {
            /* tabla children opcional en tests sqlite */
        }

        return ['explorer' => $explorer, 'mentor' => $mentor];
    }

    /**
     * @return list<array{id:string,member_id:string,at:string,kind:string,ref_table:string,ref_id:string,summary:string}>
     */
    private function collectEvents(string $childId): array
    {
        $out = [];

        $turns = $this->pdo->prepare(
            "select id, role, text, created_at from dialogue_turns
             where child_id = :id and role in ('mentor','agent','explorer')
             order by created_at asc"
        );
        $turns->execute(['id' => $childId]);
        foreach ($turns->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $role = (string) $row['role'];
            $kind = in_array($role, ['mentor', 'agent'], true) ? 'mentor_utterance' : 'explorer_reply';
            $out[] = [
                'id' => 'turn:' . $row['id'],
                'member_id' => $childId,
                'at' => $this->iso((string) $row['created_at']),
                'kind' => $kind,
                'ref_table' => 'dialogue_turns',
                'ref_id' => (string) $row['id'],
                'summary' => $this->oneLine((string) $row['text']),
            ];
        }

        $dec = $this->pdo->prepare(
            'select id, decision_key, option_id, label, created_at from journey_decisions
             where child_id = :id order by created_at asc'
        );
        $dec->execute(['id' => $childId]);
        foreach ($dec->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $label = (string) ($row['label'] ?? $row['option_id'] ?? $row['decision_key']);
            $out[] = [
                'id' => 'decision:' . $row['id'],
                'member_id' => $childId,
                'at' => $this->iso((string) $row['created_at']),
                'kind' => 'decision',
                'ref_table' => 'journey_decisions',
                'ref_id' => (string) $row['id'],
                'summary' => 'Decisión (' . (string) $row['decision_key'] . '): ' . $this->oneLine($label),
            ];
        }

        $beats = $this->pdo->prepare(
            'select id, beat_kind, narrative_text, created_at from story_beats
             where child_id = :id order by sequence_num asc'
        );
        $beats->execute(['id' => $childId]);
        foreach ($beats->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $kindBeat = (string) ($row['beat_kind'] ?? 'narration');
            $eventKind = str_contains($kindBeat, 'challenge') ? 'challenge' : 'system';
            $out[] = [
                'id' => 'beat:' . $row['id'],
                'member_id' => $childId,
                'at' => $this->iso((string) $row['created_at']),
                'kind' => $eventKind,
                'ref_table' => 'story_beats',
                'ref_id' => (string) $row['id'],
                'summary' => '[' . $kindBeat . '] ' . $this->oneLine((string) $row['narrative_text']),
            ];
        }

        $quests = $this->pdo->prepare(
            'select id, title_child, status, zone_id, created_at, updated_at from narrative_quests
             where child_id = :id order by created_at asc'
        );
        $quests->execute(['id' => $childId]);
        foreach ($quests->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $out[] = [
                'id' => 'quest:' . $row['id'],
                'member_id' => $childId,
                'at' => $this->iso((string) ($row['updated_at'] ?? $row['created_at'])),
                'kind' => 'quest',
                'ref_table' => 'narrative_quests',
                'ref_id' => (string) $row['id'],
                'summary' => 'Misión (' . (string) $row['status'] . '): ' . $this->oneLine((string) $row['title_child']),
            ];
        }

        return $out;
    }

    private function oneLine(string $text): string
    {
        $t = preg_replace('/\s+/u', ' ', trim($text)) ?? trim($text);

        return mb_substr($t, 0, 160);
    }

    private function iso(string $at): string
    {
        try {
            return (new \DateTimeImmutable($at))->format(\DateTimeInterface::ATOM);
        } catch (\Throwable) {
            return $at;
        }
    }
}
