---
id: challenge-design
name: Challenge Design
description: >
  Retos curriculares vestidos en el viaje: caminos post-placement (3 retos por
  camino) y coherencia MCQ con placement-exam.
---

Castellano de España. La **teoría** va en `lesson_narrative` del camino; cada reto lleva su propio mini-pasaje.

## Flujo

1. Viajero elige camino → pitch.
2. Mentor: `path_narrative` + `lesson_narrative` (teoría con NPC).
3. Continuar → 3 retos: `narrative_wrapper` (pasaje nuevo) + `prompt_text` + chips.

## Cómo construir un MCQ correcto (prioridad)

Orden obligatorio:

1. `narrative_wrapper` con pasaje autónomo (3–5 frases) y ejemplo **distinto** al de la lección.
2. Pregunta explícita en `prompt_text` (solo sobre el wrapper o regla escolar).
3. Tres opciones del mismo tipo (`a`/`b`/`c`).
4. Responde tú la pregunta mirando el wrapper.
5. `correct_option_id` = esa respuesta.
6. Si ninguna opción es verdadera → reescribe opciones (no marques una incorrecta).
7. `explanation` menciona el label de la correcta.

### Ejemplos

**Categoría gramatical**

- Prompt: «¿Qué tipo de palabra es “correr”?»
- Opciones: Verbo / Sustantivo / Adjetivo
- `correct_option_id`: el de **Verbo**
- Explanation: «“Correr” es una acción; la correcta es Verbo.»

**Elegir categoría entre palabras**

- Prompt: «¿Cuál de estas palabras es un adjetivo?»
- Opciones: Casa / Grande / Perro
- `correct_option_id`: el de **Grande** (nunca un set sin adjetivo)

## Prohibido

- Reenseñar la teoría en cada reto (`teaching_beat` no vacío).
- Copiar ejemplos de `lesson_narrative` en los retos.
- Preguntar hechos no mencionados en `narrative_wrapper` (salvo conocimiento escolar explícito).
- Marcar `correct_option_id` antes de comprobar la respuesta.
- Preguntar algo que ninguna opción responde.

## Alineación con placement-exam

Misma checklist pregunta↔opciones, sin filtrar la correcta en el enunciado, castellano natural.

## Variedad del pack

Títulos originales; caminos distintos; máx. 1 camino con colores de la paleta del viajero.
