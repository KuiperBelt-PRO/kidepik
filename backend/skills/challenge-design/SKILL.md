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
2. **Autorrevisión anti-fuga:** si preguntarás ortografía, locución o significado, relee el wrapper: la opción correcta **no** puede estar ya escrita ahí.
3. Pregunta explícita en `prompt_text` (solo sobre el wrapper o regla escolar).
4. Tres opciones del mismo tipo (`a`/`b`/`c`).
5. Responde tú la pregunta mirando el wrapper.
6. `correct_option_id` = esa respuesta.
7. Si ninguna opción es verdadera → reescribe opciones (no marques una incorrecta).
8. `explanation` enseña la **regla** (por qué es esa opción), no solo nombra el label. En series numéricas: escribe las diferencias y el siguiente término; si ese término no está entre las opciones, reescribe las opciones.

### Ejemplos

**Categoría gramatical**

- Prompt: «¿Qué tipo de palabra es “correr”?»
- Opciones: Verbo / Sustantivo / Adjetivo
- `correct_option_id`: el de **Verbo**
- Explanation: «“Correr” es una acción; la correcta es Verbo.»

**Serie numérica**

- Prompt: «¿Qué número sigue en 10, 12, 11, 13, 12…?»
- Diferencias: +2, −1, +2, −1 → siguiente +2 → **14**
- Opciones: deben incluir **14**; no marques 13 (ya salió en la serie)
- Explanation: «Se alterna +2 y −1: 10+2=12, 12−1=11, 11+2=13, 13−1=12; luego 12+2=14.»

**Elegir categoría entre palabras**

- Prompt: «¿Cuál de estas palabras es un adjetivo?»
- Opciones: Casa / Grande / Perro
- `correct_option_id`: el de **Grande** (nunca un set sin adjetivo)

**Significado / sinónimo (anti-tautología)**

- Prompt: «¿Cuál es el significado de “inefable” en el pasaje?»
- Opciones: Que no se puede explicar / Frecuente / Medible
- `correct_option_id`: el de **Que no se puede explicar**
- ❌ Nunca un chip «Inefable» (es la palabra preguntada, no la respuesta)

## Anti-fuga de respuesta en el pasaje (crítico)

El viajero ve `narrative_wrapper` + `prompt_text` juntos. Si la pregunta pide **ortografía**, **forma correcta**, **locución**, **sinónimo** o **significado**, el wrapper **no puede contener** la opción correcta ni esa forma escrita.

| Mal | Bien |
| --- | --- |
| Pasaje: «**Asimismo**, el sistema redujo…» → pregunta: escritura de «también» → chip «Asimismo» | Pasaje: «**Además**, el protocolo cambió…» o deja hueco; chips: Asi mismo / Asimismo / A sí mismo |
| Pasaje: «navegar **a través de** la nube» → pregunta: locución de desplazamiento → chip «a través de» | Pasaje: «cruzaron la densa nube de escombros» sin la locución; chips con variantes |
| Pasaje usa la palabra correcta y preguntas su significado con chip = esa palabra | Pasaje usa la palabra; chips son definiciones distintas |

**Autorrevisión por reto:** escribe wrapper → pregunta → opciones → comprueba que la correcta **no** aparece en el wrapper (salvo `reading` con pregunta de **hecho**: «¿qué ocurre?»).

## Prohibido

- Reenseñar la teoría en cada reto (`teaching_beat` no vacío).
- Copiar ejemplos de `lesson_narrative` en los retos.
- Poner en `narrative_wrapper` la forma correcta cuando la pregunta pide ortografía, locución o significado.
- Preguntar hechos no mencionados en `narrative_wrapper` (salvo `conocimiento escolar previo`).
- Preguntar `lore inventado` del mundo que **no** acaba de enseñarse en `lesson_narrative` ni en el `narrative_wrapper` de ese reto.
- Inventar un mito del mundo y examinarlo como si el viajero lo conociera de casa.
- Marcar `correct_option_id` antes de comprobar la respuesta.
- Preguntar algo que ninguna opción responde.
- Preguntar el significado/sinónimo de una palabra y ofrecer esa misma palabra como opción.

## Alineación con placement-exam

Misma checklist pregunta↔opciones, sin filtrar la correcta en el enunciado, castellano natural. Respeta suelo de edad + objetivo de dificultad inyectados.

## Variedad del pack

Títulos originales; caminos distintos; máx. 1 camino con colores de la paleta del viajero.
Nombres en castellano (no «Ruta de language»). `learning_blurb` distinto y concreto en cada camino.
