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
| `language` | Gramática, ortografía, léxico | Palabra **distinta**, categoría o forma correcta; si pides significado/sinónimo de X, X no es un chip |
| `reading` | Comprensión del pasaje | Hecho o acción del texto; si pides el significado de una palabra, una **definición**, nunca esa palabra |
| `logic` | Serie, relación, patrón | Elemento que completa la regla |
| `arts` | Técnica, materiales, propósito visual | **Función o efecto** si preguntas para qué; **material o técnica** si preguntas cuál/cómo |
| `science` | Observación, causa, clasificación | Explicación causal o categoría acorde a la pregunta |
| `mythology` | Quién / qué hizo un mito **real** | Nombre o hecho de `mitos reales`; envoltorio del mundo **sin** que la respuesta sea `lore inventado` |
| `culture` | Costumbre o hecho general | Dato escolar de la banda, no canon del viaje |
| `geography` | Lugar, clima, mapa | Nombre o relación geográfica real |
| `history` | Hecho, causa, orden temporal | Personaje o suceso histórico real |
| `ethics` | Qué es justo en un caso | Razón o elección ética concreta |
| `communication` | Mensaje claro | Frase o medio adecuado, no la palabra de la pregunta |
| `politics` | Convivencia cívica básica | Idea o institución reconocible en la banda |
| `sports` | Cuerpo, juego limpio | Acción o hábito saludable |
| `finance` | Ahorro, trueque, presupuesto | Cantidad o decisión cotidiana |

En `mythology` (y en humanidades en general) el envoltorio sci-fi/fantasía viste el reto; la correcta sigue siendo **conocimiento escolar previo**. En placement está prohibido examinar mitos del mundo. En caminos, el lore del mundo solo vale si acaba de enseñarse en el pasaje.

Si la pregunta pide **propósito** («para qué sirve»), ninguna opción —ni siquiera un distractor— debe limitarse a repetir sustantivos del enunciado sin explicar el uso.

Si la pregunta pide **significado / sinónimo / definición** de una palabra citada, ninguna opción puede ser esa palabra. Escribe definiciones o equivalentes (`inefable` → «que no se puede explicar»; `veloz` → «rápido»).

## Dificultad por banda

La **banda de edad** marca el suelo curricular. El nivel L* de la materia desplaza **dentro** de ese rango; nunca por debajo del suelo.

- `band_early` (5–7): enunciados cortos, una operación o idea por ítem, vocabulario concreto. No preguntes el significado de palabras literarias (inefable, onírico, efímero).
- `band_child` (8–10): puede combinar dos pasos o un mini-pasaje; sigue siendo una sola pregunta clara por ítem. Léxico de primaria.
- `band_tween` (11–13): fracciones simples, problemas de dos pasos, patrones; no infantilizar.
- `band_teen` (14–17): complejidad media-alta. En `math`: porcentajes, proporcionalidad, ecuaciones de primer grado o 2–3 pasos. **Prohibido** como pregunta principal: suma/resta directa de enteros de 1–2 cifras (p. ej. `10+5`). Si usas una palabra culta, las opciones son definiciones, no la misma palabra.
- `band_adult` / `band_senior`: razonamiento acorde; en `math` no uses aritmética de primaria como núcleo. Léxico preciso; sigue sin tautologías.

Si el prompt del servidor indica `Dificultad objetivo N [suelo X–techo Y]`, respétalo. Un teen en L1 practica contenido de 14–17 simplificado, no sumas de 6 años.
