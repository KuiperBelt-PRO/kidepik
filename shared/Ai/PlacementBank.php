<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

/**
 * Banco de ítems de placement + scoring PHP (SPEC_APP_PLACEMENT_EXAM + SUBJECT_CATALOG).
 */
final class PlacementBank
{
    /** @deprecated use SubjectCatalog::ALL */
    public const SUBJECTS = SubjectCatalog::ALL;

    /** @deprecated use SubjectCatalog::WEIGHTS */
    public const WEIGHTS = SubjectCatalog::WEIGHTS;

    /** @param array<string,mixed>|null $decoded */
    public function __construct(private ?array $decoded = null)
    {
    }

    public static function fromDefaultFile(): self
    {
        $path = __DIR__ . '/placement_bank/default.json';
        $raw = is_readable($path) ? file_get_contents($path) : false;
        $data = is_string($raw) ? json_decode($raw, true) : null;

        return new self(is_array($data) ? $data : []);
    }

    /**
     * @param list<string>|null $activeSubjects
     * @param list<string> $recentKeys ítems recientes del tripulante a evitar si hay alternativas
     * @return list<array<string,mixed>>
     */
    public function pickQueue(
        string $ageBand,
        ?array $activeSubjects = null,
        ?int $maxItems = null,
        array $recentKeys = [],
    ): array {
        if ($activeSubjects === null || $activeSubjects === []) {
            $subjects = SubjectCatalog::baseSubjectsForBand($ageBand);
        } else {
            try {
                $subjects = SubjectCatalog::normalizeActiveSubjects($activeSubjects);
            } catch (\InvalidArgumentException) {
                $subjects = SubjectCatalog::baseSubjectsForBand($ageBand);
            }
        }

        $extras = SubjectCatalog::extraChallengeSubjects($ageBand);
        $queuePlan = [];
        foreach ($subjects as $subject) {
            $queuePlan[] = $subject;
            if (in_array($subject, $extras, true)) {
                $queuePlan[] = $subject;
            }
        }

        // Orden de materias aleatorio (no siempre math→language→…)
        $this->shuffleList($queuePlan);

        if ($maxItems !== null && $maxItems > 0) {
            $queuePlan = array_slice($queuePlan, 0, $maxItems);
        }

        $queue = [];
        $usedKeys = [];
        [$minDiff, $maxDiff] = SubjectCatalog::difficultyRange($ageBand);
        $softExclude = array_values(array_unique(array_filter(
            $recentKeys,
            static fn ($k): bool => is_string($k) && $k !== '',
        )));

        foreach ($queuePlan as $subject) {
            $hardExclude = $usedKeys;
            $item = $this->pickOne($subject, $ageBand, $minDiff, $maxDiff, array_merge($hardExclude, $softExclude));
            if ($item === null && $softExclude !== []) {
                // Si todo el pool reciente está agotado, permitir repetición fuera de usedKeys.
                $item = $this->pickOne($subject, $ageBand, $minDiff, $maxDiff, $hardExclude);
            }
            if ($item !== null) {
                $key = (string) ($item['item_key'] ?? '');
                if ($key !== '') {
                    $usedKeys[] = $key;
                }
                $queue[] = $item;
            }
        }

        return $queue;
    }

    /**
     * @param list<string> $excludeKeys
     * @return array<string,mixed>|null
     */
    private function pickOne(
        string $subject,
        string $ageBand,
        int $minDiff,
        int $maxDiff,
        array $excludeKeys,
    ): ?array {
        $bank = $this->decoded[$subject] ?? [];
        if (!is_array($bank)) {
            return null;
        }

        $bandMatched = [];
        foreach ($bank as $row) {
            if (!is_array($row)) {
                continue;
            }
            $key = (string) ($row['item_key'] ?? '');
            if ($key !== '' && in_array($key, $excludeKeys, true)) {
                continue;
            }
            $bands = $row['bands'] ?? null;
            if (is_array($bands) && $bands !== [] && !in_array($ageBand, $bands, true)) {
                continue;
            }
            $bandMatched[] = $row;
        }

        if ($bandMatched === []) {
            foreach ($bank as $row) {
                if (!is_array($row)) {
                    continue;
                }
                $key = (string) ($row['item_key'] ?? '');
                if ($key !== '' && in_array($key, $excludeKeys, true)) {
                    continue;
                }
                $bandMatched[] = $row;
            }
        }

        if ($bandMatched === []) {
            return null;
        }

        $inRange = [];
        foreach ($bandMatched as $row) {
            $diff = (int) ($row['difficulty'] ?? 1);
            if ($diff >= $minDiff && $diff <= $maxDiff) {
                $inRange[] = $row;
            }
        }

        $pool = $inRange !== [] ? $inRange : $bandMatched;
        $mid = (int) floor(($minDiff + $maxDiff) / 2);

        // Peso: más cerca de la dificultad media → más probabilidad, pero NUNCA fijo el primero.
        $weighted = [];
        foreach ($pool as $row) {
            $dist = abs(((int) ($row['difficulty'] ?? 1)) - $mid);
            $weight = max(1, 5 - $dist);
            for ($i = 0; $i < $weight; $i++) {
                $weighted[] = $row;
            }
        }
        $this->shuffleList($weighted);
        $chosen = $weighted[0];
        $chosen['subject_id'] = $subject;

        return $chosen;
    }

    /** @param list<mixed> $list */
    private function shuffleList(array &$list): void
    {
        if (count($list) < 2) {
            return;
        }
        // Fisher–Yates con random_int (criptográficamente fuerte; evita sesgo mt_rand en tests locales).
        for ($i = count($list) - 1; $i > 0; $i--) {
            $j = random_int(0, $i);
            [$list[$i], $list[$j]] = [$list[$j], $list[$i]];
        }
    }

    /**
     * @param array<string,mixed> $item
     * @param array{kind:string,option_id?:string,text?:string} $reply
     */
    public function score(array $item, array $reply): float
    {
        $type = (string) ($item['item_type'] ?? 'mcq');
        $canonical = is_array($item['canonical_answer'] ?? null) ? $item['canonical_answer'] : [];

        if ($type === 'mcq') {
            $want = (string) ($canonical['option_id'] ?? '');
            $got = (string) ($reply['option_id'] ?? '');

            return ($want !== '' && $want === $got) ? 1.0 : 0.0;
        }

        if ($type === 'numeric') {
            $want = (float) ($canonical['numeric'] ?? 0);
            $tol = (float) ($canonical['tolerance'] ?? 0);
            $raw = $reply['text'] ?? $reply['option_id'] ?? '';
            if (!is_numeric((string) $raw)) {
                return 0.0;
            }
            $got = (float) $raw;

            return abs($got - $want) <= $tol ? 1.0 : 0.0;
        }

        $text = mb_strtolower(trim((string) ($reply['text'] ?? '')));
        $keywords = $canonical['keywords'] ?? [];
        if (!is_array($keywords) || $keywords === []) {
            return $text !== '' ? 0.5 : 0.0;
        }
        foreach ($keywords as $kw) {
            if (!is_string($kw)) {
                continue;
            }
            if ($text === mb_strtolower($kw) || str_contains($text, mb_strtolower($kw))) {
                return 1.0;
            }
        }

        return $text !== '' ? 0.0 : 0.0;
    }

    /**
     * Etiqueta legible de la respuesta del explorador.
     *
     * @param array<string,mixed> $item
     * @param array{kind?:string,option_id?:string,text?:string} $reply
     */
    public function replyLabel(array $item, array $reply): ?string
    {
        $type = (string) ($item['item_type'] ?? 'mcq');

        if ($type === 'mcq') {
            $got = (string) ($reply['option_id'] ?? '');
            if ($got === '') {
                return null;
            }
            foreach ($item['options'] ?? [] as $opt) {
                if (!is_array($opt)) {
                    continue;
                }
                if ((string) ($opt['id'] ?? '') === $got) {
                    return (string) ($opt['label'] ?? $got);
                }
            }

            return $got;
        }

        $text = trim((string) ($reply['text'] ?? ''));
        if ($text !== '') {
            return $text;
        }
        $opt = trim((string) ($reply['option_id'] ?? ''));

        return $opt !== '' ? $opt : null;
    }

    /**
     * Etiqueta legible de la respuesta correcta canónica.
     *
     * @param array<string,mixed> $item
     */
    public function correctAnswerLabel(array $item): string
    {
        $type = (string) ($item['item_type'] ?? 'mcq');
        $canonical = is_array($item['canonical_answer'] ?? null) ? $item['canonical_answer'] : [];

        if ($type === 'mcq') {
            $want = (string) ($canonical['option_id'] ?? '');
            foreach ($item['options'] ?? [] as $opt) {
                if (!is_array($opt)) {
                    continue;
                }
                if ((string) ($opt['id'] ?? '') === $want) {
                    return (string) ($opt['label'] ?? $want);
                }
            }

            return $want !== '' ? $want : 'la opción correcta';
        }

        if ($type === 'numeric') {
            $n = $canonical['numeric'] ?? null;

            return is_numeric((string) $n) ? (string) $n : 'el valor correcto';
        }

        $keywords = $canonical['keywords'] ?? [];
        if (is_array($keywords) && $keywords !== []) {
            $parts = array_values(array_filter($keywords, static fn ($k): bool => is_string($k) && $k !== ''));

            return $parts !== [] ? implode(' / ', $parts) : 'la respuesta esperada';
        }

        return 'la respuesta esperada';
    }

    /**
     * Explicación pedagógica breve (banco o derivada).
     *
     * @param array<string,mixed> $item
     */
    public function explanationText(array $item): string
    {
        $stored = trim((string) ($item['explanation'] ?? ''));
        if ($stored !== '') {
            return $stored;
        }

        $key = (string) ($item['item_key'] ?? '');
        $derived = match ($key) {
            'math_add_2' => '2 + 2 suma dos unidades más dos unidades, y el resultado es 4.',
            'math_mul_7' => '7 × 3 es sumar siete tres veces: 7 + 7 + 7 = 21.',
            'math_pct_20' => 'El 20 % de 50 es la quinta parte de 50: 50 ÷ 5 = 10.',
            'math_frac_half' => '3/4 y 1/4 comparten el mismo denominador; al sumar numeradores obtienes 4/4 = 1.',
            'math_prop_speed' => 'A 60 km/h de media, en 5 horas recorres 60 × 5 = 300 km.',
            'math_avg_speed' => 'Velocidad = distancia ÷ tiempo: 90 ÷ 1,5 = 60 km/h.',
            'math_ratio_mix' => '3 de cada 5 es el 60 %; el 60 % de 20 es 12.',
            'lang_syn_feliz' => '«Alegre» comparte el sentido de contento o feliz; «triste» y «rápido» no.',
            'lang_plural' => 'Las palabras en -z forman el plural en -ces: luz → luces.',
            'lang_homophone' => '«Haber» es el verbo; «a ver» y «aver» no sustituyen esa forma.',
            'lang_antonym' => '«Abundante» expresa lo contrario de «escaso».',
            default => '',
        };
        if ($derived !== '') {
            return $derived;
        }

        $type = (string) ($item['item_type'] ?? 'mcq');
        if ($type === 'mcq') {
            return 'Repasa el enunciado: solo una opción encaja con lo que se pregunta.';
        }
        if ($type === 'numeric') {
            return 'Comprueba las operaciones paso a paso antes de responder.';
        }

        return 'Piensa en la regla o la pista del enunciado antes de seguir.';
    }

    /**
     * @param array<string,list<float>> $scoresBySubject
     * @param list<string>|null $activeSubjects
     * @return array{subjects:array<string,string>,general:string}
     */
    public function computeLevels(array $scoresBySubject, ?array $activeSubjects = null): array
    {
        $levels = [];
        $subjects = $activeSubjects !== null && $activeSubjects !== []
            ? SubjectCatalog::normalizeActiveSubjects($activeSubjects)
            : array_keys($scoresBySubject);

        foreach ($subjects as $subject) {
            $scores = $scoresBySubject[$subject] ?? [];
            if ($scores === []) {
                continue;
            }
            $avg = array_sum($scores) / count($scores);
            $levels[$subject] = $this->scoreToLevel($avg);
        }

        // Also include any scored subjects not in active list (legacy exams)
        foreach ($scoresBySubject as $subject => $scores) {
            if (isset($levels[$subject]) || $scores === []) {
                continue;
            }
            if (!SubjectCatalog::isValid($subject)) {
                continue;
            }
            $avg = array_sum($scores) / count($scores);
            $levels[$subject] = $this->scoreToLevel($avg);
        }

        $active = array_keys($levels);
        if ($active === []) {
            return ['subjects' => [], 'general' => 'L1'];
        }

        $weights = SubjectCatalog::renormalizeWeights($active);
        $weighted = 0.0;
        foreach ($active as $subject) {
            $weighted += ($weights[$subject] ?? 0.0) * $this->levelIndex($levels[$subject]);
        }
        $g = (int) round($weighted);
        $g = max(1, min(5, $g));

        return ['subjects' => $levels, 'general' => 'L' . $g];
    }

    public function scoreToLevel(float $score): string
    {
        return match (true) {
            $score < 0.35 => 'L1',
            $score < 0.55 => 'L2',
            $score < 0.70 => 'L3',
            $score < 0.85 => 'L4',
            default => 'L5',
        };
    }

    public function levelIndex(string $levelId): int
    {
        return match ($levelId) {
            'L1' => 1,
            'L2' => 2,
            'L3' => 3,
            'L4' => 4,
            'L5' => 5,
            default => 1,
        };
    }

    /**
     * Promote effective band one step if strong performance.
     *
     * @param array<string,string> $subjectLevels
     */
    public function promoteBand(string $ageBand, string $generalLevel, array $subjectLevels): string
    {
        $order = AgeBand::ALL;
        $idx = array_search($ageBand, $order, true);
        if ($idx === false) {
            return $ageBand;
        }
        $strongGeneral = in_array($generalLevel, ['L4', 'L5'], true);
        $strongSubjects = 0;
        foreach ($subjectLevels as $lvl) {
            if (in_array($lvl, ['L4', 'L5'], true)) {
                $strongSubjects++;
            }
        }
        if ($strongGeneral || $strongSubjects >= 2) {
            return $order[min(count($order) - 1, $idx + 1)];
        }

        return $ageBand;
    }

    /**
     * @return array{id:string,label_child:string,tier:int}
     */
    public function rankForGeneral(string $worldTheme, string $generalLevel): array
    {
        $tier = $this->levelIndex($generalLevel);
        if ($worldTheme === 'sci-fi') {
            $map = [
                1 => ['id' => 'scifi_recruit', 'label_child' => 'Recluta estelar', 'tier' => 1],
                2 => ['id' => 'scifi_cadet', 'label_child' => 'Cadete explorador', 'tier' => 2],
                3 => ['id' => 'scifi_ensign', 'label_child' => 'Alférez de ruta', 'tier' => 3],
                4 => ['id' => 'scifi_lieutenant', 'label_child' => 'Teniente de nebulosa', 'tier' => 4],
                5 => ['id' => 'scifi_captain', 'label_child' => 'Capitán del saber', 'tier' => 5],
            ];
        } else {
            $map = [
                1 => ['id' => 'fantasy_spark', 'label_child' => 'Chispa del reino', 'tier' => 1],
                2 => ['id' => 'fantasy_apprentice', 'label_child' => 'Aprendiz de los reinos', 'tier' => 2],
                3 => ['id' => 'fantasy_adept', 'label_child' => 'Adepto del artefacto', 'tier' => 3],
                4 => ['id' => 'fantasy_guardian', 'label_child' => 'Guardián del saber', 'tier' => 4],
                5 => ['id' => 'fantasy_archon', 'label_child' => 'Archón del equilibrio', 'tier' => 5],
            ];
        }

        return $map[$tier] ?? $map[1];
    }
}
