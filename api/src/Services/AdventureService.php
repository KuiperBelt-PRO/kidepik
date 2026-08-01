<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use InvalidArgumentException;
use Kidepik\Shared\Ai\AiGateway;
use Kidepik\Shared\Ai\MentorCatalog;
use Kidepik\Shared\Ai\ZoneNarrativeCatalog;
use PDO;

/**
 * Sesión de aventura post-placement (SPEC_APP_ADVENTURE_STORY_RICHNESS).
 */
final class AdventureService
{
    public const ZONE_INTRO_GATES = 3;

    /** @var list<string> */
    public const ZONE_IDS = ['zone_math', 'zone_language', 'zone_logic', 'zone_science', 'zone_culture'];

    public function __construct(
        private readonly PDO $pdo,
        private readonly ?AiGateway $gateway = null,
    ) {
    }

    /**
     * @param array<string, string> $subjectLevels map subject_id → L1..L5
     * @return list<array{id:string,label:string,description:string,why_for_you:string}>
     */
    /**
     * @param list<string> $excludeZoneIds
     */
    public static function zonePitches(string $theme, array $subjectLevels, int $limit = 3, array $excludeZoneIds = []): array
    {
        $catalog = [
            'zone_math' => [
                'subject' => 'math',
                'label' => $theme === 'sci-fi' ? 'Nebulosa Matemática' : 'Bosque de los Números',
                'description' => $theme === 'sci-fi'
                    ? 'Un cúmulo de señales numéricas parpadea a medio apagar: hay que restaurar cálculos para que las naves no se pierdan.'
                    : 'Entre árboles de runas, el conteo se ha vuelto niebla: el bosque pide recuperar fragmentos de número.',
            ],
            'zone_language' => [
                'subject' => 'language',
                'label' => $theme === 'sci-fi' ? 'Estación Léxico' : 'Montañas de la Gramática',
                'description' => $theme === 'sci-fi'
                    ? 'La estación traduce mundos, pero el Vacío ha borrado palabras clave del diccionario orbital.'
                    : 'En las cumbres, los ecos de las palabras se rompen: hay que recomponer relatos y nombres.',
            ],
            'zone_logic' => [
                'subject' => 'logic',
                'label' => $theme === 'sci-fi' ? 'Laberinto de Circuitos' : 'Laberinto de Espejos',
                'description' => $theme === 'sci-fi'
                    ? 'Puertas lógicas se abren solo con patrones correctos; el Vacío ha mezclado las secuencias.'
                    : 'Los espejos reflejan caminos falsos: solo la lógica clara revela la salida.',
            ],
            'zone_science' => [
                'subject' => 'science',
                'label' => $theme === 'sci-fi' ? 'Cinturón de Observatorios' : 'Jardines Alquímicos',
                'description' => $theme === 'sci-fi'
                    ? 'Telescopios mudos: hace falta observar y explicar para devolver la luz a los datos.'
                    : 'Las plantas del saber han perdido color: la curiosidad científica puede despertarlas.',
            ],
            'zone_culture' => [
                'subject' => 'culture',
                'label' => $theme === 'sci-fi' ? 'Archivo Galáctico' : 'Biblioteca de los Reinos',
                'description' => $theme === 'sci-fi'
                    ? 'Crónicas de civilizaciones parpadean incompletas en el archivo.'
                    : 'Los tomos antiguos han perdido páginas: la memoria de los reinos pide cuidadores.',
            ],
        ];

        $scored = [];
        foreach ($catalog as $zoneId => $meta) {
            if (in_array($zoneId, $excludeZoneIds, true)) {
                continue;
            }
            $sid = $meta['subject'];
            $level = $subjectLevels[$sid] ?? 'L3';
            $rank = self::levelRank($level);
            $scored[] = [
                'id' => $zoneId,
                'label' => $meta['label'],
                'description' => $meta['description'],
                '_subject' => $sid,
                '_weakness' => $rank,
            ];
        }
        usort($scored, static fn (array $a, array $b): int => $a['_weakness'] <=> $b['_weakness']);
        $picked = array_slice($scored, 0, max(2, min(3, $limit)));
        $minWeak = min(array_column($picked, '_weakness'));
        $pickCount = count($picked);

        foreach ($picked as $index => &$zone) {
            $zone['why_for_you'] = self::whyForYou(
                $theme,
                (string) $zone['_subject'],
                (int) $zone['_weakness'],
                $index,
                $minWeak,
                $pickCount,
            );
            unset($zone['_subject'], $zone['_weakness']);
        }
        unset($zone);

        return $picked;
    }

    /**
     * Prosa breve del mentor al presentar destinos (sin repetir description/why de las cartas).
     *
     * @param list<array{label:string}> $pitches
     */
    public static function zonePitchMapText(array $pitches): string
    {
        $labels = array_map(static fn (array $z): string => (string) $z['label'], $pitches);
        $count = count($labels);
        if ($count === 0) {
            return 'Hay caminos abiertos. Elige el destino en las cartas.';
        }
        $list = self::spanishList($labels);
        if ($count === 1) {
            return "Un camino se abre ante ti: {$list}. Mira la carta y dime si vamos.";
        }

        return "Hay {$count} caminos abiertos: {$list}. "
            . 'En cada carta verás qué ocurre allí y por qué conviene ir ahora. Elige tu primer destino.';
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
        unset($flowId, $sequence);
        if (!in_array($zoneId, self::ZONE_IDS, true)) {
            throw new InvalidArgumentException('zone invalid');
        }

        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $title = self::zoneTitle($theme, $zoneId);
        $subject = str_replace('zone_', '', $zoneId);
        $levelId = $this->subjectLevel($childId, $subject);

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

        $gates = [];
        for ($i = 0; $i < self::ZONE_INTRO_GATES; $i++) {
            $gates[] = ['subject_id' => $subject, 'done' => false, 'gate_index' => $i];
        }
        $q = $this->pdo->prepare(
            "insert into narrative_quests (child_id, zone_id, chapter_id, title_child, status, steps_total, steps_done, learning_gates)
             values (:cid, :zone, 'C1_first_zone', :title, 'active', :steps, 0, :gates::jsonb)
             returning id"
        );
        $q->execute([
            'cid' => $childId,
            'zone' => $zoneId,
            'title' => 'Introducción: ' . $title,
            'steps' => self::ZONE_INTRO_GATES,
            'gates' => json_encode($gates, JSON_UNESCAPED_UNICODE),
        ]);
        $questId = (string) $q->fetchColumn();

        $displayName = (string) ($child['display_name'] ?? 'explorador');
        $arrival = ZoneNarrativeCatalog::arrivalText($theme, $zoneId, $displayName);
        $this->appendBeat($childId, $sessionId, $this->nextBeatSequence($childId), 'C1_first_zone', $zoneId, 'narration', $arrival, null, null);

        $this->pdo->prepare(
            'insert into journey_decisions (child_id, decision_key, option_id, label)
             values (:cid, \'choose_zone\', :opt, :label)'
        )->execute(['cid' => $childId, 'opt' => $zoneId, 'label' => $title]);

        return [
            'turns' => [
                [
                    'text' => $arrival,
                    'input_mode' => 'continue',
                    'options' => [['id' => 'continue', 'label' => 'Afrontar el obstáculo']],
                    'meta' => [
                        'phase' => 'zone_arrive',
                        'zone_id' => $zoneId,
                        'quest_id' => $questId,
                        'gate_index' => 0,
                        'subject_id' => $subject,
                        'level_id' => $levelId,
                        'npc_ids' => ['zone_guardian'],
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
     * Tras los continues de llegada o entre retos: emitir el siguiente challenge.
     *
     * @param array<string,mixed> $child
     * @param array<string,mixed> $meta
     * @return array{turns:list<array<string,mixed>>,effects:list<array<string,mixed>>}
     */
    public function presentChallenge(
        string $childId,
        array $child,
        array $meta,
        string $sessionId,
        string $mentorId,
    ): array {
        unset($mentorId);
        $zoneId = (string) ($meta['zone_id'] ?? 'zone_math');
        $questId = (string) ($meta['quest_id'] ?? '');
        $subject = (string) ($meta['subject_id'] ?? str_replace('zone_', '', $zoneId));
        $gateIndex = (int) ($meta['gate_index'] ?? 0);
        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $levelId = (string) ($meta['level_id'] ?? $this->subjectLevel($childId, $subject));

        $challenge = $this->challengeFor($theme, $subject, $levelId, $gateIndex);
        $seqBeat = $this->nextBeatSequence($childId);
        $framed = ZoneNarrativeCatalog::challengeIntroText(
            $theme,
            $zoneId,
            $gateIndex,
            self::ZONE_INTRO_GATES,
            $challenge['prompt'],
        );
        $this->appendBeat(
            $childId,
            $sessionId,
            $seqBeat,
            'C1_first_zone',
            $zoneId,
            'challenge_intro',
            $framed,
            $challenge['options'],
            null
        );

        return [
            'turns' => [
                [
                    'text' => $framed,
                    'input_mode' => $challenge['input_mode'],
                    'options' => $challenge['options'],
                    'meta' => [
                        'phase' => 'adventure_challenge',
                        'zone_id' => $zoneId,
                        'quest_id' => $questId,
                        'subject_id' => $subject,
                        'level_id' => $levelId,
                        'gate_index' => $gateIndex,
                        'canonical_option' => $challenge['canonical_option'],
                        'npc_ids' => ['zone_guardian'],
                    ],
                ],
            ],
            'effects' => [
                ['type' => 'append_story_beat', 'beat_kind' => 'challenge_intro'],
            ],
        ];
    }

    /**
     * @param array{kind:string,option_id?:string,text?:string} $reply
     * @param array<string,mixed> $meta
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
        unset($sequence);
        $want = (string) ($meta['canonical_option'] ?? '');
        $got = (string) ($reply['option_id'] ?? '');
        $textGot = trim((string) ($reply['text'] ?? ''));
        $ok = ($want !== '' && $want === $got)
            || ($want !== '' && $textGot !== '' && mb_strtolower($textGot) === mb_strtolower($want));
        $zoneId = (string) ($meta['zone_id'] ?? 'zone_math');
        $questId = (string) ($meta['quest_id'] ?? '');
        $subject = (string) ($meta['subject_id'] ?? 'math');
        $gateIndex = (int) ($meta['gate_index'] ?? 0);
        $levelId = (string) ($meta['level_id'] ?? $this->subjectLevel($childId, $subject));
        $theme = (string) ($child['world_theme'] ?? 'fantasy');

        $seqBeat = $this->nextBeatSequence($childId);
        $resultText = $ok
            ? ZoneNarrativeCatalog::challengeSuccessText($theme, $zoneId)
            : ZoneNarrativeCatalog::challengeNearMissText($theme, $zoneId);

        $this->appendBeat(
            $childId,
            $sessionId,
            $seqBeat,
            'C1_first_zone',
            $zoneId,
            'challenge_result',
            $resultText,
            null,
            ['ok' => $ok, 'reply' => $reply, 'gate_index' => $gateIndex]
        );

        $stepsDone = 0;
        $stepsTotal = self::ZONE_INTRO_GATES;
        if ($questId !== '') {
            $st = $this->pdo->prepare('select steps_done, steps_total, learning_gates, status from narrative_quests where id = :id');
            $st->execute(['id' => $questId]);
            $row = $st->fetch(PDO::FETCH_ASSOC) ?: [];
            $stepsDone = (int) ($row['steps_done'] ?? 0) + 1;
            $stepsTotal = (int) ($row['steps_total'] ?? self::ZONE_INTRO_GATES);
            $gates = $row['learning_gates'] ?? [];
            if (is_string($gates)) {
                $gates = json_decode($gates, true) ?: [];
            }
            if (!is_array($gates)) {
                $gates = [];
            }
            foreach ($gates as $i => $g) {
                if (!is_array($g)) {
                    continue;
                }
                if ((int) ($g['gate_index'] ?? $i) === $gateIndex) {
                    $gates[$i]['done'] = true;
                }
            }
            $status = $stepsDone >= $stepsTotal ? 'completed' : (string) ($row['status'] ?? 'active');
            $this->pdo->prepare(
                'update narrative_quests set steps_done = :done, learning_gates = :gates::jsonb,
                 status = :status, updated_at = now() where id = :id'
            )->execute([
                'done' => $stepsDone,
                'gates' => json_encode(array_values($gates), JSON_UNESCAPED_UNICODE),
                'status' => $status,
                'id' => $questId,
            ]);
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

        $questComplete = $stepsDone >= $stepsTotal;
        if ($questComplete) {
            $this->markZoneCompleted($childId, $zoneId);
            $wrap = ZoneNarrativeCatalog::questCompleteText($theme, $zoneId)
                . ' ¿Seguimos explorando otra tierra o pausamos el viaje por hoy?';
            $this->appendBeat(
                $childId,
                $sessionId,
                $this->nextBeatSequence($childId),
                'C1_first_zone',
                $zoneId,
                'quest_update',
                $wrap,
                [
                    ['id' => 'continue_zone_lore', 'label' => 'Quedarnos un momento'],
                    ['id' => 'pause_session', 'label' => 'Pausar el viaje'],
                ],
                null
            );

            return [
                'turns' => [
                    [
                        'text' => $resultText . ' ' . $wrap,
                        'input_mode' => 'options_only',
                        'options' => [
                            ['id' => 'pause_session', 'label' => 'Pausar hasta otra visita'],
                            ['id' => 'stay_a_while', 'label' => 'Mirar el claro un momento'],
                        ],
                        'meta' => [
                            'phase' => 'zone_quest_complete',
                            'zone_id' => $zoneId,
                            'quest_id' => $questId,
                        ],
                    ],
                ],
                'effects' => [
                    ['type' => 'record_learning_result', 'ok' => $ok, 'zone_id' => $zoneId],
                    ['type' => 'update_quest', 'quest_id' => $questId, 'status' => 'completed'],
                    ['type' => 'append_story_beat', 'beat_kind' => 'challenge_result'],
                ],
            ];
        }

        $nextGate = $gateIndex + 1;
        $between = ZoneNarrativeCatalog::betweenText($theme, $zoneId, $nextGate, $stepsTotal);

        $this->appendBeat(
            $childId,
            $sessionId,
            $this->nextBeatSequence($childId),
            'C1_first_zone',
            $zoneId,
            'narration',
            $between,
            null,
            null
        );

        return [
            'turns' => [
                [
                    'text' => $resultText . ' ' . $between,
                    'input_mode' => 'continue',
                    'options' => [['id' => 'continue', 'label' => 'Seguir explorando']],
                    'meta' => [
                        'phase' => 'zone_between',
                        'zone_id' => $zoneId,
                        'quest_id' => $questId,
                        'subject_id' => $subject,
                        'level_id' => $levelId,
                        'gate_index' => $nextGate,
                    ],
                ],
            ],
            'effects' => [
                ['type' => 'record_learning_result', 'ok' => $ok, 'zone_id' => $zoneId],
                ['type' => 'append_story_beat', 'beat_kind' => 'challenge_result'],
            ],
        ];
    }

    /**
     * @return array{turns:list<array<string,mixed>>,effects:list<array<string,mixed>>}
     */
    public function wrapSession(string $childId, array $child, array $meta, string $sessionId): array
    {
        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $zoneId = (string) ($meta['zone_id'] ?? '');
        $text = $theme === 'sci-fi'
            ? 'Guardamos la bitácora. Cuando vuelvas, las estrellas de esta zona recordarán tu rastro. Hasta la próxima visita.'
            : 'El mentor cierra el pergamino del día. El bosque queda en calma hasta tu próxima visita. Hasta pronto — y con motivo: el viaje necesita descanso.';

        $this->appendBeat(
            $childId,
            $sessionId,
            $this->nextBeatSequence($childId),
            'C1_first_zone',
            $zoneId !== '' ? $zoneId : null,
            'narration',
            $text,
            null,
            null
        );

        return [
            'turns' => [
                [
                    'text' => $text,
                    'input_mode' => 'continue',
                    'options' => [['id' => 'continue', 'label' => 'Hasta la próxima visita']],
                    'meta' => ['phase' => 'session_wrap', 'zone_id' => $zoneId],
                ],
            ],
            'effects' => [
                ['type' => 'append_story_beat', 'beat_kind' => 'narration'],
            ],
        ];
    }

    /**
     * @return array{turns:list<array<string,mixed>>,effects:list<array<string,mixed>>}
     */
    public function lingerAfterQuest(string $childId, array $child, array $meta, string $sessionId): array
    {
        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $zoneId = (string) ($meta['zone_id'] ?? '');
        $text = $theme === 'sci-fi'
            ? 'Observáis juntos el brillo de las balizas. Cuando quieras, podemos pausar el viaje con la bitácora al día.'
            : 'Os sentáis un momento en el claro. El guardián asiente en silencio. Cuando quieras, pausamos el viaje hasta otra visita.';

        return [
            'turns' => [
                [
                    'text' => $text,
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'pause_session', 'label' => 'Pausar hasta otra visita'],
                    ],
                    'meta' => ['phase' => 'zone_quest_complete', 'zone_id' => $zoneId, 'quest_id' => $meta['quest_id'] ?? ''],
                ],
            ],
            'effects' => [],
        ];
    }

    public static function zoneTitle(string $theme, string $zoneId): string
    {
        return match ($zoneId) {
            'zone_math' => $theme === 'sci-fi' ? 'Nebulosa Matemática' : 'Bosque de los Números',
            'zone_language' => $theme === 'sci-fi' ? 'Estación Léxico' : 'Montañas de la Gramática',
            'zone_logic' => $theme === 'sci-fi' ? 'Laberinto de Circuitos' : 'Laberinto de Espejos',
            'zone_science' => $theme === 'sci-fi' ? 'Cinturón de Observatorios' : 'Jardines Alquímicos',
            default => $theme === 'sci-fi' ? 'Archivo Galáctico' : 'Biblioteca de los Reinos',
        };
    }

    private static function levelRank(string $levelId): int
    {
        return match (strtoupper($levelId)) {
            'L1' => 1,
            'L2' => 2,
            'L3' => 3,
            'L4' => 4,
            'L5' => 5,
            default => 3,
        };
    }

    private static function whyForYou(
        string $theme,
        string $subject,
        int $rank,
        int $index,
        int $minRank,
        int $pickCount,
    ): string {
        $spark = self::subjectSparkPhrase($subject);

        if ($index === 0 && $rank === $minRank) {
            if ($rank <= 2) {
                return $theme === 'sci-fi'
                    ? "Tu señal en {$spark} aún titila: buen sitio para reforzar sin prisa."
                    : "Aquí {$spark} pueden crecer con calma — buen primer paso.";
            }

            return $theme === 'sci-fi'
                ? "Buen arranque: {$spark} piden práctica constante."
                : "Un primer paso sensato: reforzar {$spark} sin presión.";
        }

        if ($pickCount >= 3 && $index === 1) {
            return $theme === 'sci-fi'
                ? 'Un cruce equilibrado: practicar sin dejar atrás lo que ya dominas.'
                : 'Un camino intermedio: afianzar lo aprendido desde otro ángulo.';
        }

        if ($rank >= 4) {
            return $theme === 'sci-fi'
                ? 'Podrías ayudar a otros cadetes con lo que ya manejas bien.'
                : 'Podrías ayudar al reino compartiendo lo que ya dominas.';
        }

        return $theme === 'sci-fi'
            ? 'Variedad en la ruta: explorar otro frente del saber.'
            : 'Otra puerta abierta: sumar variedad a tu viaje.';
    }

    private static function subjectSparkPhrase(string $subject): string
    {
        return match ($subject) {
            'math' => 'los números',
            'language' => 'las palabras',
            'logic' => 'el orden claro',
            'science' => 'la observación',
            'culture' => 'la memoria',
            default => 'tu chispa',
        };
    }

    /** @param list<string> $items */
    private static function spanishList(array $items): string
    {
        $n = count($items);
        if ($n === 0) {
            return '';
        }
        if ($n === 1) {
            return $items[0];
        }
        if ($n === 2) {
            return $items[0] . ' y ' . $items[1];
        }
        $last = array_pop($items);

        return implode(', ', $items) . ' y ' . $last;
    }

    private function subjectLevel(string $childId, string $subject): string
    {
        try {
            $stmt = $this->pdo->prepare(
                'select level_id from user_subject_levels where child_id = :cid and subject_id = :sid limit 1'
            );
            $stmt->execute(['cid' => $childId, 'sid' => $subject]);
            $v = $stmt->fetchColumn();
            if (is_string($v) && $v !== '') {
                return $v;
            }
        } catch (\Throwable) {
            /* sqlite tests sin tabla */
        }

        return 'L2';
    }

    /** @return array{prompt:string,input_mode:string,options:list<array{id:string,label:string}>,canonical_option:string} */
    private function challengeFor(string $theme, string $subject, string $levelId, int $gateIndex): array
    {
        $rank = self::levelRank($levelId);
        $pool = $this->challengePool($theme, $subject, $rank);
        $pick = $pool[$gateIndex % count($pool)];

        return $pick;
    }

    /**
     * @return list<array{prompt:string,input_mode:string,options:list<array{id:string,label:string}>,canonical_option:string}>
     */
    private function challengePool(string $theme, string $subject, int $rank): array
    {
        if ($subject === 'language') {
            return $rank <= 2
                ? [[
                    'prompt' => 'Un letrero pide la palabra correcta: «El ____ brilla». ¿Cuál encaja?',
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'a', 'label' => 'sol'],
                        ['id' => 'b', 'label' => 'correr'],
                        ['id' => 'c', 'label' => 'mesa'],
                    ],
                    'canonical_option' => 'a',
                ], [
                    'prompt' => 'Elige el plural correcto de «luz».',
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'a', 'label' => 'luzs'],
                        ['id' => 'b', 'label' => 'luces'],
                        ['id' => 'c', 'label' => 'luzes'],
                    ],
                    'canonical_option' => 'b',
                ], [
                    'prompt' => '¿Qué palabra completa: «Nosotros ____ al claro»?',
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'a', 'label' => 'vamos'],
                        ['id' => 'b', 'label' => 'va'],
                        ['id' => 'c', 'label' => 'voy'],
                    ],
                    'canonical_option' => 'a',
                ]]
                : [[
                    'prompt' => 'Elige el sinónimo más cercano de «antiguo».',
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'a', 'label' => 'viejo'],
                        ['id' => 'b', 'label' => 'rápido'],
                        ['id' => 'c', 'label' => 'húmedo'],
                    ],
                    'canonical_option' => 'a',
                ], [
                    'prompt' => '¿Cuál es la forma correcta?',
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'a', 'label' => 'Halla tu camino'],
                        ['id' => 'b', 'label' => 'Haya tu camino'],
                        ['id' => 'c', 'label' => 'Aya tu camino'],
                    ],
                    'canonical_option' => 'a',
                ], [
                    'prompt' => 'Completa: «Aunque ____ tarde, llegamos.»',
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'a', 'label' => 'llovía'],
                        ['id' => 'b', 'label' => 'llover'],
                        ['id' => 'c', 'label' => 'llovido'],
                    ],
                    'canonical_option' => 'a',
                ]];
        }

        if ($subject === 'logic') {
            return $rank <= 2
                ? [[
                    'prompt' => 'Secuencia: 1, 2, 4, 8, … ¿Siguiente?',
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'a', 'label' => '10'],
                        ['id' => 'b', 'label' => '16'],
                        ['id' => 'c', 'label' => '12'],
                    ],
                    'canonical_option' => 'b',
                ], [
                    'prompt' => 'Si todos los A son B, y este es A, entonces…',
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'a', 'label' => 'es B'],
                        ['id' => 'b', 'label' => 'no es B'],
                        ['id' => 'c', 'label' => 'es C'],
                    ],
                    'canonical_option' => 'a',
                ], [
                    'prompt' => '¿Qué no encaja: círculo, cuadrado, triángulo, manzana?',
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'a', 'label' => 'manzana'],
                        ['id' => 'b', 'label' => 'círculo'],
                        ['id' => 'c', 'label' => 'triángulo'],
                    ],
                    'canonical_option' => 'a',
                ]]
                : [[
                    'prompt' => 'Secuencia: 2, 6, 12, 20, … ¿Siguiente?',
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'a', 'label' => '30'],
                        ['id' => 'b', 'label' => '28'],
                        ['id' => 'c', 'label' => '24'],
                    ],
                    'canonical_option' => 'a',
                ], [
                    'prompt' => 'Si llueve ⇒ suelo mojado. El suelo está seco. ¿Qué sigue?',
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'a', 'label' => 'No llueve'],
                        ['id' => 'b', 'label' => 'Llueve seguro'],
                        ['id' => 'c', 'label' => 'No se sabe'],
                    ],
                    'canonical_option' => 'a',
                ], [
                    'prompt' => 'Ordena de menor a mayor lógica: 3 pasos, 1 paso, 2 pasos. ¿Primero?',
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'a', 'label' => '1 paso'],
                        ['id' => 'b', 'label' => '2 pasos'],
                        ['id' => 'c', 'label' => '3 pasos'],
                    ],
                    'canonical_option' => 'a',
                ]];
        }

        // math / default
        if ($rank <= 2) {
            return [
                [
                    'prompt' => $theme === 'sci-fi' ? 'La consola pide: 5 + 7 = ¿?' : 'Las runas muestran: 5 + 7 = ¿?',
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'a', 'label' => '11'],
                        ['id' => 'b', 'label' => '12'],
                        ['id' => 'c', 'label' => '13'],
                    ],
                    'canonical_option' => 'b',
                ],
                [
                    'prompt' => $theme === 'sci-fi' ? 'Panel: 9 − 4 = ¿?' : 'Runa: 9 − 4 = ¿?',
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'a', 'label' => '5'],
                        ['id' => 'b', 'label' => '6'],
                        ['id' => 'c', 'label' => '4'],
                    ],
                    'canonical_option' => 'a',
                ],
                [
                    'prompt' => $theme === 'sci-fi' ? 'Panel: 3 × 4 = ¿?' : 'Runa: 3 × 4 = ¿?',
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'a', 'label' => '7'],
                        ['id' => 'b', 'label' => '12'],
                        ['id' => 'c', 'label' => '9'],
                    ],
                    'canonical_option' => 'b',
                ],
            ];
        }

        if ($rank === 3) {
            return [
                [
                    'prompt' => $theme === 'sci-fi' ? 'Consola: 47 + 28 = ¿?' : 'Runas: 47 + 28 = ¿?',
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'a', 'label' => '75'],
                        ['id' => 'b', 'label' => '65'],
                        ['id' => 'c', 'label' => '85'],
                    ],
                    'canonical_option' => 'a',
                ],
                [
                    'prompt' => $theme === 'sci-fi' ? 'Panel: 15 × 4 = ¿?' : 'Runa: 15 × 4 = ¿?',
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'a', 'label' => '45'],
                        ['id' => 'b', 'label' => '60'],
                        ['id' => 'c', 'label' => '50'],
                    ],
                    'canonical_option' => 'b',
                ],
                [
                    'prompt' => $theme === 'sci-fi' ? 'Panel: 96 ÷ 8 = ¿?' : 'Runa: 96 ÷ 8 = ¿?',
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'a', 'label' => '12'],
                        ['id' => 'b', 'label' => '10'],
                        ['id' => 'c', 'label' => '14'],
                    ],
                    'canonical_option' => 'a',
                ],
            ];
        }

        return [
            [
                'prompt' => $theme === 'sci-fi' ? 'Consola: 144 ÷ 12 = ¿?' : 'Runas: 144 ÷ 12 = ¿?',
                'input_mode' => 'options_only',
                'options' => [
                    ['id' => 'a', 'label' => '11'],
                    ['id' => 'b', 'label' => '12'],
                    ['id' => 'c', 'label' => '14'],
                ],
                'canonical_option' => 'b',
            ],
            [
                'prompt' => $theme === 'sci-fi' ? 'Panel: 17 × 6 = ¿?' : 'Runa: 17 × 6 = ¿?',
                'input_mode' => 'options_only',
                'options' => [
                    ['id' => 'a', 'label' => '102'],
                    ['id' => 'b', 'label' => '96'],
                    ['id' => 'c', 'label' => '112'],
                ],
                'canonical_option' => 'a',
            ],
            [
                'prompt' => $theme === 'sci-fi' ? 'Panel: 1/2 + 1/4 = ¿?' : 'Runa: 1/2 + 1/4 = ¿?',
                'input_mode' => 'options_only',
                'options' => [
                    ['id' => 'a', 'label' => '3/4'],
                    ['id' => 'b', 'label' => '2/6'],
                    ['id' => 'c', 'label' => '1/6'],
                ],
                'canonical_option' => 'a',
            ],
        ];
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

    /**
     * @param array<string,mixed> $child
     * @return list<string>
     */
    public static function completedZoneIds(array $child): array
    {
        $settings = $child['settings'] ?? [];
        if (!is_array($settings)) {
            return [];
        }
        $journey = $settings['journey'] ?? [];
        if (!is_array($journey)) {
            return [];
        }
        $raw = $journey['zones_completed'] ?? [];
        if (!is_array($raw)) {
            return [];
        }

        return array_values(array_filter($raw, static fn ($z): bool => is_string($z) && $z !== ''));
    }

    private function markZoneCompleted(string $childId, string $zoneId): void
    {
        $stmt = $this->pdo->prepare('select settings from children where id = :id limit 1');
        $stmt->execute(['id' => $childId]);
        $raw = $stmt->fetchColumn();
        $settings = is_string($raw) ? json_decode($raw, true) : [];
        if (!is_array($settings)) {
            $settings = [];
        }
        $journey = is_array($settings['journey'] ?? null) ? $settings['journey'] : [];
        $completed = is_array($journey['zones_completed'] ?? null) ? $journey['zones_completed'] : [];
        if (!in_array($zoneId, $completed, true)) {
            $completed[] = $zoneId;
        }
        $journey['zones_completed'] = array_values(array_filter($completed, static fn ($z): bool => is_string($z) && $z !== ''));
        $settings['journey'] = $journey;
        $this->pdo->prepare('update children set settings = :settings::jsonb, updated_at = now() where id = :id')
            ->execute([
                'settings' => json_encode($settings, JSON_UNESCAPED_UNICODE),
                'id' => $childId,
            ]);
    }

    private function maybeSummarize(string $childId, string $mentorId): void
    {
        unset($mentorId);
        $memory = new JourneyMemoryService($this->pdo, $this->gateway);
        $memory->maybeCondense($childId, 3);
    }
}
