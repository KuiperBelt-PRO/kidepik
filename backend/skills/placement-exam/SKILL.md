---
id: placement-exam
name: Placement Exam
description: >
  Examen de ingreso KidepiK: formato MCQ, calidad pedagógica y alineación
  pregunta-opciones. Reglas obligatorias para placement_item_writer.
---

Castellano de España. Ítems frescos según materia y edad. Sin banco seed fijo.
El servidor inyecta suelo/techo de la banda y un hint curricular; no bajes de ese suelo.

## Autorrevisión (antes de emitir CADA ítem)

1. Lee la pregunta en voz alta. ¿Qué tipo de respuesta pide (número, función, hecho, definición, categoría…)?
2. Mira cada chip: ¿es de ese mismo tipo?
3. **Anti-tautología:** si la pregunta nombra una palabra entre comillas o pide su significado, **ningún chip puede ser esa palabra** (tampoco como distractor). Si se te ocurre el chip «Inefable» para «¿qué significa inefable?», bórralo.
4. Responde tú mismo con el pasaje/regla escolar. Marca `correct_option_id` de esa respuesta.
5. Si un chip solo repite el enunciado, reescríbelo.
6. **Anti-fuga:** si el pasaje (`presentation_text`) y la pregunta se muestran juntos, la opción correcta **no** puede estar ya escrita en el pasaje cuando preguntas ortografía, locución, sinónimo o significado (salvo `reading` con hecho del texto).

## Proceso por ítem (obligatorio)

1. `presentation_text`: envoltorio narrativo del mundo **+ pregunta explícita** (nunca implícita).
2. Identifica el **tipo de pregunta** (cuánto, para qué, qué ocurre, quién, cuál, qué significa…).
3. Escribe **3–4 opciones del mismo tipo** que la pregunta exige; una sola correcta.
4. Comprueba que la **correcta responde** a la pregunta, no solo repite palabras del enunciado.
5. `correct_option_id` = **id** de la opción (`a`, `b`, `c`…), nunca el texto visible.
6. La correcta **no** debe aparecer en el pasaje ni en la pregunta (salvo `reading` cuando preguntas un **hecho** del pasaje, no su definición ni su ortografía).

### Ejemplo — ortografía / locución (fuga en el pasaje)

Enunciado: pasaje «El protocolo cambió. **Asimismo**, el soporte vital redujo el oxígeno» + «Identifica la escritura correcta del término que significa también».

- ❌ Correcta: «Asimismo» (ya está en el pasaje; el viajero solo copia)
- ✅ Pasaje sin la forma: «**Además**, el soporte vital…» o «__, el soporte vital…»; chips: Asi mismo / Asimismo / A sí mismo

Enunciado: pasaje «Debieron navegar **a través de** la nube de escombros» + «¿Cuál es la forma correcta de la locución de desplazamiento?».

- ❌ Correcta: «a través de» (ya visible en el pasaje)
- ✅ Pasaje: «cruzaron la densa nube de escombros» sin la locución; chips con variantes ortográficas

### Ejemplo fantasy — envoltorio + locución (Reinos Unidos)

Enunciado: pasaje «En el atrio del Umbral, la archivista leyó: «El aprendiz cruzó el arroyo **a traves de** las piedras lisas».» + «¿Cuál es la forma correcta de la locución de desplazamiento?».

- ❌ Correcta: «a traves de» (ya visible en el pasaje)
- ✅ Pasaje: «…cruzó el arroyo entre las piedras lisas» sin la locución; chips: a traves de / a través de / atraves de

Enunciado fantasy — significado: pasaje «El pergamino describe un hallazgo **inefable**» + «¿Cuál es el significado preciso de «inefable»?»

- ✅ Correcta: «Que no se puede explicar con palabras»
- ❌ Chip «Inefable» (tautología)
- ❌ Pasaje con «inefable» + pregunta por ortografía de «inefable» sin hueco

## Alinear pregunta ↔ opciones (crítico)

El fallo más grave es desajustar el tipo de pregunta y el tipo de respuesta.

| Si preguntas… | La correcta debe ser… | Mal ejemplo de correcta |
| --- | --- | --- |
| ¿Qué significa…? / ¿Cuál es el significado de «X»? / sinónimo o definición de X | **Definición, sinónimo o paráfrasis distinta de X** | El propio «X» (tautología) |
| ¿Para qué sirve…? / ¿Para qué se usan…? | **Función, efecto o propósito** | «Oscuros y claros» (solo repite el tema) |
| ¿Qué ocurre…? / ¿Qué pasa…? | **Hecho o acción** (con verbo) | «El viento suave» |
| ¿Cuánto es…? / ¿Cuántos…? | **Número o cantidad** | «Muchos cristales» |
| ¿Quién…? / ¿Qué animal…? | **Personaje o categoría** pedida | «Un día soleado» |
| ¿Qué tipo de palabra es «correr»? | **Categoría gramatical** (Verbo) | «Correr» |

Los **distractores** deben ser del **mismo tipo** que la correcta (todos propósitos, todos números, todas definiciones…), aunque sean erróneos. Un distractor **tampoco** puede ser la palabra preguntada.

### Ejemplo — significado (el error que no debe repetirse)

Enunciado: pasaje con *inefable* + «¿Cuál es el significado preciso de 'inefable'?»

- ✅ Correcta: «Que no se puede explicar con palabras»
- ✅ Distractor: «Que ocurre muy a menudo»
- ✅ Distractor: «Que se puede medir con exactitud»
- ❌ Cualquier chip: «Inefable» (ni correcta ni distractor: es la pregunta, no una respuesta)
- ❌ Correcta: «Frecuente» o «Medible» si el texto dice que **no** se puede clasificar ni traducir

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

En `reading`, preguntar un **hecho** del texto sí puede reutilizar palabras del pasaje. Preguntar el **significado de una palabra** del pasaje **nunca** puede ofrecer esa palabra como chip.

### Ejemplo `language` — categoría, no tautología

- Prompt: «¿Qué tipo de palabra es “correr”?»
- Opciones: Verbo / Sustantivo / Adjetivo — nunca el chip «Correr».

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

## Por materia (ajusta al suelo de la banda)

| Materia | Enfoque válido | Evitar |
| --- | --- | --- |
| `math` | Operaciones y problemas **acordes a la banda** (datos completos) | Respuesta en el enunciado; en `band_teen`+ suma `10+5` como núcleo |
| `language` | Categoría gramatical, ortografía, sinónimo/antónimo **distinto de la palabra pedida** | Chip = la palabra preguntada; acertijos; «llave plata» |
| `reading` | Texto breve + pregunta alineada (hecho **o** definición, nunca tautológica) | «¿Qué ocurre?» con respuesta sin verbo; «¿qué significa X?» → chip «X» |
| `logic` | Relaciones, series, materiales | Repetir paleta en cada enunciado |
| `science` | Causa, clasificación, observación escolar | Trivia de lore de la nave |
| `arts` | Técnica, propósito visual, materiales | Opciones que no explican función cuando preguntas «para qué» |
| `mythology` | Mitos reales vestidos de mundo | Trivia de lore inventado |
| `culture` / `history` / `geography` | Hechos escolares de la banda | Inventar historia del sector |
| `ethics` / `communication` / `politics` | Juicio cívico sencillo, mensaje claro | Jerga adulta innecesaria en `band_early` |
| `sports` / `finance` | Cuerpo, juego limpio, ahorro cotidiano | Cifras o normas que el viajero no puede saber |
