---
id: placement-exam
name: Placement Exam
description: >
  Examen de ingreso KidepiK: formato MCQ, calidad pedagógica y alineación
  pregunta-opciones. Reglas obligatorias para placement_item_writer.
---

Castellano de España. Ítems frescos según materia y edad. Sin banco seed fijo.
El servidor inyecta suelo/techo de la banda y un hint curricular; no bajes de ese suelo.

## Proceso por ítem (obligatorio)

Antes de cerrar **cada** ítem del lote, recorre este checklist:

1. `presentation_text`: envoltorio narrativo del mundo **+ pregunta explícita** (nunca implícita).
2. Identifica el **tipo de pregunta** (cuánto, para qué, qué ocurre, quién, cuál, etc.).
3. Escribe **3–4 opciones del mismo tipo** que la pregunta exige; una sola correcta.
4. Comprueba que la **correcta responde** a la pregunta, no solo repite palabras del enunciado.
5. `correct_option_id` = **id** de la opción (`a`, `b`, `c`…), nunca el texto visible.
6. La correcta **no** debe aparecer en el enunciado (salvo `reading`, donde el pasaje puede contenerla).

## Alinear pregunta ↔ opciones (crítico)

El fallo más grave es desajustar el tipo de pregunta y el tipo de respuesta.

| Si preguntas… | La correcta debe ser… | Mal ejemplo de correcta |
| --- | --- | --- |
| ¿Para qué sirve…? / ¿Para qué se usan…? | **Función, efecto o propósito** | «Oscuros y claros» (solo repite el tema) |
| ¿Qué ocurre…? / ¿Qué pasa…? | **Hecho o acción** (con verbo) | «El viento suave» |
| ¿Cuánto es…? / ¿Cuántos…? | **Número o cantidad** | «Muchos cristales» |
| ¿Quién…? / ¿Qué animal…? | **Personaje o categoría** pedida | «Un día soleado» |

Los **distractores** deben ser del **mismo tipo** que la correcta (todos propósitos, todos números, todas acciones…), aunque sean erróneos.

### Ejemplo `arts` — pregunta de propósito

Enunciado: «¿Para qué sirven los colores oscuros y los colores claros juntos en una obra?»

- ✅ Correcta: «Para dar volumen y sombra al dibujo»
- ✅ Distractor plausible: «Para pintar solo con colores brillantes»
- ❌ Correcta: «Oscuros y claros»
- ❌ Distractor: «Tinta de color negro» (material, no responde al «para qué»)

### Ejemplo `reading` — pregunta de hecho

Enunciado: «El viento mueve las hojas. ¿Qué ocurre en el bosque?»

- ✅ Correcta: «El viento mueve las hojas»
- ❌ Correcta: «El viento suave»

## Formato técnico

- MCQ: 3–4 opciones con ids `a`, `b`, `c` (y `d` si aplica); etiquetas claras en castellano natural.
- `short_text` (si la edad lo permite en otros contextos): `expected_answer` obligatorio (`|` para alternativas).
- `success_feedback`: breve, positivo, sin spoilear el siguiente ítem.
- `explanation`: solo si el alumno puede fallar; pedagógica, no circular.
  - Nombra por qué la opción elegida **no encaja** (p. ej. antónimo cuando pedías sinónimo).
  - Orienta hacia la correcta; no solo definas el concepto sin mencionar el error.
  - Mal: «Veloz es lo mismo que rápido» (sin decir por qué «Lento» falla).
  - Bien: «Lento es lo contrario; veloz significa rápido».
  - En series numéricas: explica el patrón (p. ej. +2, −1) y por qué el siguiente término es ese.

## Conocimiento previo (crítico)

El examen de ingreso mide lo que el viajero **ya puede saber** por edad y materia. El mundo (Binar Star, reinos, NPCs) es **envoltorio**, no temario.

- La correcta debe ser respondible **sin haber jugado nunca**: currículo escolar o cultura general de la banda (`conocimiento escolar previo`).
- **Prohibido:** `lore inventado` (mitos, héroes, artefactos o lugares del mundo que el viajero no puede conocer).
- **`mythology`:** `mitos reales` (griegos, romanos, egipcios…; p. ej. Prometeo y el fuego) vestidos de sci-fi/fantasía. Nunca trivia del canon del mundo.
- Pistas de color, horizonte o paleta **no** sustituyen el dato escolar.

Anti-ejemplo (rechazar): «Según las leyendas de Binar Star, ¿quién trajo el fuego tecnológico?» con opciones «El Navegante del Vacío / El Arquitecto de las Chispas / El Guardián de la Red».

Bien: «En la estación recuerdan a un titán de la Tierra que robó el fuego a los dioses. ¿Cómo se llama?» → Prometeo.

## Paleta del personaje

- Acento visual **ocasional**, no tema de cada ítem.
- **Máximo 1 ítem por lote** puede mencionar colores de la paleta del viajero.
- En `math` y `logic`, prioriza objetos neutros sin forzar colores del personaje.

## Por materia (`band_child`)

| Materia | Enfoque válido | Evitar |
| --- | --- | --- |
| `math` | Operaciones y problemas **acordes a la banda** (datos completos) | Respuesta en el enunciado; en `band_teen`+ suma `10+5` como núcleo |
| `language` | Categoría gramatical, ortografía, sinónimo/antónimo | Acertijos; «llave plata» → usar «llave de plata» |
| `reading` | Texto breve + pregunta alineada con opciones | «¿Qué ocurre?» con respuesta sin verbo |
| `logic` | Relaciones, series, materiales | Repetir paleta en cada enunciado |
| `arts` | Técnica, propósito visual, materiales | Opciones que no explican función cuando preguntas «para qué» |
| `mythology` | Mitos reales vestidos de mundo | Trivia de lore inventado (héroes/mitos del sector) |
