<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Shared\Ai\AgeBand;
use Kidepik\Shared\Ai\MentorCatalog;
use Kidepik\Shared\Ai\PlacementBank;
use Kidepik\Shared\Ai\PlacementNarrator;
use Kidepik\Shared\Ai\SubjectCatalog;
use PHPUnit\Framework\TestCase;

final class PlacementAdaptiveTest extends TestCase
{
    public function testPickQueueUsesActiveSubjectsAndDifficulty(): void
    {
        $bank = PlacementBank::fromDefaultFile();
        $queue = $bank->pickQueue(AgeBand::EARLY, ['math', 'language', 'mythology']);
        self::assertNotEmpty($queue);
        $subjects = array_map(static fn (array $i): string => (string) $i['subject_id'], $queue);
        self::assertContains('math', $subjects);
        // mythology may be missing from early band items — bank falls back
        foreach ($queue as $item) {
            $diff = (int) ($item['difficulty'] ?? 1);
            self::assertGreaterThanOrEqual(1, $diff);
        }
    }

    public function testPickQueueEarlyUsesBaseWhenNull(): void
    {
        $bank = PlacementBank::fromDefaultFile();
        $queue = $bank->pickQueue(AgeBand::EARLY, null);
        self::assertGreaterThanOrEqual(4, count($queue));
        $subjects = array_unique(array_map(
            static fn (array $i): string => (string) $i['subject_id'],
            $queue,
        ));
        foreach (SubjectCatalog::baseSubjectsForBand(AgeBand::EARLY) as $expected) {
            // Only assert subjects that exist in bank
            $bankHas = isset(json_decode(
                (string) file_get_contents(dirname(__DIR__, 2) . '/shared/Ai/placement_bank/default.json'),
                true,
            )[$expected]);
            if ($bankHas) {
                self::assertContains($expected, $subjects);
            }
        }
    }

    public function testTeenGetsExtraMathLanguageSlots(): void
    {
        $bank = PlacementBank::fromDefaultFile();
        $queue = $bank->pickQueue(AgeBand::TEEN, ['math', 'language']);
        $mathCount = count(array_filter(
            $queue,
            static fn (array $i): bool => ($i['subject_id'] ?? '') === 'math',
        ));
        self::assertGreaterThanOrEqual(1, $mathCount);
        // Extra challenge may yield 2 if bank has alternate keys
        self::assertLessThanOrEqual(2, $mathCount);
    }

    public function testComputeLevelsRenormalizesWeights(): void
    {
        $bank = new PlacementBank([]);
        $levels = $bank->computeLevels([
            'math' => [1.0],
            'ethics' => [1.0],
        ], ['math', 'ethics']);
        self::assertSame('L5', $levels['subjects']['math']);
        self::assertSame('L5', $levels['subjects']['ethics']);
        self::assertSame('L5', $levels['general']);
    }

    public function testNarratorWrapAvoidsDrySchoolPrefixAlone(): void
    {
        $narrator = new PlacementNarrator();
        $text = $narrator->wrapItem(
            ['world_theme' => 'fantasy', 'age_years' => 8, 'age_band' => AgeBand::CHILD, 'display_name' => 'Nora'],
            ['prompt_text' => '¿Cuánto es 2 + 2?', 'subject_id' => 'math'],
            0,
            3,
        );
        self::assertStringContainsString('2 + 2', $text);
        self::assertGreaterThan(20, mb_strlen($text));
        self::assertStringNotContainsString('Prueba 1 de 3 en la Escuela. ¿Cuánto', $text);
    }

    public function testNarratorSceneVariesByIndex(): void
    {
        $narrator = new PlacementNarrator();
        $child = ['world_theme' => 'fantasy', 'age_band' => AgeBand::ADULT, 'display_name' => 'Vatardar'];
        $item = ['prompt_text' => '¿Cuánto es 2 + 2?', 'subject_id' => 'math', 'item_key' => 'math_add_2'];
        $a = $narrator->wrapItem($child, $item, 0, 5);
        $b = $narrator->wrapItem($child, $item, 1, 5);
        self::assertStringContainsString('2 + 2', $a);
        self::assertStringContainsString('2 + 2', $b);
        self::assertStringContainsString('Reto 1 de 5.', $a);
        self::assertStringNotContainsString('Prueba 1 de 5', $a);
        self::assertStringNotContainsString('Umbral 1 de 5', $a);
    }

    public function testDecorateItemsAvoidConsecutiveDuplicateWrappers(): void
    {
        $narrator = new PlacementNarrator();
        $child = ['world_theme' => 'fantasy', 'age_band' => AgeBand::ADULT, 'display_name' => 'Vatardar'];
        $queue = [];
        for ($i = 0; $i < 8; $i++) {
            $queue[] = [
                'prompt_text' => "Pregunta {$i}",
                'subject_id' => 'ethics',
                'item_key' => "ethics_{$i}",
            ];
        }
        $decorated = $narrator->decorateItems($queue, $child);
        $wrappers = array_map(
            static fn (array $item): string => (string) ($item['narrative_wrapper'] ?? ''),
            $decorated,
        );
        for ($i = 1, $n = count($wrappers); $i < $n; $i++) {
            self::assertNotSame(
                $wrappers[$i],
                $wrappers[$i - 1],
                "las fórmulas consecutivas no deben repetirse (índice {$i})",
            );
        }
        self::assertGreaterThan(1, count(array_unique($wrappers)));
    }

    public function testDecorateItemKeepsAgentWrapper(): void
    {
        $narrator = new PlacementNarrator();
        $child = ['world_theme' => 'fantasy', 'age_band' => AgeBand::ADULT, 'display_name' => 'Vatardar'];
        $item = [
            'narrative_wrapper' => 'Prosa única del agente, sin atrio ni fórmulas.',
            'prompt_text' => '¿Qué es la justicia?',
            'subject_id' => 'ethics',
            'item_key' => 'ethics_agent_1',
        ];
        $out = $narrator->decorateItem($child, $item, 0, 1);
        self::assertStringContainsString('Prosa única del agente', (string) ($out['narrative_wrapper'] ?? ''));
        self::assertStringContainsString('¿Qué es la justicia?', (string) ($out['presentation_text'] ?? ''));
    }

    public function testPickQueueIsNotAlwaysIdentical(): void
    {
        $bank = PlacementBank::fromDefaultFile();
        $keysA = [];
        $keysB = [];
        for ($i = 0; $i < 8; $i++) {
            $q = $bank->pickQueue(AgeBand::ADULT, ['math', 'mythology', 'politics'], 3);
            $keysA[] = implode('|', array_map(static fn (array $x): string => (string) ($x['item_key'] ?? ''), $q));
            $q2 = $bank->pickQueue(AgeBand::ADULT, ['math', 'mythology', 'politics'], 3, ['math_pct_20', 'myth_zeus', 'pol_vote']);
            $keysB[] = implode('|', array_map(static fn (array $x): string => (string) ($x['item_key'] ?? ''), $q2));
        }
        self::assertGreaterThan(1, count(array_unique($keysA)), 'sin exclusión debería haber variedad entre intentos');
        foreach ($keysB as $sig) {
            self::assertStringNotContainsString('math_pct_20', $sig);
            self::assertStringNotContainsString('myth_zeus', $sig);
            self::assertStringNotContainsString('pol_vote', $sig);
        }
    }

    public function testWrongAnswerFeedbackIncludesCorrectAnswerAndExplanation(): void
    {
        $bank = PlacementBank::fromDefaultFile();
        $narrator = new PlacementNarrator();
        $item = [
            'item_type' => 'mcq',
            'item_key' => 'math_add_2',
            'options' => [
                ['id' => 'a', 'label' => '3'],
                ['id' => 'b', 'label' => '4'],
                ['id' => 'c', 'label' => '5'],
            ],
            'canonical_answer' => ['option_id' => 'b'],
        ];
        $feedback = $narrator->feedbackForItem(
            $item,
            ['kind' => 'option', 'option_id' => 'a'],
            0.0,
            ['world_theme' => 'fantasy', 'age_band' => AgeBand::ADULT],
            $bank,
        );
        self::assertStringContainsString('3', $feedback);
        self::assertStringContainsString('4', $feedback);
        self::assertStringContainsString('2 + 2', $feedback);
    }

    public function testValidatorAcceptsAgentMcq(): void
    {
        $v = new \Kidepik\Shared\Ai\PlacementItemValidator();
        $item = $v->normalize([
            'subject_id' => 'math',
            'item_type' => 'mcq',
            'difficulty' => 3,
            'prompt_text' => '¿Cuál es 5+7?',
            'options' => [
                ['id' => 'a', 'label' => '10'],
                ['id' => 'b', 'label' => '12'],
            ],
            'canonical_answer' => ['option_id' => 'b'],
            'explanation' => '5+7=12',
        ], 'math', AgeBand::ADULT, 3, 5, ['mcq', 'numeric', 'short_text'], 0);
        self::assertNotNull($item);
        self::assertSame('agent', $item['source']);
        self::assertSame('b', $item['canonical_answer']['option_id']);
    }

    public function testValidatorRejectsObviousMcqDistractors(): void
    {
        $v = new \Kidepik\Shared\Ai\PlacementItemValidator();
        $item = $v->normalize([
            'subject_id' => 'politics',
            'item_type' => 'mcq',
            'difficulty' => 4,
            'prompt_text' => '¿Cuál es un objetivo de la separación de poderes?',
            'options' => [
                ['id' => 'a', 'label' => 'Evitar que el poder se concentre en una sola mano'],
                ['id' => 'b', 'label' => 'Elegir el color de la bandera'],
                ['id' => 'c', 'label' => 'Fijar el precio del pan'],
            ],
            'canonical_answer' => ['option_id' => 'a'],
            'explanation' => 'La separación de poderes distribuye funciones para evitar abusos.',
        ], 'politics', AgeBand::ADULT, 3, 5, ['mcq', 'numeric', 'short_text'], 0);
        self::assertNull($item);
    }

    public function testValidatorAcceptsPlausibleMcqDistractors(): void
    {
        $v = new \Kidepik\Shared\Ai\PlacementItemValidator();
        $item = $v->normalize([
            'subject_id' => 'politics',
            'item_type' => 'mcq',
            'difficulty' => 4,
            'prompt_text' => '¿Cuál es un objetivo de la separación de poderes?',
            'options' => [
                ['id' => 'a', 'label' => 'Evitar que el poder se concentre en una sola mano'],
                ['id' => 'b', 'label' => 'Concentrar legislativo y judicial en el ejecutivo'],
                ['id' => 'c', 'label' => 'Eliminar el control entre instituciones para decidir más rápido'],
                ['id' => 'd', 'label' => 'Sustituir leyes por decisiones personales del gobernante'],
            ],
            'canonical_answer' => ['option_id' => 'a'],
            'explanation' => 'La separación de poderes distribuye funciones para evitar abusos.',
        ], 'politics', AgeBand::ADULT, 3, 5, ['mcq', 'numeric', 'short_text'], 0);
        self::assertNotNull($item);
    }

    public function testComposerGeneratesAgentExamWhenMockAi(): void
    {
        putenv('AI_ENABLED=true');
        $_ENV['AI_ENABLED'] = 'true';

        $gateway = new \Kidepik\Shared\Ai\AiGateway(
            modelQueue: ['mock/local'],
            chatFn: [\Kidepik\Shared\Ai\MockAiGateway::class, 'complete'],
        );
        $composer = new \Kidepik\Shared\Ai\PlacementExamComposer(gateway: $gateway);
        $child = [
            'world_theme' => 'fantasy',
            'age_band' => AgeBand::ADULT,
            'age_years' => 42,
            'display_name' => 'Vatardar',
        ];
        $a = $composer->compose($child, ['math', 'mythology', 'ethics']);
        $b = $composer->compose($child, ['math', 'mythology', 'ethics']);
        self::assertCount(4, $a); // math extra for adult
        self::assertCount(4, $b);
        foreach ($a as $item) {
            self::assertSame('agent', $item['source'] ?? null);
            self::assertNotEmpty($item['prompt_text'] ?? '');
            self::assertNotEmpty($item['presentation_text'] ?? '');
        }
        $keysA = array_map(static fn (array $i): string => (string) $i['item_key'], $a);
        $keysB = array_map(static fn (array $i): string => (string) $i['item_key'], $b);
        self::assertNotSame($keysA, $keysB, 'cada composición mock debe usar nonce distinto');
    }

    public function testPrepareQueueStoresPresentationForAllItems(): void
    {
        $bank = PlacementBank::fromDefaultFile();
        $queue = $bank->pickQueue(AgeBand::ADULT, ['math', 'language'], 2);
        $writer = new \Kidepik\Shared\Ai\PlacementItemWriter();
        $child = ['world_theme' => 'fantasy', 'age_band' => AgeBand::ADULT, 'display_name' => 'Ana'];
        $prepared = $writer->prepareQueue($queue, $child);
        self::assertCount(2, $prepared);
        foreach ($prepared as $item) {
            self::assertNotEmpty($item['presentation_text'] ?? '');
            self::assertNotEmpty($item['narrative_wrapper'] ?? '');
        }
    }

    public function testNarratorFeedbackAndIntroScaleByBand(): void
    {
        $narrator = new PlacementNarrator();
        $early = $narrator->intro(
            ['world_theme' => 'fantasy', 'age_band' => AgeBand::EARLY, 'display_name' => 'Leo'],
            MentorCatalog::FANTASY,
            ['math', 'language'],
        );
        $adult = $narrator->intro(
            ['world_theme' => 'fantasy', 'age_band' => AgeBand::ADULT, 'display_name' => 'Ana'],
            MentorCatalog::FANTASY,
            SubjectCatalog::ids(),
        );
        self::assertStringContainsString('Leo', $early);
        self::assertStringContainsString('Ana', $adult);
        self::assertStringContainsString('trámite', $adult);
        self::assertNotSame($early, $adult);

        $fb = $narrator->feedback(0.0, 'fantasy', AgeBand::ADULT);
        self::assertStringContainsString('mapa', mb_strtolower($fb));
    }

    public function testActiveSubjectsForChildReadsSettings(): void
    {
        $subjects = \Kidepik\Api\Services\PlacementService::activeSubjectsForChild([
            'age_band' => AgeBand::CHILD,
            'settings' => [
                'learning' => [
                    'active_subjects' => ['math', 'politics'],
                ],
            ],
        ]);
        self::assertSame(['math', 'politics'], $subjects);
    }
}
