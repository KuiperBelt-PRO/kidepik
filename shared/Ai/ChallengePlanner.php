<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

/**
 * Ítems curriculares deterministas (enunciado + opciones + respuesta canónica).
 * El LLM solo viste narrative_wrapper y prompt_text.
 */
final class ChallengePlanner
{
    /**
     * @return array{
     *   stem:string,
     *   input_mode:string,
     *   options:list<array{id:string,label:string}>,
     *   canonical_option:string,
     *   subject_id:string,
     *   level_id:string
     * }
     */
    public static function pickItem(
        string $subject,
        string $levelId,
        int $gateIndex,
    ): array {
        $rank = ZoneCatalog::levelRank($levelId);
        $pool = self::pool($subject, $rank);
        $pick = $pool[$gateIndex % count($pool)];

        return [
            'stem' => $pick['stem'],
            'input_mode' => $pick['input_mode'],
            'options' => $pick['options'],
            'canonical_option' => $pick['canonical_option'],
            'subject_id' => $subject,
            'level_id' => $levelId,
        ];
    }

    /**
     * @return list<array{stem:string,input_mode:string,options:list<array{id:string,label:string}>,canonical_option:string}>
     */
    private static function pool(string $subject, int $rank): array
    {
        if ($subject === 'language') {
            return $rank <= 2
                ? [
                    [
                        'stem' => 'Elige la palabra correcta: «El ____ brilla».',
                        'input_mode' => 'options_only',
                        'options' => [
                            ['id' => 'a', 'label' => 'sol'],
                            ['id' => 'b', 'label' => 'correr'],
                            ['id' => 'c', 'label' => 'mesa'],
                        ],
                        'canonical_option' => 'a',
                    ],
                    [
                        'stem' => 'Elige el plural correcto de «luz».',
                        'input_mode' => 'options_only',
                        'options' => [
                            ['id' => 'a', 'label' => 'luzs'],
                            ['id' => 'b', 'label' => 'luces'],
                            ['id' => 'c', 'label' => 'luzes'],
                        ],
                        'canonical_option' => 'b',
                    ],
                    [
                        'stem' => '¿Qué palabra completa: «Nosotros ____ al claro»?',
                        'input_mode' => 'options_only',
                        'options' => [
                            ['id' => 'a', 'label' => 'vamos'],
                            ['id' => 'b', 'label' => 'va'],
                            ['id' => 'c', 'label' => 'voy'],
                        ],
                        'canonical_option' => 'a',
                    ],
                ]
                : [
                    [
                        'stem' => 'Elige el sinónimo más cercano de «antiguo».',
                        'input_mode' => 'options_only',
                        'options' => [
                            ['id' => 'a', 'label' => 'viejo'],
                            ['id' => 'b', 'label' => 'rápido'],
                            ['id' => 'c', 'label' => 'húmedo'],
                        ],
                        'canonical_option' => 'a',
                    ],
                    [
                        'stem' => '¿Cuál es la forma correcta?',
                        'input_mode' => 'options_only',
                        'options' => [
                            ['id' => 'a', 'label' => 'Halla tu camino'],
                            ['id' => 'b', 'label' => 'Haya tu camino'],
                            ['id' => 'c', 'label' => 'Aya tu camino'],
                        ],
                        'canonical_option' => 'a',
                    ],
                    [
                        'stem' => 'Completa: «Aunque ____ tarde, llegamos.»',
                        'input_mode' => 'options_only',
                        'options' => [
                            ['id' => 'a', 'label' => 'llovía'],
                            ['id' => 'b', 'label' => 'llover'],
                            ['id' => 'c', 'label' => 'llovido'],
                        ],
                        'canonical_option' => 'a',
                    ],
                ];
        }

        if ($subject === 'logic') {
            return $rank <= 2
                ? [
                    [
                        'stem' => 'Secuencia: 1, 2, 4, 8, … ¿Siguiente?',
                        'input_mode' => 'options_only',
                        'options' => [
                            ['id' => 'a', 'label' => '10'],
                            ['id' => 'b', 'label' => '16'],
                            ['id' => 'c', 'label' => '12'],
                        ],
                        'canonical_option' => 'b',
                    ],
                    [
                        'stem' => 'Si todos los A son B, y este es A, entonces…',
                        'input_mode' => 'options_only',
                        'options' => [
                            ['id' => 'a', 'label' => 'es B'],
                            ['id' => 'b', 'label' => 'no es B'],
                            ['id' => 'c', 'label' => 'es C'],
                        ],
                        'canonical_option' => 'a',
                    ],
                    [
                        'stem' => '¿Qué no encaja: círculo, cuadrado, triángulo, manzana?',
                        'input_mode' => 'options_only',
                        'options' => [
                            ['id' => 'a', 'label' => 'manzana'],
                            ['id' => 'b', 'label' => 'círculo'],
                            ['id' => 'c', 'label' => 'triángulo'],
                        ],
                        'canonical_option' => 'a',
                    ],
                ]
                : [
                    [
                        'stem' => 'Secuencia: 2, 6, 12, 20, … ¿Siguiente?',
                        'input_mode' => 'options_only',
                        'options' => [
                            ['id' => 'a', 'label' => '30'],
                            ['id' => 'b', 'label' => '28'],
                            ['id' => 'c', 'label' => '24'],
                        ],
                        'canonical_option' => 'a',
                    ],
                    [
                        'stem' => 'Si llueve ⇒ suelo mojado. El suelo está seco. ¿Qué sigue?',
                        'input_mode' => 'options_only',
                        'options' => [
                            ['id' => 'a', 'label' => 'No llueve'],
                            ['id' => 'b', 'label' => 'Llueve seguro'],
                            ['id' => 'c', 'label' => 'No se sabe'],
                        ],
                        'canonical_option' => 'a',
                    ],
                    [
                        'stem' => 'Ordena de menor a mayor: 1 paso, 2 pasos, 3 pasos. ¿Primero?',
                        'input_mode' => 'options_only',
                        'options' => [
                            ['id' => 'a', 'label' => '1 paso'],
                            ['id' => 'b', 'label' => '2 pasos'],
                            ['id' => 'c', 'label' => '3 pasos'],
                        ],
                        'canonical_option' => 'a',
                    ],
                ];
        }

        if ($rank <= 2) {
            return [
                [
                    'stem' => '5 + 7 = ¿?',
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'a', 'label' => '11'],
                        ['id' => 'b', 'label' => '12'],
                        ['id' => 'c', 'label' => '13'],
                    ],
                    'canonical_option' => 'b',
                ],
                [
                    'stem' => '9 − 4 = ¿?',
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'a', 'label' => '5'],
                        ['id' => 'b', 'label' => '6'],
                        ['id' => 'c', 'label' => '4'],
                    ],
                    'canonical_option' => 'a',
                ],
                [
                    'stem' => '3 × 4 = ¿?',
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
                    'stem' => '47 + 28 = ¿?',
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'a', 'label' => '75'],
                        ['id' => 'b', 'label' => '65'],
                        ['id' => 'c', 'label' => '85'],
                    ],
                    'canonical_option' => 'a',
                ],
                [
                    'stem' => '15 × 4 = ¿?',
                    'input_mode' => 'options_only',
                    'options' => [
                        ['id' => 'a', 'label' => '45'],
                        ['id' => 'b', 'label' => '60'],
                        ['id' => 'c', 'label' => '50'],
                    ],
                    'canonical_option' => 'b',
                ],
                [
                    'stem' => '96 ÷ 8 = ¿?',
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
                'stem' => '144 ÷ 12 = ¿?',
                'input_mode' => 'options_only',
                'options' => [
                    ['id' => 'a', 'label' => '11'],
                    ['id' => 'b', 'label' => '12'],
                    ['id' => 'c', 'label' => '14'],
                ],
                'canonical_option' => 'b',
            ],
            [
                'stem' => '17 × 6 = ¿?',
                'input_mode' => 'options_only',
                'options' => [
                    ['id' => 'a', 'label' => '102'],
                    ['id' => 'b', 'label' => '96'],
                    ['id' => 'c', 'label' => '112'],
                ],
                'canonical_option' => 'a',
            ],
            [
                'stem' => '1/2 + 1/4 = ¿?',
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
}
