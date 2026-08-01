<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use InvalidArgumentException;
use Kidepik\Shared\Text\CharacterSummaryBuilder;
use Kidepik\Shared\Text\DisplayNameExtractor;
use Kidepik\Shared\Text\SpeciesExtractor;
use Kidepik\Shared\Text\Utf8Text;
use Kidepik\Shared\Ai\AgeBand;
use Kidepik\Shared\Ai\AiGateway;
use Kidepik\Shared\Ai\MentorCatalog;
use Kidepik\Shared\Ai\PlacementNarrator;
use Kidepik\Shared\Ai\SubjectCatalog;
use Kidepik\Shared\Config;
use Kidepik\Shared\Database\PdoFactory;
use Kidepik\Shared\Logging\AppLogger;
use PDO;
use RuntimeException;

/**
 * Motor de diálogo first_run (MVP) con effects tipados y mentor.
 */
final class DialogueService
{
    /** @var list<array<string,mixed>> */
    private array $lastEffects = [];

    /** @var array<string,mixed>|null */
    private ?array $lastComposeDebug = null;

    public function __construct(
        private readonly ?PDO $pdo = null,
        private readonly ?CrewService $crew = null,
        private readonly ?AiGateway $gateway = null,
    ) {
    }

    /** @return array<string,mixed> */
    public function openSession(string $authUserId, string $childId, string $flowId = 'first_run'): array
    {
        $crew = $this->crew();
        $child = $crew->getForAuthUser($authUserId, $childId);
        $pdo = $this->pdo();

        $existing = $pdo->prepare(
            "select id, flow_id, mentor_id, status from dialogue_sessions
             where child_id = :cid and flow_id = :flow and status = 'open'
             order by created_at desc limit 1"
        );
        $existing->execute(['cid' => $childId, 'flow' => $flowId]);
        $session = $existing->fetch(PDO::FETCH_ASSOC);

        // Si el flow pidió first_run pero el viaje ya mutó a placement/adventure, reanudar esa sesión.
        if ($session === false) {
            $any = $pdo->prepare(
                "select id, flow_id, mentor_id, status from dialogue_sessions
                 where child_id = :cid and status = 'open'
                 order by updated_at desc, created_at desc limit 1"
            );
            $any->execute(['cid' => $childId]);
            $session = $any->fetch(PDO::FETCH_ASSOC);
            if ($session === false) {
                $session = null;
            }
        }

        if ($session === null) {
            $resolvedFlow = $this->resolveFlowForChild($child);
            $mentorId = MentorCatalog::idForWorldTheme($child['world_theme'] ?? null);
            $ins = $pdo->prepare(
                'insert into dialogue_sessions (child_id, flow_id, mentor_id, status)
                 values (:cid, :flow, :mentor, \'open\') returning id, flow_id, mentor_id, status'
            );
            $ins->execute([
                'cid' => $childId,
                'flow' => $resolvedFlow,
                'mentor' => $mentorId,
            ]);
            $session = $ins->fetch(PDO::FETCH_ASSOC);
            if ($session === false) {
                throw new RuntimeException('Could not create dialogue session');
            }
            $this->seedOpeningTurn($pdo, (string) $session['id'], $childId, $resolvedFlow, $mentorId, $child);
        }

        $turns = $this->loadTurns($pdo, (string) $session['id']);
        $pending = null;
        for ($i = count($turns) - 1; $i >= 0; $i--) {
            if (($turns[$i]['role'] ?? '') === 'mentor' || ($turns[$i]['role'] ?? '') === 'agent') {
                $pending = $turns[$i];
                break;
            }
        }

        return [
            'session_id' => (string) $session['id'],
            'flow_id' => (string) $session['flow_id'],
            'onboarding_step' => (string) ($child['onboarding_step'] ?? 'pending_entry'),
            'world_theme' => $child['world_theme'] ?? null,
            'age_band' => $child['age_band'] ?? $child['effective_age_band'] ?? null,
            'age_years' => isset($child['age_years']) ? (int) $child['age_years'] : null,
            'display_name' => $child['display_name'] ?? null,
            'mentor' => MentorCatalog::profile(
                (string) ($session['mentor_id'] ?? MentorCatalog::idForWorldTheme($child['world_theme'] ?? null))
            ),
            'turns' => $turns,
            'pending_agent_turn' => $pending,
        ];
    }

    /**
     * @param array{kind:string,option_id?:string,text?:string} $reply
     * @return array<string,mixed>
     */
    public function submitTurn(
        string $authUserId,
        string $childId,
        string $sessionId,
        array $reply,
        bool $attachDebug = false,
    ): array {
        $crew = $this->crew();
        $child = $crew->getForAuthUser($authUserId, $childId);
        $pdo = $this->pdo();

        $sessionStmt = $pdo->prepare(
            "select * from dialogue_sessions where id = :id and child_id = :cid and status = 'open' limit 1"
        );
        $sessionStmt->execute(['id' => $sessionId, 'cid' => $childId]);
        $session = $sessionStmt->fetch(PDO::FETCH_ASSOC);
        if ($session === false) {
            throw new InvalidArgumentException('session not found');
        }

        $flowId = (string) $session['flow_id'];
        $seq = $this->nextSequence($pdo, $sessionId);

        $replyKind = $reply['kind'] ?? '';
        if (!in_array($replyKind, ['option', 'text', 'continue'], true)) {
            throw new InvalidArgumentException('reply invalid');
        }

        $lastMentorForLabel = $this->lastMentorTurn($pdo, $sessionId);
        $explorerText = $replyKind === 'option'
            ? $this->resolveOptionLabel(
                (string) ($reply['option_id'] ?? ''),
                is_array($lastMentorForLabel['options'] ?? null) ? $lastMentorForLabel['options'] : [],
            )
            : trim((string) ($reply['text'] ?? ''));
        if ($replyKind === 'option' && $explorerText === '') {
            $explorerText = (string) ($reply['option_id'] ?? '');
        }
        if ($replyKind !== 'continue' && $explorerText === '') {
            throw new InvalidArgumentException('reply empty');
        }

        $this->insertTurn($pdo, [
            'session_id' => $sessionId,
            'child_id' => $childId,
            'flow_id' => $flowId,
            'sequence' => $seq,
            'role' => 'explorer',
            'text' => $explorerText,
            'input_mode' => null,
            'explorer_reply' => $reply,
            'meta' => [],
            'model_used' => null,
        ]);

        $this->lastComposeDebug = null;
        $effects = [];
        $agentTurns = [];
        $step = (string) ($child['onboarding_step'] ?? 'pending_entry');
        $mentorId = (string) ($session['mentor_id'] ?? MentorCatalog::idForWorldTheme($child['world_theme'] ?? null));

        // Detect last mentor phase from DB
        $lastMentor = $this->lastMentorTurn($pdo, $sessionId);
        $phase = is_array($lastMentor['meta'] ?? null) ? (string) ($lastMentor['meta']['phase'] ?? '') : '';

        if ($phase === 'choose_zone' || ($step === 'complete' && str_starts_with((string) ($reply['option_id'] ?? ''), 'zone_'))) {
            $zoneId = (string) ($reply['option_id'] ?? '');
            $adv = new AdventureService($pdo, $this->gateway());
            $result = $adv->chooseZone($childId, $child, $zoneId, $sessionId, 'adventure', $seq + 1, $mentorId);
            $effects = $result['effects'];
            $n = $seq + 1;
            foreach ($result['turns'] as $payload) {
                $agentTurns[] = $this->insertTurn($pdo, [
                    'session_id' => $sessionId,
                    'child_id' => $childId,
                    'flow_id' => 'adventure',
                    'sequence' => $n++,
                    'role' => 'mentor',
                    'text' => (string) ($payload['text'] ?? ''),
                    'input_mode' => $payload['input_mode'] ?? 'continue',
                    'options' => $payload['options'] ?? null,
                    'explorer_reply' => null,
                    'meta' => $payload['meta'] ?? [],
                    'model_used' => null,
                ]);
            }
            $pdo->prepare("update dialogue_sessions set flow_id = 'adventure', updated_at = now() where id = :id")
                ->execute(['id' => $sessionId]);
        } elseif ($phase === 'adventure_challenge') {
            $adv = new AdventureService($pdo, $this->gateway());
            $result = $adv->resolveChallenge(
                $childId,
                $child,
                $reply,
                is_array($lastMentor['meta'] ?? null) ? $lastMentor['meta'] : [],
                $sessionId,
                $seq + 1,
                $mentorId,
            );
            $effects = $result['effects'];
            $n = $seq + 1;
            foreach ($result['turns'] as $payload) {
                $agentTurns[] = $this->insertTurn($pdo, [
                    'session_id' => $sessionId,
                    'child_id' => $childId,
                    'flow_id' => 'adventure',
                    'sequence' => $n++,
                    'role' => 'mentor',
                    'text' => (string) ($payload['text'] ?? ''),
                    'input_mode' => $payload['input_mode'] ?? 'continue',
                    'options' => $payload['options'] ?? null,
                    'explorer_reply' => null,
                    'meta' => $payload['meta'] ?? [],
                    'model_used' => null,
                ]);
            }
        } elseif ($phase === 'placement_item' || ($step === 'placement' && $phase !== 'handoff_placement' && $this->hasOpenExam($pdo, $childId))) {
            $this->lastEffects = [];
            $agentTurns = $this->handlePlacementAnswer(
                $pdo,
                $childId,
                $child,
                $sessionId,
                $seq + 1,
                $mentorId,
                $reply,
            );
            $effects = $this->lastEffects;
            $this->lastEffects = [];
        } elseif (
            $step === 'placement'
            && ($replyKind === 'continue' || ($reply['option_id'] ?? '') === 'start_placement' || $phase === 'handoff_placement')
        ) {
            $placement = PlacementService::withDefaultBank($pdo);
            try {
                $started = $placement->startExam($childId, $child, $sessionId, 'placement', $seq + 1, $mentorId);
                $pdo->prepare("update dialogue_sessions set flow_id = 'placement', updated_at = now() where id = :id")
                    ->execute(['id' => $sessionId]);
                $effects = $started['effects'];
                $agentTurns[] = $this->insertTurn($pdo, $started['turn']);
            } catch (PlacementComposeFailedException $e) {
                $this->lastComposeDebug = $e->composeDebug;
                AppLogger::channel('compose')->warning('handoff_compose_failed', [
                    'child_id' => $childId,
                    'session_id' => $sessionId,
                    'compose_debug' => $e->composeDebug,
                ]);
                $meta = [
                    'phase' => 'handoff_placement',
                    'mentor_id' => $mentorId,
                    'compose_failed' => true,
                ];
                if ($attachDebug) {
                    $meta['compose_debug'] = $e->composeDebug;
                }
                $agentTurns[] = $this->insertTurn($pdo, [
                    'session_id' => $sessionId,
                    'child_id' => $childId,
                    'flow_id' => $flowId,
                    'sequence' => $seq + 1,
                    'role' => 'mentor',
                    'text' => 'La Escuela aún no ha abierto el umbral: no he podido preparar tu prueba ahora mismo. '
                        . 'Cuando quieras, lo intentamos de nuevo.',
                    'input_mode' => 'options_only',
                    'options' => [['id' => 'start_placement', 'label' => 'Reintentar prueba']],
                    'explorer_reply' => null,
                    'meta' => $meta,
                    'model_used' => null,
                ]);
            } catch (InvalidArgumentException $e) {
                throw $e;
            }
        } elseif ($flowId === 'first_run' || in_array($step, ['pending_entry', 'choose_world', 'choose_name', 'choose_age', 'choose_character'], true)) {
            [$effects, $agentTurns, $step] = $this->advanceFirstRun(
                $pdo,
                $authUserId,
                $childId,
                $sessionId,
                $flowId,
                $seq + 1,
                $step,
                $reply,
                $child,
                $mentorId,
            );
        } elseif ($step === 'placement' && !$this->hasOpenExam($pdo, $childId)) {
            $subjects = PlacementService::activeSubjectsForChild($child);
            $intro = (new PlacementNarrator())->intro($child, $mentorId, $subjects);
            $agentTurns[] = $this->insertTurn($pdo, [
                'session_id' => $sessionId,
                'child_id' => $childId,
                'flow_id' => $flowId,
                'sequence' => $seq + 1,
                'role' => 'mentor',
                'text' => $intro,
                'input_mode' => 'options_only',
                'options' => [['id' => 'start_placement', 'label' => 'Comenzar prueba']],
                'explorer_reply' => null,
                'meta' => ['phase' => 'handoff_placement', 'mentor_id' => $mentorId],
                'model_used' => null,
            ]);
        } else {
            $agentTurns[] = $this->llmMentorTurn(
                $pdo,
                $sessionId,
                $childId,
                $flowId,
                $seq + 1,
                $mentorId,
                $explorerText,
            );
        }

        $fresh = $crew->getForAuthUser($authUserId, $childId);

        $response = [
            'agent_turns' => $agentTurns,
            'effects' => $effects,
            'flow_complete' => ($fresh['onboarding_step'] ?? '') === 'complete'
                && ($fresh['placement_status'] ?? '') === 'completed',
            'onboarding_step' => $fresh['onboarding_step'] ?? $step,
            'display_name' => $fresh['display_name'] ?? null,
            'mentor' => MentorCatalog::profile(
                MentorCatalog::idForWorldTheme($fresh['world_theme'] ?? null)
            ),
            'world_theme' => $fresh['world_theme'] ?? null,
            'age_band' => $fresh['age_band'] ?? $fresh['effective_age_band'] ?? null,
            'age_years' => isset($fresh['age_years']) ? (int) $fresh['age_years'] : null,
        ];

        if ($attachDebug) {
            $response['debug'] = $this->buildDebugPayload();
        }

        return $response;
    }

    /**
     * @return array<string, mixed>
     */
    private function buildDebugPayload(): array
    {
        $payload = [
            'ai' => [
                'enabled' => Config::aiEnabled(),
                'mock' => Config::aiMock(),
                'key_present' => Config::openRouterKeyPresent(),
                'max_attempts' => Config::aiMaxModelAttempts(),
                'debug_allowed' => Config::aiDebugEnabled(),
            ],
        ];
        if ($this->lastComposeDebug !== null) {
            $payload['compose'] = $this->lastComposeDebug;
        }

        return $payload;
    }

    /**
     * @param array<string,mixed> $reply
     * @param array<string,mixed> $child
     * @return array{0:list<array<string,mixed>>,1:list<array<string,mixed>>,2:string}
     */
    private function advanceFirstRun(
        PDO $pdo,
        string $authUserId,
        string $childId,
        string $sessionId,
        string $flowId,
        int $nextSeq,
        string $step,
        array $reply,
        array $child,
        string $mentorId,
    ): array {
        $effects = [];
        $agentTurns = [];
        $crew = $this->crew();

        if ($step === 'pending_entry' || $step === 'choose_world') {
            if ($step === 'pending_entry') {
                $this->setOnboarding($pdo, $childId, 'choose_world');
                $step = 'choose_world';
                $effects[] = ['type' => 'advance_onboarding', 'to' => 'choose_world'];
            }

            $option = (string) ($reply['option_id'] ?? '');
            if (in_array($option, ['fantasy', 'sci-fi'], true)) {
                $mentorId = MentorCatalog::idForWorldTheme($option);
                $crew->updateProfileForAuthUser($authUserId, $childId, [
                    'world_theme' => $option,
                    'unlock_world' => true,
                ]);
                $crew->updatePermissionsForAuthUser($authUserId, $childId, [
                    'lock_world_theme' => true,
                ]);
                $pdo->prepare('update children set mentor_id = :m, onboarding_step = :step, updated_at = now() where id = :id')
                    ->execute(['m' => $mentorId, 'step' => 'choose_name', 'id' => $childId]);
                $pdo->prepare('update dialogue_sessions set mentor_id = :m, updated_at = now() where id = :id')
                    ->execute(['m' => $mentorId, 'id' => $sessionId]);

                $effects[] = ['type' => 'set_world_theme', 'value' => $option];
                $effects[] = ['type' => 'set_mentor', 'mentor_id' => $mentorId];
                $effects[] = ['type' => 'advance_onboarding', 'to' => 'choose_name'];

                $profile = MentorCatalog::profile($mentorId);
                $agentTurns[] = $this->insertTurn($pdo, [
                    'session_id' => $sessionId,
                    'child_id' => $childId,
                    'flow_id' => $flowId,
                    'sequence' => $nextSeq,
                    'role' => 'mentor',
                    'text' => sprintf(
                        'Soy %s. En este mundo te acompañaré. ¿Cómo quieres que te llamen en la aventura?',
                        $profile['display_name']
                    ),
                    'input_mode' => 'text_only',
                    'options' => null,
                    'explorer_reply' => null,
                    'meta' => ['phase' => 'choose_name'],
                    'model_used' => null,
                ]);
                $step = 'choose_name';

                return [$effects, $agentTurns, $step];
            }

            // Continuar / primera apertura ya seed; si reply continue sin mundo, re-prompt
            $agentTurns[] = $this->insertTurn($pdo, [
                'session_id' => $sessionId,
                'child_id' => $childId,
                'flow_id' => $flowId,
                'sequence' => $nextSeq,
                'role' => 'mentor',
                'text' => 'Elige cómo será tu mundo.',
                'input_mode' => 'options_only',
                'options' => $this->worldThemeOptions(),
                'explorer_reply' => null,
                'meta' => ['phase' => 'choose_world'],
                'model_used' => null,
            ]);

            return [$effects, $agentTurns, $step];
        }

        if ($step === 'choose_name') {
            $raw = trim((string) ($reply['text'] ?? $reply['option_id'] ?? ''));
            $name = null;
            $optionId = (string) ($reply['option_id'] ?? '');
            if ($optionId !== '' && $optionId !== 'custom') {
                foreach ($this->nameSuggestionOptions($child) as $opt) {
                    if ($opt['id'] === $optionId) {
                        $name = $opt['label'];
                        break;
                    }
                }
            }
            if ($name === null) {
                $name = DisplayNameExtractor::pickBest($raw);
            }
            if ($name === null && DisplayNameExtractor::isValidName($raw)) {
                $name = trim($raw);
            }

            if ($name === null) {
                $suggestions = $this->nameSuggestionOptions($child);
                $agentTurns[] = $this->insertTurn($pdo, [
                    'session_id' => $sessionId,
                    'child_id' => $childId,
                    'flow_id' => $flowId,
                    'sequence' => $nextSeq,
                    'role' => 'mentor',
                    'text' => 'No he encontrado un nombre claro en tu mensaje. Elige uno de estos o escribe solo tu nombre (sin la historia completa).',
                    'input_mode' => 'options_or_text',
                    'options' => $suggestions,
                    'explorer_reply' => null,
                    'meta' => ['phase' => 'choose_name', 'clarification' => true],
                    'model_used' => null,
                ]);

                return [$effects, $agentTurns, $step];
            }

            $crew->updateProfileForAuthUser($authUserId, $childId, ['display_name' => $name]);
            $this->setOnboarding($pdo, $childId, 'choose_age');
            $effects[] = ['type' => 'set_display_name', 'value' => $name];
            $effects[] = ['type' => 'advance_onboarding', 'to' => 'choose_age'];
            $agentTurns[] = $this->insertTurn($pdo, [
                'session_id' => $sessionId,
                'child_id' => $childId,
                'flow_id' => $flowId,
                'sequence' => $nextSeq,
                'role' => 'mentor',
                'text' => sprintf('Encantado, %s. ¿Qué edad tienes?', $name),
                'input_mode' => 'options_or_text',
                'options' => $this->ageOptions(),
                'explorer_reply' => null,
                'meta' => ['phase' => 'choose_age'],
                'model_used' => null,
            ]);

            return [$effects, $agentTurns, 'choose_age'];
        }

        if ($step === 'choose_age') {
            $age = $this->parseAge($reply);
            AgeBand::assertAgeYears($age);
            $band = AgeBand::fromAgeYears($age);
            $crew->updateProfileForAuthUser($authUserId, $childId, ['age_years' => $age]);
            $this->suggestLearningSubjects($authUserId, $childId, $band);
            $this->setOnboarding($pdo, $childId, 'choose_character');
            $effects[] = ['type' => 'set_age', 'value' => ['age_years' => $age, 'age_band' => $band]];
            $effects[] = ['type' => 'advance_onboarding', 'to' => 'choose_character'];
            $effects[] = [
                'type' => 'suggest_active_subjects',
                'value' => SubjectCatalog::baseSubjectsForBand($band),
            ];

            $theme = $child['world_theme'] ?? null;
            $suggestions = $theme === 'sci-fi'
                ? [
                    ['id' => 'spot', 'label' => 'Explorador spot'],
                    ['id' => 'orbit', 'label' => 'Criatura orbital'],
                    ['id' => 'custom', 'label' => 'Escribir la mía'],
                ]
                : [
                    ['id' => 'spark', 'label' => 'Chispa de niebla'],
                    ['id' => 'drake', 'label' => 'Dragón pequeño'],
                    ['id' => 'custom', 'label' => 'Escribir la mía'],
                ];

            $agentTurns[] = $this->insertTurn($pdo, [
                'session_id' => $sessionId,
                'child_id' => $childId,
                'flow_id' => $flowId,
                'sequence' => $nextSeq,
                'role' => 'mentor',
                'text' => 'Ahora imaginemos tu forma en este mundo. ¿Qué especie o criatura eres?',
                'input_mode' => 'options_or_text',
                'options' => $suggestions,
                'explorer_reply' => null,
                'meta' => ['phase' => 'choose_character_species'],
                'model_used' => null,
            ]);

            return [$effects, $agentTurns, 'choose_character'];
        }

        if ($step === 'choose_character') {
            return $this->handleCharacterPhase(
                $pdo,
                $authUserId,
                $childId,
                $sessionId,
                $flowId,
                $nextSeq,
                $reply,
                $mentorId,
            );
        }

        $agentTurns[] = $this->llmMentorTurn(
            $pdo,
            $sessionId,
            $childId,
            $flowId,
            $nextSeq,
            $mentorId,
            (string) ($reply['text'] ?? $reply['option_id'] ?? ''),
        );

        return [$effects, $agentTurns, $step];
    }

    /**
     * @param array<string,mixed> $reply
     * @return array{0:list<array<string,mixed>>,1:list<array<string,mixed>>,2:string}
     */
    private function handleCharacterPhase(
        PDO $pdo,
        string $authUserId,
        string $childId,
        string $sessionId,
        string $flowId,
        int $nextSeq,
        array $reply,
        string $mentorId,
    ): array {
        $effects = [];
        $raw = trim((string) ($reply['text'] ?? ''));
        $species = null;
        if ($raw !== '') {
            $species = SpeciesExtractor::pickBest($raw);
            if ($species === null && SpeciesExtractor::isValidSpecies($raw)) {
                $species = trim($raw);
            }
        }
        if ($species === null) {
            $opt = (string) ($reply['option_id'] ?? '');
            $species = match ($opt) {
                'spot' => 'explorador spot',
                'orbit' => 'criatura orbital',
                'spark' => 'chispa de niebla',
                'drake' => 'dragón pequeño',
                default => $opt !== 'custom' ? $opt : null,
            };
        }

        if ($species === null || !SpeciesExtractor::isValidSpecies($species)) {
            $child = $this->crew()->getForAuthUser($authUserId, $childId);
            $theme = (string) ($child['world_theme'] ?? 'fantasy');
            $suggestions = $theme === 'sci-fi'
                ? [
                    ['id' => 'spot', 'label' => 'Explorador spot'],
                    ['id' => 'orbit', 'label' => 'Criatura orbital'],
                    ['id' => 'custom', 'label' => 'Escribir la mía'],
                ]
                : [
                    ['id' => 'spark', 'label' => 'Chispa de niebla'],
                    ['id' => 'drake', 'label' => 'Dragón pequeño'],
                    ['id' => 'custom', 'label' => 'Escribir la mía'],
                ];

            $agentTurns = [$this->insertTurn($pdo, [
                'session_id' => $sessionId,
                'child_id' => $childId,
                'flow_id' => $flowId,
                'sequence' => $nextSeq,
                'role' => 'mentor',
                'text' => 'No he entendido bien tu forma. Elige una opción o escribe en pocas palabras qué criatura eres (máx. 40 caracteres).',
                'input_mode' => 'options_or_text',
                'options' => $suggestions,
                'explorer_reply' => null,
                'meta' => ['phase' => 'choose_character_species', 'clarification' => true],
                'model_used' => null,
            ])];

            return [$effects, $agentTurns, 'choose_character'];
        }

        // MVP: completar traits en un paso (species + defaults de paleta/rasgos)
        $palette = str_contains(mb_strtolower($species), 'neón') ? 'verde neón' : 'violeta y plata';
        $features = ['ojos curiosos', 'silueta no humana'];
        $characterSummary = CharacterSummaryBuilder::build(
            $species,
            $palette,
            $features,
            null,
            $raw !== '' ? $raw : null,
        );
        $this->upsertTraits($pdo, $childId, $species, $palette, $features, null, $characterSummary);
        $this->setOnboarding($pdo, $childId, 'placement');

        $effects[] = [
            'type' => 'set_traits',
            'value' => [
                'species' => $species,
                'palette' => $palette,
                'features' => $features,
            ],
        ];
        $effects[] = ['type' => 'advance_onboarding', 'to' => 'placement'];

        $child = $this->crew()->getForAuthUser($authUserId, $childId);
        $subjects = PlacementService::activeSubjectsForChild($child);
        $intro = (new PlacementNarrator())->intro($child, $mentorId, $subjects);
        $agentTurns = [$this->insertTurn($pdo, [
            'session_id' => $sessionId,
            'child_id' => $childId,
            'flow_id' => $flowId,
            'sequence' => $nextSeq,
            'role' => 'mentor',
            'text' => sprintf(
                'Listo: %s de tono %s. %s',
                $species,
                $palette,
                $intro,
            ),
            'input_mode' => 'continue',
            'options' => [['id' => 'start_placement', 'label' => 'Comenzar prueba']],
            'explorer_reply' => null,
            'meta' => ['phase' => 'handoff_placement'],
            'model_used' => null,
        ])];

        return [$effects, $agentTurns, 'placement'];
    }

    /**
     * Suggest active_subjects on first age declaration without overwriting tutor edits.
     */
    private function suggestLearningSubjects(string $authUserId, string $childId, string $band): void
    {
        $this->crew()->suggestLearningSubjectsForAuthUser($authUserId, $childId, $band);
    }

    /** @param array<string,mixed> $child */
    private function resolveFlowForChild(array $child): string
    {
        $step = (string) ($child['onboarding_step'] ?? 'pending_entry');
        $placement = (string) ($child['placement_status'] ?? 'not_started');
        if ($placement === 'in_progress' || $step === 'placement') {
            return 'placement';
        }
        if ($step === 'complete' && $placement === 'completed') {
            return 'adventure';
        }

        return 'first_run';
    }

    /** @param list<string> $features */
    private function upsertTraits(
        PDO $pdo,
        string $childId,
        string $species,
        string $palette,
        array $features,
        ?string $vibe,
        ?string $characterSummary = null,
    ): void {
        $stmt = $pdo->prepare(
            'insert into child_traits (child_id, species, palette, features, vibe, achievements, character_summary, updated_at)
             values (:id, :species, :palette, :features::jsonb, :vibe, \'[]\'::jsonb, :character_summary, now())
             on conflict (child_id) do update set
               species = excluded.species,
               palette = excluded.palette,
               features = excluded.features,
               vibe = excluded.vibe,
               character_summary = coalesce(excluded.character_summary, child_traits.character_summary),
               updated_at = now()'
        );
        $stmt->execute([
            'id' => $childId,
            'species' => $species,
            'palette' => $palette,
            'features' => json_encode(array_values($features), JSON_UNESCAPED_UNICODE),
            'vibe' => $vibe,
            'character_summary' => $characterSummary,
        ]);
    }

    /** @return array<string,mixed> */
    private function llmMentorTurn(
        PDO $pdo,
        string $sessionId,
        string $childId,
        string $flowId,
        int $sequence,
        string $mentorId,
        string $userText,
    ): array {
        $profile = MentorCatalog::profile($mentorId);
        $mentorRules = $this->mentorProseRules();
        $gateway = $this->gateway();
        $packBuilder = new JourneyContextPack($pdo);
        $pack = $packBuilder->build($childId);
        $memoryBlock = $packBuilder->toPromptBlock($pack);
        $messages = [
            [
                'role' => 'system',
                'content' => 'Eres ' . $profile['display_name'] . '. ' . $profile['short_description']
                    . "\n\n" . $mentorRules
                    . "\n\n" . $memoryBlock
                    . "\n\nResponde SOLO JSON con keys agent_text, input_mode, options, effects, meta. "
                    . 'Castellano de España (no latinoamericano).',
            ],
            ['role' => 'user', 'content' => $userText !== '' ? $userText : 'continuar'],
        ];

        $modelUsed = null;
        $text = 'Sigamos el viaje.';
        $inputMode = 'continue';
        $options = [];
        try {
            if ($gateway->isEnabled() || Config::aiMock()) {
                // Forzar mock path cuando AI_MOCK
                $gw = Config::aiMock() ? AiGateway::fromConfig() : $gateway;
                $result = $gw->complete($messages, ['purpose' => 'dialogue', 'child_id' => $childId]);
                $modelUsed = $result['model'];
                $parsed = json_decode($result['content'], true);
                if (is_array($parsed)) {
                    $text = Utf8Text::normalize((string) ($parsed['agent_text'] ?? $text));
                    $inputMode = (string) ($parsed['input_mode'] ?? $inputMode);
                    $options = is_array($parsed['options'] ?? null) ? $parsed['options'] : [];
                }
            }
        } catch (\Throwable) {
            $text = 'Tu mentor medita un momento. ¿Seguimos?';
        }

        return $this->insertTurn($pdo, [
            'session_id' => $sessionId,
            'child_id' => $childId,
            'flow_id' => $flowId,
            'sequence' => $sequence,
            'role' => 'mentor',
            'text' => $text,
            'input_mode' => $inputMode,
            'options' => $options,
            'explorer_reply' => null,
            'meta' => ['mentor_id' => $mentorId],
            'model_used' => $modelUsed,
        ]);
    }

    private function mentorProseRules(): string
    {
        $path = dirname(__DIR__, 3) . '/shared/Ai/prompts/_mentor_prose_rules.es.md';
        if (!is_readable($path)) {
            return 'Di «preparar / diseñar / componer la prueba»; nunca «armar un examen».';
        }

        $raw = file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            return 'Di «preparar / diseñar / componer la prueba»; nunca «armar un examen».';
        }

        return trim(preg_replace('/^#.*$/m', '', $raw) ?? $raw);
    }

    /** @param array<string,mixed> $child */
    private function seedOpeningTurn(
        PDO $pdo,
        string $sessionId,
        string $childId,
        string $flowId,
        string $mentorId,
        array $child,
    ): void {
        $step = (string) ($child['onboarding_step'] ?? 'pending_entry');
        if ($step !== 'pending_entry' && $step !== 'choose_world') {
            return;
        }

        $this->insertTurn($pdo, [
            'session_id' => $sessionId,
            'child_id' => $childId,
            'flow_id' => $flowId,
            'sequence' => 1,
            'role' => 'mentor',
            'text' => 'Bienvenido al umbral del viaje. Primero elige el mundo que habitarás.',
            'input_mode' => 'options_only',
            'options' => $this->worldThemeOptions(),
            'explorer_reply' => null,
            'meta' => ['phase' => 'choose_world', 'mentor_id' => $mentorId],
            'model_used' => null,
        ]);
        if ($step === 'pending_entry') {
            $this->setOnboarding($pdo, $childId, 'choose_world');
        }
    }

    /** @return list<array{id:string,label:string}> */
    private function nameSuggestionOptions(array $child): array
    {
        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $pool = $theme === 'sci-fi'
            ? ['Nova', 'Orion', 'Lyra', 'Pulsar', 'Cometa']
            : ['Luna', 'Bruno', 'Nerea', 'Leo', 'Alba'];

        $options = [];
        foreach ($pool as $label) {
            $options[] = ['id' => mb_strtolower($label, 'UTF-8'), 'label' => $label];
        }
        $options[] = ['id' => 'custom', 'label' => 'Escribir otro nombre'];

        return $options;
    }

    /**
     * @param list<array{id:string,label:string}> $options
     */
    private function resolveOptionLabel(string $optionId, array $options): string
    {
        if ($optionId === '') {
            return '';
        }

        foreach ($options as $opt) {
            if (($opt['id'] ?? '') === $optionId) {
                return (string) ($opt['label'] ?? $optionId);
            }
        }

        foreach ($this->worldThemeOptions() as $opt) {
            if (($opt['id'] ?? '') === $optionId) {
                return (string) ($opt['label'] ?? $optionId);
            }
        }

        return $optionId;
    }

    /** @return list<array{id:string,label:string,description:string}> */
    private function worldThemeOptions(): array
    {
        return [
            [
                'id' => 'sci-fi',
                'label' => 'Ciencia ficción',
                'description' => 'Naves, planetas y galaxias: serás cadete explorador en una misión por las estrellas.',
            ],
            [
                'id' => 'fantasy',
                'label' => 'Fantasía',
                'description' => 'Magia, reinos y artefactos: tu camino pasa por bosques, montañas y castillos.',
            ],
        ];
    }

    /** @return list<array{id:string,label:string}> */
    private function ageOptions(): array
    {
        $opts = [];
        foreach ([6, 7, 8, 9, 10, 12, 15, 18, 30, 50, 70] as $age) {
            $opts[] = ['id' => (string) $age, 'label' => (string) $age];
        }

        return $opts;
    }

    /** @param array<string,mixed> $reply */
    private function parseAge(array $reply): int
    {
        if (isset($reply['option_id']) && is_numeric($reply['option_id'])) {
            return (int) $reply['option_id'];
        }
        $text = trim((string) ($reply['text'] ?? ''));
        if (preg_match('/\d{1,3}/', $text, $m) === 1) {
            return (int) $m[0];
        }
        throw new InvalidArgumentException('age invalid');
    }

    private function setOnboarding(PDO $pdo, string $childId, string $step): void
    {
        $pdo->prepare('update children set onboarding_step = :s, updated_at = now() where id = :id')
            ->execute(['s' => $step, 'id' => $childId]);
    }

    private function nextSequence(PDO $pdo, string $sessionId): int
    {
        $stmt = $pdo->prepare('select coalesce(max(sequence), 0) from dialogue_turns where session_id = :id');
        $stmt->execute(['id' => $sessionId]);

        return ((int) $stmt->fetchColumn()) + 1;
    }

    /**
     * @param array{
     *   session_id:string,child_id:string,flow_id:string,sequence:int,role:string,text:string,
     *   input_mode:?string,options?:?list<array{id:string,label:string}>,explorer_reply?:?array,
     *   meta:array,model_used:?string
     * } $row
     * @return array<string,mixed>
     */
    private function insertTurn(PDO $pdo, array $row): array
    {
        $stmt = $pdo->prepare(
            'insert into dialogue_turns (
                session_id, child_id, flow_id, sequence, role, text, options, input_mode,
                explorer_reply, meta, model_used
             ) values (
                :session_id, :child_id, :flow_id, :sequence, :role, :text, :options::jsonb, :input_mode,
                :explorer_reply::jsonb, :meta::jsonb, :model_used
             ) returning *'
        );
        $stmt->execute([
            'session_id' => $row['session_id'],
            'child_id' => $row['child_id'],
            'flow_id' => $row['flow_id'],
            'sequence' => $row['sequence'],
            'role' => $row['role'],
            'text' => Utf8Text::normalize((string) $row['text']),
            'options' => isset($row['options']) ? json_encode($row['options'], JSON_UNESCAPED_UNICODE) : null,
            'input_mode' => $row['input_mode'] ?? null,
            'explorer_reply' => isset($row['explorer_reply'])
                ? json_encode($row['explorer_reply'], JSON_UNESCAPED_UNICODE)
                : null,
            'meta' => json_encode($row['meta'] ?? [], JSON_UNESCAPED_UNICODE),
            'model_used' => $row['model_used'] ?? null,
        ]);
        $saved = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($saved === false) {
            throw new RuntimeException('Could not insert turn');
        }

        return $this->mapTurn($saved);
    }

    /** @return list<array<string,mixed>> */
    private function loadTurns(PDO $pdo, string $sessionId): array
    {
        $stmt = $pdo->prepare(
            'select * from dialogue_turns where session_id = :id order by sequence asc'
        );
        $stmt->execute(['id' => $sessionId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(fn (array $r): array => $this->mapTurn($r), $rows ?: []);
    }

    /** @param array<string,mixed> $row */
    private function mapTurn(array $row): array
    {
        $options = $row['options'] ?? null;
        if (is_string($options)) {
            $options = json_decode($options, true);
        }
        $reply = $row['explorer_reply'] ?? null;
        if (is_string($reply)) {
            $reply = json_decode($reply, true);
        }
        $meta = $row['meta'] ?? [];
        if (is_string($meta)) {
            $meta = json_decode($meta, true) ?: [];
        }

        return [
            'id' => (string) $row['id'],
            'child_id' => (string) $row['child_id'],
            'session_id' => (string) $row['session_id'],
            'flow_id' => (string) $row['flow_id'],
            'sequence' => (int) $row['sequence'],
            'role' => (string) $row['role'],
            'text' => Utf8Text::normalize((string) $row['text']),
            'options' => is_array($options) ? $options : null,
            'input_mode' => $row['input_mode'] ?? null,
            'explorer_reply' => is_array($reply) ? $reply : null,
            'meta' => is_array($meta) ? $meta : [],
            'model_used' => $row['model_used'] ?? null,
            'created_at' => (string) ($row['created_at'] ?? ''),
        ];
    }

    /**
     * @param array{kind:string,option_id?:string,text?:string} $reply
     * @param array<string,mixed> $child
     * @return list<array<string,mixed>>
     */
    private function handlePlacementAnswer(
        PDO $pdo,
        string $childId,
        array $child,
        string $sessionId,
        int $sequence,
        string $mentorId,
        array $reply,
    ): array {
        $placement = PlacementService::withDefaultBank($pdo);
        $result = $placement->answer($childId, $child, $sessionId, 'placement', $sequence, $mentorId, $reply);
        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $turns = [];
        $n = $sequence;

        $feedbackMeta = ['phase' => 'placement_feedback'];
        if (isset($result['index'], $result['total'])) {
            $feedbackMeta['index'] = (int) $result['index'];
            $feedbackMeta['total'] = (int) $result['total'];
        }

        $turns[] = $this->insertTurn($pdo, [
            'session_id' => $sessionId,
            'child_id' => $childId,
            'flow_id' => 'placement',
            'sequence' => $n++,
            'role' => 'mentor',
            'text' => (string) ($result['feedback'] ?? ''),
            'input_mode' => 'continue',
            'options' => null,
            'explorer_reply' => null,
            'meta' => $feedbackMeta,
            'model_used' => null,
        ]);

        if (!empty($result['complete'])) {
            foreach ($result['closing_turns'] ?? [] as $payload) {
                $turns[] = $this->insertTurn($pdo, [
                    'session_id' => $sessionId,
                    'child_id' => $childId,
                    'flow_id' => 'placement',
                    'sequence' => $n++,
                    'role' => 'mentor',
                    'text' => (string) ($payload['text'] ?? ''),
                    'input_mode' => $payload['input_mode'] ?? 'options_only',
                    'options' => $payload['options'] ?? null,
                    'explorer_reply' => null,
                    'meta' => $payload['meta'] ?? [],
                    'model_used' => null,
                ]);
            }
            // stash effects on first turn meta for caller — better return tuple; use private property hack via effects in submitTurn
            $this->lastEffects = $result['effects'] ?? [];

            return $turns;
        }

        $next = $result['next_item'] ?? null;
        if (is_array($next)) {
            $turns[] = $this->insertTurn(
                $pdo,
                $placement->itemToTurn(
                    $sessionId,
                    $childId,
                    'placement',
                    $n,
                    $mentorId,
                    (string) ($result['theme'] ?? $theme),
                    $next,
                    (int) ($result['index'] ?? 0),
                    (int) ($result['total'] ?? 1),
                    $child,
                )
            );
        }
        $this->lastEffects = $result['effects'] ?? [];

        return $turns;
    }

    /** @return array<string,mixed>|null */
    private function lastMentorTurn(PDO $pdo, string $sessionId): ?array
    {
        $stmt = $pdo->prepare(
            "select * from dialogue_turns
             where session_id = :id and role in ('mentor','agent')
             order by sequence desc limit 1"
        );
        $stmt->execute(['id' => $sessionId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row === false) {
            return null;
        }

        return $this->mapTurn($row);
    }

    private function hasOpenExam(PDO $pdo, string $childId): bool
    {
        $stmt = $pdo->prepare(
            "select 1 from placement_exams where child_id = :cid and status = 'in_progress' limit 1"
        );
        $stmt->execute(['cid' => $childId]);

        return (bool) $stmt->fetchColumn();
    }

    private function pdo(): PDO
    {
        return $this->pdo ?? PdoFactory::fromConfig()
            ?? throw new RuntimeException('DATABASE_URL not configured');
    }

    private function crew(): CrewService
    {
        return $this->crew ?? new CrewService($this->pdo());
    }

    private function gateway(): AiGateway
    {
        return $this->gateway ?? AiGateway::fromConfig();
    }
}
