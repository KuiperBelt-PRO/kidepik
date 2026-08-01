<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use Kidepik\Shared\Ai\MentorCatalog;
use PDO;

/**
 * Timeline L1 unificado para lectura tutor (SPEC_APP_JOURNEY_MEMORY §1.2 / §1.4 / §6).
 */
final class JourneyTimelineService
{
    /** @var array<string, int> kind → rank (menor = más temprano en causalidad) */
    private const KIND_RANK = [
        'decision' => 10,
        'quest' => 20,
        'system' => 30,
        'challenge' => 40,
        'mentor_utterance' => 50,
        'explorer_reply' => 60,
        'level' => 70,
        'rank' => 70,
    ];

    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @return array{
     *   events: list<array<string, mixed>>,
     *   next_cursor: ?string,
     *   summary: ?string,
     *   explorer_label: string,
     *   mentor_label: string
     * }
     */
    public function page(string $childId, ?string $cursor = null, int $limit = 30): array
    {
        $limit = max(1, min(100, $limit));
        $labels = $this->labelsForChild($childId);
        $events = $this->collectEvents($childId);
        $events = $this->dedupeEchoes($events);
        usort($events, [$this, 'compareNewestFirst']);

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
     * @param array<string, mixed> $a
     * @param array<string, mixed> $b
     */
    private function compareNewestFirst(array $a, array $b): int
    {
        $atCmp = strcmp((string) $b['at'], (string) $a['at']);
        if ($atCmp !== 0) {
            return $atCmp;
        }
        $seqA = (int) ($a['seq'] ?? 0);
        $seqB = (int) ($b['seq'] ?? 0);
        if ($seqA !== $seqB) {
            return $seqB <=> $seqA;
        }
        $rankA = (int) ($a['kind_rank'] ?? 80);
        $rankB = (int) ($b['kind_rank'] ?? 80);
        if ($rankA !== $rankB) {
            return $rankB <=> $rankA;
        }

        return strcmp((string) $b['id'], (string) $a['id']);
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
     * @return list<array<string, mixed>>
     */
    private function collectEvents(string $childId): array
    {
        $out = [];

        $turns = $this->pdo->prepare(
            "select id, role, text, created_at, sequence from dialogue_turns
             where child_id = :id and role in ('mentor','agent','explorer')
             order by created_at asc"
        );
        try {
            $turns->execute(['id' => $childId]);
        } catch (\Throwable) {
            $turns = $this->pdo->prepare(
                "select id, role, text, created_at from dialogue_turns
                 where child_id = :id and role in ('mentor','agent','explorer')
                 order by created_at asc"
            );
            $turns->execute(['id' => $childId]);
        }
        foreach ($turns->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $role = (string) $row['role'];
            $kind = in_array($role, ['mentor', 'agent'], true) ? 'mentor_utterance' : 'explorer_reply';
            $seq = isset($row['sequence']) ? (int) $row['sequence'] : 0;
            $out[] = $this->event(
                'turn:' . $row['id'],
                $childId,
                (string) $row['created_at'],
                $kind,
                'dialogue_turns',
                (string) $row['id'],
                $this->oneLine((string) $row['text']),
                $seq,
                'primary',
            );
        }

        $dec = $this->pdo->prepare(
            'select id, decision_key, option_id, label, created_at from journey_decisions
             where child_id = :id order by created_at asc'
        );
        $dec->execute(['id' => $childId]);
        foreach ($dec->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $label = (string) ($row['label'] ?? $row['option_id'] ?? $row['decision_key']);
            $out[] = $this->event(
                'decision:' . $row['id'],
                $childId,
                (string) $row['created_at'],
                'decision',
                'journey_decisions',
                (string) $row['id'],
                'Decisión (' . (string) $row['decision_key'] . '): ' . $this->oneLine($label),
                0,
                'primary',
            );
        }

        $beats = $this->pdo->prepare(
            'select id, beat_kind, narrative_text, created_at, sequence_num from story_beats
             where child_id = :id order by sequence_num asc'
        );
        $beats->execute(['id' => $childId]);
        foreach ($beats->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $kindBeat = (string) ($row['beat_kind'] ?? 'narration');
            $eventKind = str_contains($kindBeat, 'challenge') ? 'challenge' : 'system';
            $labelBeat = match ($kindBeat) {
                'challenge_intro' => 'Reto',
                'challenge_result' => 'Resultado del reto',
                'choice' => 'Encrucijada',
                'quest_update' => 'Misión',
                'ceremony' => 'Ceremonia',
                'narration' => 'Narración',
                default => 'Historia',
            };
            $out[] = $this->event(
                'beat:' . $row['id'],
                $childId,
                (string) $row['created_at'],
                $eventKind,
                'story_beats',
                (string) $row['id'],
                $labelBeat . ': ' . $this->oneLine((string) $row['narrative_text']),
                (int) ($row['sequence_num'] ?? 0),
                'primary',
            );
        }

        $quests = $this->pdo->prepare(
            'select id, title_child, status, zone_id, created_at, updated_at from narrative_quests
             where child_id = :id order by created_at asc'
        );
        $quests->execute(['id' => $childId]);
        foreach ($quests->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $out[] = $this->event(
                'quest:' . $row['id'],
                $childId,
                (string) ($row['updated_at'] ?? $row['created_at']),
                'quest',
                'narrative_quests',
                (string) $row['id'],
                'Misión (' . (string) $row['status'] . '): ' . $this->oneLine((string) $row['title_child']),
                0,
                'primary',
            );
        }

        return $out;
    }

    /**
     * @param list<array<string, mixed>> $events
     * @return list<array<string, mixed>>
     */
    private function dedupeEchoes(array $events): array
    {
        $beatTexts = [];
        foreach ($events as $ev) {
            if (($ev['ref_table'] ?? '') === 'story_beats') {
                $beatTexts[] = $this->normalizeText((string) ($ev['summary'] ?? ''));
            }
        }
        if ($beatTexts === []) {
            return $events;
        }

        $out = [];
        foreach ($events as $ev) {
            if (($ev['kind'] ?? '') === 'mentor_utterance') {
                $norm = $this->normalizeText((string) ($ev['summary'] ?? ''));
                foreach ($beatTexts as $beatNorm) {
                    if ($norm !== '' && ($norm === $beatNorm || str_contains($beatNorm, $norm) || str_contains($norm, $beatNorm))) {
                        $ev['source'] = 'echo';
                        break;
                    }
                }
                if (($ev['source'] ?? '') === 'echo') {
                    continue;
                }
            }
            $out[] = $ev;
        }

        return $out;
    }

    /**
     * @return array<string, mixed>
     */
    private function event(
        string $id,
        string $childId,
        string $atRaw,
        string $kind,
        string $refTable,
        string $refId,
        string $summary,
        int $seq,
        string $source,
    ): array {
        $at = $this->iso($atRaw);
        $kindRank = self::KIND_RANK[$kind] ?? 80;

        return [
            'id' => $id,
            'member_id' => $childId,
            'at' => $at,
            'sort_key' => $at . '|' . sprintf('%06d', $seq) . '|' . sprintf('%03d', $kindRank) . '|' . $id,
            'seq' => $seq,
            'kind_rank' => $kindRank,
            'kind' => $kind,
            'ref_table' => $refTable,
            'ref_id' => $refId,
            'summary' => $summary,
            'source' => $source,
        ];
    }

    private function oneLine(string $text): string
    {
        $t = preg_replace('/\s+/u', ' ', trim($text)) ?? trim($text);

        return mb_substr($t, 0, 160);
    }

    private function normalizeText(string $text): string
    {
        $t = mb_strtolower($this->oneLine($text));
        $t = preg_replace('/^(narración|reto|resultado del reto|encrucijada|misión|ceremonia|historia):\s*/u', '', $t) ?? $t;

        return $t;
    }

    private function iso(string $at): string
    {
        try {
            $dt = new \DateTimeImmutable($at);

            return $dt->format('Y-m-d\TH:i:s.vP');
        } catch (\Throwable) {
            return $at;
        }
    }
}
