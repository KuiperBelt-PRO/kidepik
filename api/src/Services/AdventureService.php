<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use InvalidArgumentException;
use Kidepik\Shared\Ai\AiGateway;
use Kidepik\Shared\Ai\MentorCatalog;
use PDO;

/**
 * Sesión de aventura post-placement (vertical slice).
 */
final class AdventureService
{
    public function __construct(
        private readonly PDO $pdo,
        private readonly ?AiGateway $gateway = null,
    ) {
    }

    /**
     * @param array<string,mixed> $child
     * @return array{turns:list<array<string,mixed>>,effects:list<array<string,mixed>>}
     */
    public function chooseZone(
        string $childId,
        array $child,
        string $zoneId,
        string $sessionId,
        string $flowId,
        int $sequence,
        string $mentorId,
    ): array {
        $allowed = ['zone_math', 'zone_language', 'zone_logic', 'zone_science', 'zone_culture'];
        if (!in_array($zoneId, $allowed, true)) {
            throw new InvalidArgumentException('zone invalid');
        }

        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $title = match ($zoneId) {
            'zone_math' => $theme === 'sci-fi' ? 'Nebulosa Matemática' : 'Bosque de los Números',
            'zone_language' => $theme === 'sci-fi' ? 'Estación Léxico' : 'Montañas de la Gramática',
            'zone_logic' => $theme === 'sci-fi' ? 'Laberinto de Circuitos' : 'Laberinto de Espejos',
            'zone_science' => $theme === 'sci-fi' ? 'Cinturón de Observatorios' : 'Jardines Alquímicos',
            default => $theme === 'sci-fi' ? 'Archivo Galáctico' : 'Biblioteca de los Reinos',
        };

        $this->pdo->prepare(
            "update children set settings = jsonb_set(
                coalesce(settings, '{}'::jsonb),
                '{journey,active_zone_id}',
                to_jsonb(:zone::text),
                true
             ), updated_at = now() where id = :id"
        )->execute(['zone' => $zoneId, 'id' => $childId]);

        $this->pdo->prepare(
            "update narrative_quests set status = 'abandoned' where child_id = :cid and status = 'active'"
        )->execute(['cid' => $childId]);

        $q = $this->pdo->prepare(
            "insert into narrative_quests (child_id, zone_id, chapter_id, title_child, status, steps_total, steps_done, learning_gates)
             values (:cid, :zone, 'C1_first_zone', :title, 'active', 2, 0, :gates::jsonb)
             returning id"
        );
        $subject = str_replace('zone_', '', $zoneId);
        $q->execute([
            'cid' => $childId,
            'zone' => $zoneId,
            'title' => 'Introducción: ' . $title,
            'gates' => json_encode([['subject_id' => $subject, 'done' => false]], JSON_UNESCAPED_UNICODE),
        ]);
        $questId = (string) $q->fetchColumn();

        $seqBeat = $this->nextBeatSequence($childId);
        $narrative = sprintf(
            'Llegamos a %s. El Vacío / el desequilibrio ha dejado huecos de saber aquí. Recuperemos el primero.',
            $title
        );
        // Tone by world without mixing metaphors too hard:
        $narrative = $theme === 'sci-fi'
            ? sprintf('Aterrizamos en %s. El Vacío ha borrado señales. Recuperemos la primera.', $title)
            : sprintf('Entramos en %s. El equilibrio tiembla. Recuperemos el primer fragmento.', $title);

        $this->appendBeat($childId, $sessionId, $seqBeat, 'C1_first_zone', $zoneId, 'narration', $narrative, null, null);
        $this->pdo->prepare(
            'insert into journey_decisions (child_id, decision_key, option_id, label)
             values (:cid, \'choose_zone\', :opt, :label)'
        )->execute(['cid' => $childId, 'opt' => $zoneId, 'label' => $title]);

        $challenge = $this->simpleChallenge($theme, $subject);
        $this->appendBeat(
            $childId,
            $sessionId,
            $seqBeat + 1,
            'C1_first_zone',
            $zoneId,
            'challenge_intro',
            $challenge['prompt'],
            $challenge['options'],
            null
        );

        $profile = MentorCatalog::profile($mentorId);

        return [
            'turns' => [
                [
                    'text' => $narrative . ' ' . $profile['display_name'] . ' te señala el reto.',
                    'input_mode' => 'continue',
                    'options' => [['id' => 'continue', 'label' => 'Continuar']],
                    'meta' => ['phase' => 'adventure_arrive', 'zone_id' => $zoneId, 'quest_id' => $questId],
                ],
                [
                    'text' => $challenge['prompt'],
                    'input_mode' => $challenge['input_mode'],
                    'options' => $challenge['options'],
                    'meta' => [
                        'phase' => 'adventure_challenge',
                        'zone_id' => $zoneId,
                        'quest_id' => $questId,
                        'subject_id' => $subject,
                        'canonical_option' => $challenge['canonical_option'],
                    ],
                ],
            ],
            'effects' => [
                ['type' => 'update_journey', 'active_zone_id' => $zoneId],
                ['type' => 'update_quest', 'quest_id' => $questId, 'status' => 'active'],
                ['type' => 'append_story_beat', 'zone_id' => $zoneId],
            ],
        ];
    }

    /**
     * @param array{kind:string,option_id?:string,text?:string} $reply
     * @param array<string,mixed> $meta from last mentor turn
     * @param array<string,mixed> $child
     * @return array{turns:list<array<string,mixed>>,effects:list<array<string,mixed>>}
     */
    public function resolveChallenge(
        string $childId,
        array $child,
        array $reply,
        array $meta,
        string $sessionId,
        int $sequence,
        string $mentorId,
    ): array {
        $want = (string) ($meta['canonical_option'] ?? '');
        $got = (string) ($reply['option_id'] ?? '');
        $ok = $want !== '' && $want === $got;
        $zoneId = (string) ($meta['zone_id'] ?? 'zone_math');
        $questId = (string) ($meta['quest_id'] ?? '');

        $seqBeat = $this->nextBeatSequence($childId);
        $resultText = $ok
            ? '¡Fragmento recuperado! La zona respira con más claridad.'
            : 'El eco se resiste, pero aprendiste la senda. El mentor guarda el recuerdo.';

        $this->appendBeat(
            $childId,
            $sessionId,
            $seqBeat,
            'C1_first_zone',
            $zoneId,
            'challenge_result',
            $resultText,
            null,
            ['ok' => $ok, 'reply' => $reply]
        );

        if ($questId !== '') {
            $this->pdo->prepare(
                "update narrative_quests set steps_done = least(steps_total, steps_done + 1),
                 status = case when steps_done + 1 >= steps_total then 'completed' else status end,
                 updated_at = now()
                 where id = :id"
            )->execute(['id' => $questId]);
        }

        if ($ok) {
            $this->pdo->prepare(
                "update children set settings = jsonb_set(
                    coalesce(settings, '{}'::jsonb),
                    '{journey,fragments_restored}',
                    to_jsonb(coalesce((settings->'journey'->>'fragments_restored')::int, 0) + 1),
                    true
                 ), updated_at = now() where id = :id"
            )->execute(['id' => $childId]);
        }

        $this->maybeSummarize($childId, $mentorId);

        return [
            'turns' => [
                [
                    'text' => $resultText . ' Podemos seguir explorando en otra visita.',
                    'input_mode' => 'continue',
                    'options' => [['id' => 'continue', 'label' => 'Hasta pronto']],
                    'meta' => ['phase' => 'adventure_idle', 'zone_id' => $zoneId],
                ],
            ],
            'effects' => [
                ['type' => 'record_learning_result', 'ok' => $ok, 'zone_id' => $zoneId],
                ['type' => 'append_story_beat', 'beat_kind' => 'challenge_result'],
            ],
        ];
    }

    /** @return array{prompt:string,input_mode:string,options:list<array{id:string,label:string}>,canonical_option:string} */
    private function simpleChallenge(string $theme, string $subject): array
    {
        return match ($subject) {
            'language' => [
                'prompt' => 'Un letrero antiguo pide la palabra correcta: «El ____ brilla». ¿Cuál encaja?',
                'input_mode' => 'options_only',
                'options' => [
                    ['id' => 'a', 'label' => 'sol'],
                    ['id' => 'b', 'label' => 'correr'],
                    ['id' => 'c', 'label' => 'mesa'],
                ],
                'canonical_option' => 'a',
            ],
            'logic' => [
                'prompt' => 'Secuencia: 1, 2, 4, 8, … ¿Siguiente?',
                'input_mode' => 'options_only',
                'options' => [
                    ['id' => 'a', 'label' => '10'],
                    ['id' => 'b', 'label' => '16'],
                    ['id' => 'c', 'label' => '12'],
                ],
                'canonical_option' => 'b',
            ],
            default => [
                'prompt' => $theme === 'sci-fi'
                    ? 'La consola pide: 5 + 7 = ¿?'
                    : 'Las runas muestran: 5 + 7 = ¿?',
                'input_mode' => 'options_only',
                'options' => [
                    ['id' => 'a', 'label' => '11'],
                    ['id' => 'b', 'label' => '12'],
                    ['id' => 'c', 'label' => '13'],
                ],
                'canonical_option' => 'b',
            ],
        };
    }

    private function nextBeatSequence(string $childId): int
    {
        $stmt = $this->pdo->prepare('select coalesce(max(sequence_num), 0) from story_beats where child_id = :id');
        $stmt->execute(['id' => $childId]);

        return ((int) $stmt->fetchColumn()) + 1;
    }

    /** @param list<array{id:string,label:string}>|null $choices */
    private function appendBeat(
        string $childId,
        ?string $sessionId,
        int $sequence,
        string $chapterId,
        ?string $zoneId,
        string $kind,
        string $text,
        ?array $choices,
        mixed $choiceTaken,
    ): void {
        $this->pdo->prepare(
            'insert into story_beats (
                child_id, session_id, sequence_num, chapter_id, zone_id, beat_kind,
                narrative_text, choices_offered, choice_taken
             ) values (
                :cid, :sid, :seq, :chapter, :zone, :kind,
                :text, :choices::jsonb, :taken::jsonb
             )'
        )->execute([
            'cid' => $childId,
            'sid' => $sessionId,
            'seq' => $sequence,
            'chapter' => $chapterId,
            'zone' => $zoneId,
            'kind' => $kind,
            'text' => $text,
            'choices' => $choices !== null ? json_encode($choices, JSON_UNESCAPED_UNICODE) : null,
            'taken' => $choiceTaken !== null ? json_encode($choiceTaken, JSON_UNESCAPED_UNICODE) : null,
        ]);
    }

    private function maybeSummarize(string $childId, string $mentorId): void
    {
        unset($mentorId);
        $memory = new JourneyMemoryService($this->pdo, $this->gateway);
        $memory->maybeCondense($childId, 3);
    }
}
