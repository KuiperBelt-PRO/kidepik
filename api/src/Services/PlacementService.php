<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use InvalidArgumentException;
use Kidepik\Shared\Ai\MentorCatalog;
use Kidepik\Shared\Ai\PlacementBank;
use Kidepik\Shared\Ai\PlacementItemWriter;
use PDO;

/**
 * Examen de acceso narrativo (placement).
 */
final class PlacementService
{
    public function __construct(
        private readonly PDO $pdo,
        private readonly PlacementBank $bank,
    ) {
    }

    public static function withDefaultBank(PDO $pdo): self
    {
        return new self($pdo, PlacementBank::fromDefaultFile());
    }

    /**
     * @param array<string,mixed> $child
     * @return array{exam_id:string,turn:array<string,mixed>,effects:list<array<string,mixed>>}
     */
    public function startExam(
        string $childId,
        array $child,
        string $sessionId,
        string $flowId,
        int $sequence,
        string $mentorId,
    ): array {
        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $band = \Kidepik\Shared\Ai\AgeBand::fromLegacy(
            $child['age_band'] ?? null,
            isset($child['age_years']) ? (int) $child['age_years'] : null
        ) ?? \Kidepik\Shared\Ai\AgeBand::CHILD;

        $this->pdo->prepare(
            "update placement_exams set status = 'abandoned' where child_id = :cid and status = 'in_progress'"
        )->execute(['cid' => $childId]);

        $queue = $this->bank->pickQueue($band);
        if ($queue === []) {
            throw new InvalidArgumentException('placement bank empty');
        }

        $ins = $this->pdo->prepare(
            "insert into placement_exams (child_id, world_theme, status, item_queue, current_index)
             values (:cid, :theme, 'in_progress', :queue::jsonb, 0)
             returning id"
        );
        $ins->execute([
            'cid' => $childId,
            'theme' => $theme,
            'queue' => json_encode($queue, JSON_UNESCAPED_UNICODE),
        ]);
        $examId = (string) $ins->fetchColumn();

        $this->pdo->prepare(
            "update children set placement_status = 'in_progress', onboarding_step = 'placement', updated_at = now() where id = :id"
        )->execute(['id' => $childId]);

        $first = (new PlacementItemWriter())->rewrite($queue[0], $child);
        $turn = $this->itemToTurn($sessionId, $childId, $flowId, $sequence, $mentorId, $theme, $first, 0, count($queue));

        return [
            'exam_id' => $examId,
            'turn' => $turn,
            'effects' => [
                ['type' => 'advance_onboarding', 'to' => 'placement'],
            ],
        ];
    }

    /**
     * @param array{kind:string,option_id?:string,text?:string} $reply
     * @param array<string,mixed> $child
     * @return array<string,mixed>
     */
    public function answer(
        string $childId,
        array $child,
        string $sessionId,
        string $flowId,
        int $sequence,
        string $mentorId,
        array $reply,
    ): array {
        $exam = $this->openExam($childId);
        $queue = $exam['queue'];
        $index = $exam['current_index'];
        if ($index >= count($queue)) {
            throw new InvalidArgumentException('placement already finished');
        }

        $item = $queue[$index];
        $score = $this->bank->score($item, $reply);

        $this->pdo->prepare(
            'insert into placement_answers (exam_id, subject_id, item_key, item_type, prompt_text, response, score)
             values (:exam, :subject, :ikey, :itype, :prompt, :response::jsonb, :score)'
        )->execute([
            'exam' => $exam['id'],
            'subject' => (string) $item['subject_id'],
            'ikey' => (string) $item['item_key'],
            'itype' => (string) $item['item_type'],
            'prompt' => (string) $item['prompt_text'],
            'response' => json_encode($reply, JSON_UNESCAPED_UNICODE),
            'score' => $score,
        ]);

        $index++;
        $this->pdo->prepare('update placement_exams set current_index = :i where id = :id')
            ->execute(['i' => $index, 'id' => $exam['id']]);

        $effects = [
            [
                'type' => 'record_answer',
                'subject_id' => $item['subject_id'],
                'item_key' => $item['item_key'],
                'score' => $score,
            ],
        ];

        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $feedback = $score >= 1.0
            ? 'Bien visto. El saber vuelve a brillar un poco más.'
            : ($score >= 0.5
                ? 'Casi. Sigamos: cada intento enseña el camino.'
                : 'No pasa nada. Anoto y seguimos.');

        if ($index >= count($queue)) {
            $complete = $this->finalize($childId, $child, $exam['id'], $mentorId, $theme);

            return [
                'complete' => true,
                'feedback' => $feedback,
                'closing_turns' => $complete['turns'],
                'effects' => array_merge($effects, $complete['effects']),
            ];
        }

        return [
            'complete' => false,
            'feedback' => $feedback,
            'next_item' => (new PlacementItemWriter())->rewrite($queue[$index], $child),
            'index' => $index,
            'total' => count($queue),
            'theme' => $theme,
            'effects' => $effects,
        ];
    }

    /**
     * @param array<string,mixed> $child
     * @return array{turns:list<array<string,mixed>>,effects:list<array<string,mixed>>}
     */
    private function finalize(
        string $childId,
        array $child,
        string $examId,
        string $mentorId,
        string $theme,
    ): array {
        $stmt = $this->pdo->prepare('select subject_id, score from placement_answers where exam_id = :id');
        $stmt->execute(['id' => $examId]);
        $bySubject = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $sid = (string) $row['subject_id'];
            $bySubject[$sid][] = (float) $row['score'];
        }

        $levels = $this->bank->computeLevels($bySubject);
        $ageBand = \Kidepik\Shared\Ai\AgeBand::fromLegacy(
            $child['age_band'] ?? null,
            isset($child['age_years']) ? (int) $child['age_years'] : null
        ) ?? \Kidepik\Shared\Ai\AgeBand::CHILD;
        $effective = $this->bank->promoteBand($ageBand, $levels['general'], $levels['subjects']);
        $rank = $this->bank->rankForGeneral($theme, $levels['general']);

        foreach ($levels['subjects'] as $subject => $levelId) {
            $this->pdo->prepare(
                'insert into user_subject_levels (child_id, subject_id, level_id, source, updated_at)
                 values (:cid, :sid, :lid, \'placement\', now())
                 on conflict (child_id, subject_id) do update set
                   level_id = excluded.level_id, source = excluded.source, updated_at = now()'
            )->execute(['cid' => $childId, 'sid' => $subject, 'lid' => $levelId]);
        }

        $raw = json_encode([
            'by_subject' => $bySubject,
            'levels' => $levels,
        ], JSON_UNESCAPED_UNICODE);

        $this->pdo->prepare(
            "update placement_exams set status = 'completed', general_level = :g, raw_scores = :raw::jsonb, completed_at = now()
             where id = :id"
        )->execute(['g' => $levels['general'], 'raw' => $raw, 'id' => $examId]);

        $this->pdo->prepare(
            "update children set
                placement_status = 'completed',
                onboarding_step = 'complete',
                general_level = :g,
                effective_age_band = :eb,
                rank_id = :rid,
                rank_track = :rt,
                settings = jsonb_set(
                  coalesce(settings, '{}'::jsonb),
                  '{journey}',
                  coalesce(settings->'journey', '{}'::jsonb) || :journey::jsonb,
                  true
                ),
                updated_at = now()
             where id = :id"
        )->execute([
            'g' => $levels['general'],
            'eb' => $effective,
            'rid' => $rank['id'],
            'rt' => $theme === 'sci-fi' ? 'sci-fi' : 'fantasy',
            'journey' => json_encode([
                'chapter_id' => 'C1_first_zone',
                'active_zone_id' => null,
                'antagonist_pressure' => 0.1,
                'fragments_restored' => 0,
                'adventure_unlocked' => true,
            ], JSON_UNESCAPED_UNICODE),
            'id' => $childId,
        ]);

        $profile = MentorCatalog::profile($mentorId);
        $closing = sprintf(
            'Has sido admitido. Tu rango: %s. Yo, %s, te guiaré. ¿Hacia qué territorio de saber viajamos primero?',
            $rank['label_child'],
            $profile['display_name']
        );

        $zoneOptions = [
            ['id' => 'zone_math', 'label' => $theme === 'sci-fi' ? 'Nebulosa Matemática' : 'Bosque de los Números'],
            ['id' => 'zone_language', 'label' => $theme === 'sci-fi' ? 'Estación Léxico' : 'Montañas de la Gramática'],
            ['id' => 'zone_logic', 'label' => $theme === 'sci-fi' ? 'Laberinto de Circuitos' : 'Laberinto de Espejos'],
        ];

        return [
            'turns' => [
                [
                    'text' => $closing,
                    'input_mode' => 'options_only',
                    'options' => $zoneOptions,
                    'meta' => ['phase' => 'choose_zone', 'rank' => $rank],
                ],
            ],
            'effects' => [
                ['type' => 'set_general_level', 'value' => $levels['general']],
                ['type' => 'set_effective_age_band', 'value' => $effective],
                ['type' => 'grant_rank', 'value' => $rank],
                ['type' => 'advance_onboarding', 'to' => 'complete'],
            ],
        ];
    }

    /**
     * @return array{id:string,current_index:int,queue:list<array<string,mixed>>}
     */
    private function openExam(string $childId): array
    {
        $stmt = $this->pdo->prepare(
            "select id, current_index, item_queue from placement_exams
             where child_id = :cid and status = 'in_progress' order by started_at desc limit 1"
        );
        $stmt->execute(['cid' => $childId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row === false) {
            throw new InvalidArgumentException('no placement exam in progress');
        }
        $queue = $row['item_queue'];
        if (is_string($queue)) {
            $queue = json_decode($queue, true);
        }
        if (!is_array($queue)) {
            $queue = [];
        }

        return [
            'id' => (string) $row['id'],
            'current_index' => (int) $row['current_index'],
            'queue' => $queue,
        ];
    }

    /**
     * @param array<string,mixed> $item
     * @return array<string,mixed>
     */
    public function itemToTurn(
        string $sessionId,
        string $childId,
        string $flowId,
        int $sequence,
        string $mentorId,
        string $theme,
        array $item,
        int $index,
        int $total,
    ): array {
        $wrapper = $theme === 'sci-fi'
            ? sprintf('Prueba %d de %d en la Academia. ', $index + 1, $total)
            : sprintf('Prueba %d de %d en la Escuela. ', $index + 1, $total);

        $type = (string) ($item['item_type'] ?? 'mcq');
        $inputMode = match ($type) {
            'mcq' => 'options_only',
            'short_text', 'numeric' => 'text_only',
            default => 'options_or_text',
        };

        return [
            'session_id' => $sessionId,
            'child_id' => $childId,
            'flow_id' => $flowId,
            'sequence' => $sequence,
            'role' => 'mentor',
            'text' => $wrapper . (string) ($item['prompt_text'] ?? ''),
            'input_mode' => $inputMode,
            'options' => $item['options'] ?? null,
            'explorer_reply' => null,
            'meta' => [
                'phase' => 'placement_item',
                'subject_id' => $item['subject_id'] ?? null,
                'item_key' => $item['item_key'] ?? null,
                'mentor_id' => $mentorId,
            ],
            'model_used' => null,
        ];
    }
}
