<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

/**
 * Narrativa de placement (intro / ítem / feedback / cierre) con degradación sin LLM.
 * SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE.
 */
final class PlacementNarrator
{
    /**
     * @param array<string,mixed> $child
     * @param list<string> $subjects
     */
    public function intro(array $child, string $mentorId, array $subjects): string
    {
        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $band = $this->bandOf($child);
        $name = (string) ($child['display_name'] ?? 'explorador');
        $profile = MentorCatalog::profile($mentorId);
        $place = $theme === 'sci-fi' ? 'Academia Estelar' : 'Escuela de los Reinos';
        $n = count($subjects);

        if ($band === AgeBand::EARLY) {
            return sprintf(
                'Bienvenido, %s. Yo soy %s. En la %s te esperan %d pruebas suaves del umbral. '
                . 'Respira, mira con curiosidad y responde cuando estés listo.',
                $name,
                $profile['display_name'],
                $place,
                $n,
            );
        }

        if (in_array($band, [AgeBand::ADULT, AgeBand::SENIOR], true)) {
            return sprintf(
                '%s, soy %s. En la %s mediremos juntos %d sendas del saber — no como un trámite, '
                . 'sino como el mapa de tu viaje. Cada reto revela dónde brillarás y dónde mereces apoyo. '
                . 'Cuando quieras, damos el primer paso.',
                $name,
                $profile['display_name'],
                $place,
                $n,
            );
        }

        if ($band === AgeBand::TEEN) {
            return sprintf(
                '%s — aquí estoy, %s. La %s no te examina para etiquetarte: te invita a %d pruebas del umbral. '
                . 'Habrá números, palabras y caminos de pensamiento. Confía en lo que sabes; yo te acompaño.',
                $name,
                $profile['display_name'],
                $place,
                $n,
            );
        }

        return sprintf(
            'Escucha, %s: soy %s, y la %s abre sus puertas. Te esperan %d pruebas del umbral. '
            . 'No buscamos una nota: buscamos el brillo de tu curiosidad. ¿Empezamos la primera?',
            $name,
            $profile['display_name'],
            $place,
            $n,
        );
    }

    /**
     * @param array<string,mixed> $child
     * @param array<string,mixed> $item
     */
    public function wrapItem(array $child, array $item, int $index, int $total): string
    {
        $stored = trim((string) ($item['presentation_text'] ?? ''));
        if ($stored !== '') {
            return $stored;
        }

        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $band = $this->bandOf($child);
        $prompt = trim((string) ($item['prompt_text'] ?? ''));
        $customWrap = trim((string) ($item['narrative_wrapper'] ?? ''));
        if ($customWrap !== '') {
            $body = trim($customWrap . ' ' . $prompt);
        } else {
            $subject = (string) ($item['subject_id'] ?? '');
            $key = (string) ($item['item_key'] ?? ('idx' . $index));
            $salt = (string) ($item['narrative_salt'] ?? (string) $index);
            $scene = $theme === 'sci-fi'
                ? $this->pickScene($this->scifiOpenings($band, $subject), $key, $salt, $index)
                : $this->pickScene($this->fantasyOpenings($band, $subject), $key, $salt, $index);
            $body = trim($scene . ' ' . $prompt);
        }

        return $this->withProgress($theme, $index, $total, $body);
    }

    /**
     * @param list<array<string,mixed>> $queue
     * @param array<string,mixed> $child
     * @return list<array<string,mixed>>
     */
    public function decorateItems(array $queue, array $child): array
    {
        $total = count($queue);
        $usedWrappers = [];
        $out = [];
        foreach ($queue as $index => $item) {
            $out[] = $this->decorateItem($child, $item, $index, $total, $usedWrappers);
        }

        return $out;
    }

    /**
     * @param array<string,mixed> $child
     * @param array<string,mixed> $item
     * @param list<string> $usedWrappers
     * @return array<string,mixed>
     */
    public function decorateItem(
        array $child,
        array $item,
        int $index,
        int $total,
        array &$usedWrappers = [],
    ): array {
        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $band = $this->bandOf($child);
        $subject = (string) ($item['subject_id'] ?? '');
        $key = (string) ($item['item_key'] ?? ('idx' . $index));
        $salt = (string) ($item['narrative_salt'] ?? bin2hex(random_bytes(4)));
        $item['narrative_salt'] = $salt;

        $existingWrap = trim((string) ($item['narrative_wrapper'] ?? ''));
        if ($existingWrap !== '' && in_array($existingWrap, $usedWrappers, true)) {
            $existingWrap = '';
        }

        if ($existingWrap === '') {
            $pool = $theme === 'sci-fi'
                ? $this->scifiOpenings($band, $subject)
                : $this->fantasyOpenings($band, $subject);
            $item['narrative_wrapper'] = $this->pickSceneAvoiding($pool, $key, $salt, $index, $usedWrappers);
        } else {
            $item['narrative_wrapper'] = $existingWrap;
        }

        $usedWrappers[] = (string) $item['narrative_wrapper'];
        unset($item['presentation_text']);
        $item['presentation_text'] = $this->wrapItem($child, $item, $index, $total);
        $item['progress'] = [
            'index' => $index,
            'total' => $total,
            'label' => $this->progressLabel($theme, $index, $total),
        ];

        return $item;
    }

    private function withProgress(string $theme, int $index, int $total, string $body): string
    {
        if ($total < 1) {
            return $body;
        }

        return trim($this->progressLabel($theme, $index, $total) . ' ' . $body);
    }

    private function progressLabel(string $theme, int $index, int $total): string
    {
        $n = $index + 1;

        return $theme === 'sci-fi'
            ? "Secuencia {$n} de {$total}."
            : "Reto {$n} de {$total}.";
    }

    public function feedback(float $score, string $theme, string $ageBand): string
    {
        if ($score >= 1.0) {
            return $this->positiveFeedback($theme, $ageBand);
        }

        if ($score >= 0.5) {
            return match ($ageBand) {
                AgeBand::EARLY => 'Casi lo tienes. No pasa nada: cada intento enseña el camino.',
                AgeBand::ADULT, AgeBand::SENIOR => 'Casi. La senda no se cierra: afinamos y seguimos con calma.',
                default => 'Casi. Sigamos: cada intento enseña el camino.',
            };
        }

        return match ($ageBand) {
            AgeBand::EARLY => 'No pasa nada. Yo estoy contigo. Probemos la siguiente prueba.',
            AgeBand::ADULT, AgeBand::SENIOR => 'Anoto y seguimos. Errar aquí no humilla: orienta el mapa del viaje.',
            default => 'No pasa nada. Anoto y seguimos; el umbral espera la próxima prueba.',
        };
    }

    /**
     * Feedback contextual con respuesta correcta y explicación si falla.
     *
     * @param array<string,mixed> $item
     * @param array{kind?:string,option_id?:string,text?:string} $reply
     * @param array<string,mixed> $child
     */
    public function feedbackForItem(
        array $item,
        array $reply,
        float $score,
        array $child,
        PlacementBank $bank,
    ): string {
        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $band = $this->bandOf($child);

        if ($score >= 1.0) {
            return $this->positiveFeedback($theme, $band);
        }

        if ($score >= 0.5) {
            $correct = $bank->correctAnswerLabel($item);
            $explanation = $bank->explanationText($item);

            return trim(sprintf(
                'Vas cerca, pero no del todo. La respuesta más ajustada es «%s». %s Sigamos con la siguiente.',
                $correct,
                $explanation,
            ));
        }

        $chosen = $bank->replyLabel($item, $reply);
        $correct = $bank->correctAnswerLabel($item);
        $explanation = $bank->explanationText($item);

        $why = $chosen !== null && $chosen !== ''
            ? sprintf('Has respondido «%s», y no encaja con lo que la prueba pedía.', $chosen)
            : 'No he podido encajar tu respuesta con lo que la prueba pedía.';

        return trim(sprintf(
            '%s La respuesta correcta es «%s». %s Cuando quieras, seguimos con la siguiente.',
            $why,
            $correct,
            $explanation,
        ));
    }

    /**
     * @param array<string,mixed> $child
     * @param array{id:string,label_child:string,tier:int} $rank
     */
    public function closing(array $child, string $mentorId, array $rank): string
    {
        $theme = (string) ($child['world_theme'] ?? 'fantasy');
        $band = $this->bandOf($child);
        $name = (string) ($child['display_name'] ?? 'explorador');
        $profile = MentorCatalog::profile($mentorId);
        $place = $theme === 'sci-fi' ? 'Academia' : 'Escuela';

        if ($band === AgeBand::EARLY) {
            return sprintf(
                '¡Lo lograste, %s! La %s te admite. Tu rango es «%s». Yo, %s, te guiaré. ¿A qué territorio vamos primero?',
                $name,
                $place,
                $rank['label_child'],
                $profile['display_name'],
            );
        }

        return sprintf(
            'Has sido admitido, %s. En la %s tu rango es «%s». Yo, %s, caminaré a tu lado. '
            . '¿Hacia qué territorio de saber viajamos primero?',
            $name,
            $place,
            $rank['label_child'],
            $profile['display_name'],
        );
    }

    /** @param array<string,mixed> $child */
    private function bandOf(array $child): string
    {
        return AgeBand::fromLegacy(
            $child['age_band'] ?? null,
            isset($child['age_years']) ? (int) $child['age_years'] : null,
        ) ?? AgeBand::CHILD;
    }

    private function positiveFeedback(string $theme, string $band): string
    {
        $lines = $theme === 'sci-fi'
            ? [
                AgeBand::EARLY => [
                    '¡Bien! La luz de la Academia brilla un poquito más. Sigamos.',
                    'Correcto. El holograma asiente. Continuamos.',
                ],
                AgeBand::ADULT => [
                    'Lectura correcta. Ese fragmento de saber vuelve a su órbita.',
                    'Exacto. El cartógrafo marca el acierto sin dramatismo.',
                    'Afirmativo. El mapa se aclara un grado.',
                ],
                AgeBand::SENIOR => [
                    'Lectura correcta. Ese fragmento de saber vuelve a su órbita.',
                    'Bien. La consola registra el acierto con calma.',
                ],
                'default' => [
                    'Afirmativo. El saber vuelve a brillar en la consola.',
                    'Correcto. Seguimos la ruta.',
                ],
            ]
            : [
                AgeBand::EARLY => [
                    '¡Bien visto! Las runas brillan por ti. Sigamos juntos.',
                    '¡Eso es! El farol se alegra. Continuamos.',
                ],
                AgeBand::ADULT => [
                    'Exacto. El equilibrio recupera un destello.',
                    'Así es. El artefacto acepta tu respuesta.',
                    'Correcto. Avanzamos con más certeza.',
                ],
                AgeBand::SENIOR => [
                    'Exacto. El equilibrio recupera un destello.',
                    'Bien. Las bóvedas guardan tu acierto en silencio.',
                ],
                'default' => [
                    'Bien visto. El saber vuelve a brillar un poco más.',
                    'Correcto. El farol señala el siguiente paso.',
                ],
            ];

        $pool = $lines[$band] ?? $lines['default'];

        return $pool[random_int(0, count($pool) - 1)];
    }

    /**
     * @param list<string> $openings
     */
    private function pickScene(array $openings, string $itemKey, string $salt, int $index): string
    {
        return $this->pickSceneAvoiding($openings, $itemKey, $salt, $index, []);
    }

    /**
     * @param list<string> $openings
     * @param list<string> $avoid
     */
    private function pickSceneAvoiding(
        array $openings,
        string $itemKey,
        string $salt,
        int $index,
        array $avoid,
    ): string {
        if ($openings === []) {
            return 'Escucha con atención.';
        }

        $hash = crc32($itemKey . '|' . $salt . '|' . $index);
        if ($hash < 0) {
            $hash = -$hash;
        }

        $count = count($openings);
        for ($attempt = 0; $attempt < $count; $attempt++) {
            $candidate = $openings[($hash + $attempt) % $count];
            if (!in_array($candidate, $avoid, true)) {
                return $candidate;
            }
        }

        return $openings[($hash + count($avoid)) % $count];
    }

    /** @return list<string> */
    private function fantasyOpenings(string $band, string $subject): array
    {
        $mood = match ($band) {
            AgeBand::EARLY => 'suave',
            AgeBand::TEEN => 'directo',
            AgeBand::ADULT, AgeBand::SENIOR => 'denso',
            default => 'claro',
        };

        $generic = match ($mood) {
            'suave' => [
                'En el claro, una luz tibia pide tu respuesta.',
                'Un farol se inclina hacia ti, paciente.',
                'Las piedras del umbral guardan un secreto pequeño.',
                'El viento trae una pregunta como una hoja.',
            ],
            'directo' => [
                'Sin rodeos: el umbral exige una respuesta limpia.',
                'Las galerías callan. Solo queda el acertijo.',
                'Un eco seco marca el siguiente tramo.',
                'El farol no adorna: señala el punto exacto.',
            ],
            'denso' => [
                'Bajo las bóvedas, el silencio espera una certeza.',
                'El artefacto no premia la prisa: pide juicio.',
                'Un pergamino se abre solo, como si te conociera.',
                'En el atrio, el aire cambia de peso: llega la pregunta.',
                'Las antorchas bajan un tono. Es tu turno de leer el mundo.',
                'Ningún heraldo anuncia esto; solo el saber, desnudo.',
            ],
            default => [
                'El patio de la Escuela se queda quieto un instante.',
                'Una brasa de curiosidad ilumina el siguiente paso.',
                'Las torres escuchan. Responde con calma.',
                'El umbral ofrece un enigma sin adornos de aula.',
            ],
        };

        $bySubject = match ($subject) {
            'math' => [
                'Los números se ordenan como estrellas en un mapa antiguo.',
                'Una balanza de bronce pide equilibrio, no magia barata.',
                'Cifras grabadas en piedra: ¿cuál completa el hechizo?',
            ],
            'language', 'reading', 'communication' => [
                'Las palabras pesan aquí tanto como las espadas.',
                'Un verso a medias cuelga del aire; faltas tú.',
                'La lengua del reino exige precisión, no ruido.',
            ],
            'logic' => [
                'Un laberinto de espejos pide la pieza que no encaja.',
                'La lógica aquí es una llave; el azar, un callejón.',
            ],
            'science' => [
                'La naturaleza susurra una ley que conviene recordar.',
                'Hojas, luz y aire: el mundo mismo hace la pregunta.',
            ],
            'mythology' => [
                'Los dioses antiguos no se van: dejan acertijos.',
                'Un mito abre su puerta; nombra lo que habita dentro.',
            ],
            'geography', 'culture' => [
                'Mapas y fronteras se despliegan como capas de un manto.',
                'El reino no se entiende sin su lugar en el mundo.',
            ],
            'ethics' => [
                'No hay runa más difícil que elegir lo justo.',
                'La brújula moral tiembla: ¿hacia dónde apuntas?',
            ],
            'politics' => [
                'El consejo del reino guarda una pregunta de poder compartido.',
                'Gobernar empieza por entender cómo se decide juntos.',
            ],
            'arts' => [
                'Un lienzo invisible espera el nombre de su trazo.',
                'La belleza aquí también se examina con rigor.',
            ],
            'sports' => [
                'El honor del juego limpio late como un tambor.',
                'Fuerza sin respeto no atraviesa este umbral.',
            ],
            'finance' => [
                'Monedas y promesas: cuenta con cabeza fría.',
                'El tesoro del viajero se mide también en juicio.',
            ],
            default => [],
        };

        $pool = array_values(array_unique([...$bySubject, ...$generic]));
        // Evitar que índices consecutivos caigan siempre en el mismo bloque temático.
        return $pool;
    }

    /** @return list<string> */
    private function scifiOpenings(string $band, string $subject): array
    {
        $mood = match ($band) {
            AgeBand::EARLY => 'suave',
            AgeBand::TEEN => 'directo',
            AgeBand::ADULT, AgeBand::SENIOR => 'denso',
            default => 'claro',
        };

        $generic = match ($mood) {
            'suave' => [
                'Una pantalla suave se enciende frente a ti.',
                'El holograma parpadea, amable, y espera.',
                'La nave baja el ruido de motores: toca pensar.',
            ],
            'directo' => [
                'Protocolo activo. Respuesta clara, sin relleno.',
                'La consola no negocia: pide un dato limpio.',
                'Sincronización lista. Tu turno en el enlace.',
            ],
            'denso' => [
                'El cartógrafo proyecta un nodo sin adornos de academia.',
                'Telemetría en silencio: solo queda tu lectura.',
                'Un pulso de datos abre la ventana exacta.',
                'El archivero estelar no dramatiza; pregunta.',
                'En la cubierta de navegación, el vacío espera una certeza.',
            ],
            default => [
                'La terminal del umbral carga el siguiente módulo.',
                'Un haz de luz traza el acertijo en el aire.',
                'El mapa estelar marca un punto y se detiene.',
            ],
        };

        $bySubject = match ($subject) {
            'math' => [
                'Vectores y ratios: la física del viaje pide números.',
                'La órbita no perdona un cálculo flojo.',
            ],
            'language', 'reading', 'communication' => [
                'El canal de voz exige léxico preciso.',
                'Descifrar el mensaje es parte de la misión.',
            ],
            'logic' => [
                'Un patrón incompleto bloquea la esclusa.',
                'La IA de a bordo no resuelve esto por ti.',
            ],
            'science' => [
                'Sensores biológicos reportan una anomalía… o una ley.',
                'Laboratorio de a bordo: hipótesis y evidencia.',
            ],
            'mythology' => [
                'Archivos culturales: mitos que aún orientan tripulaciones.',
            ],
            'geography', 'culture' => [
                'Cartografía planetaria: sitúa el origen.',
            ],
            'ethics' => [
                'Directiva ética a bordo: elige con integridad.',
            ],
            'politics' => [
                'Protocolo civil: cómo se decide en colectivo.',
            ],
            'arts' => [
                'Archivo audiovisual: nombra el plano, no improvises jerga.',
            ],
            'sports' => [
                'Entrenamiento de tripulación: respeto ante rendimiento.',
            ],
            'finance' => [
                'Presupuesto de misión: cuenta antes de gastar.',
            ],
            default => [],
        };

        return array_values(array_unique([...$bySubject, ...$generic]));
    }
}
