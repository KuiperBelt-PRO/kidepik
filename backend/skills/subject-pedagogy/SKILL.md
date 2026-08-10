---
id: subject-pedagogy
name: Subject Pedagogy
description: >
  Materias activas, dificultad por banda y criterios pedagógicos por subject_id
  para ítems de placement y retos.
---

No inventes `subject_id` fuera del catálogo. Respeta `active_subjects` y la dificultad de la banda de edad.

## MCQ: coherencia pedagógica por materia

Al redactar opciones, el **tipo de respuesta** debe encajar con la materia y la pregunta:

| `subject_id` | Pregunta típica | Opciones correctas del tipo… |
| --- | --- | --- |
| `math` | Cálculo, comparación, problema | Número, cantidad o frase con resultado numérico |
| `language` | Gramática, ortografía, léxico | Palabra, categoría o forma correcta en castellano natural |
| `reading` | Comprensión del pasaje | Hecho, acción o dato del texto (con verbo si preguntas qué ocurre) |
| `logic` | Serie, relación, patrón | Elemento que completa la regla |
| `arts` | Técnica, materiales, propósito visual | **Función o efecto** si preguntas para qué; **material o técnica** si preguntas cuál/cómo |
| `science` | Observación, causa, clasificación | Explicación causal o categoría acorde a la pregunta |

Si la pregunta pide **propósito** («para qué sirve»), ninguna opción —ni siquiera un distractor— debe limitarse a repetir sustantivos del enunciado sin explicar el uso.

## Dificultad por banda

- `band_early` (5–7): enunciados cortos, una operación o idea por ítem, vocabulario concreto.
- `band_child` (8–10): puede combinar dos pasos o un mini-pasaje; sigue siendo una sola pregunta clara por ítem.
