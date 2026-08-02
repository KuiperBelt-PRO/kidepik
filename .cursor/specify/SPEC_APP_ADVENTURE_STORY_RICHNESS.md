# Spec: Riqueza narrativa del viaje (historia creíble post-examen)

> Estado: **aprobada e implementada parcialmente** (1 ago 2026) — pitches, arco multi-reto (3 gates), planificador anti-hueco, dificultad por nivel, cajetín play §7 vía SECTION_FRAME §2.2b  
> **Pivot narrativo (aprobado 2 ago 2026):** copy jugable post-examen **solo LLM** — [SPEC_APP_ADVENTURE_LLM_NARRATIVE.md](SPEC_APP_ADVENTURE_LLM_NARRATIVE.md). **Sin plantillas** (`ZoneNarrativeCatalog`, `zonePitches`, `challengePool`, `thinkingLines`) en ningún camino; fallo → `compose_failed` + reintentar.  
> Relacionado: [SPEC_APP_ADVENTURE_SESSION.md](SPEC_APP_ADVENTURE_SESSION.md), [SPEC_APP_WORLD_JOURNEY_CANON.md](SPEC_APP_WORLD_JOURNEY_CANON.md), [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md), [SPEC_APP_JOURNEY_MEMORY.md](SPEC_APP_JOURNEY_MEMORY.md), [SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md), [SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md), [SPEC_AI_PLAY_ORCHESTRATION.md](SPEC_AI_PLAY_ORCHESTRATION.md)  
> Precedencia: este documento **eleva el vertical slice actual** (1 zona → 1 suma fija → «Hasta pronto») a un viaje que **parece una historia**. No sustituye el canon ni el ledger; los concreta.

## Contexto / síntomas (sesión real ago 2026)

Tras el examen el sistema:

1. Ofreció 3 zonas **sin** presentar cada lugar ni por qué ir según materias/niveles.
2. No dejó en el diálogo un rastro claro de **qué otras opciones había**.
3. Insertó un reto trivial (`5 + 7`) **sin** anclarlo a la trama ni a la dificultad del perfil.
4. No montó lugar, NPCs, problemas ni arco dentro de la zona.
5. Ofreció «Hasta pronto» **sin** motivo narrativo.
6. Luego un mensaje LLM libre pedía «elige camino» **sin chips** ni instrucción de texto libre.
7. El «Bosque de los Números» no tenía una **serie de retos** antes de poder salir.

Causa técnica actual: `PlacementService` cierra con labels planos; `AdventureService` es un stub hardcodeado; tras `adventure_idle` el turno cae a `llmMentorTurn` sin planificador.

## Objetivo

1. **Pitch de zonas** post-examen: introducción + motivo pedagógico (sin revelar `L1`–`L5` al niño).
2. **Arco de zona** multi-beat / multi-reto antes de encrucijada o despedida.
3. **Retos como obstáculos de la historia**, con dificultad alineada al perfil.
4. **NPCs y lugares** narrados por el mentor (canon §5).
5. **Turnos de elección siempre accionables**: chips o instrucción explícita de texto libre.
6. **Cierres de sesión** motivados (cupo, sueño del viaje, mentor se despide), nunca CTA opaco.

---

## 1. Principios de historia

| Principio | Decisión |
| --- | --- |
| El viaje manda | El planificador PHP elige beat, zona, materia, dificultad y fase; el LLM **redacta** toda la prosa jugable ([SPEC_APP_ADVENTURE_LLM_NARRATIVE.md](SPEC_APP_ADVENTURE_LLM_NARRATIVE.md)) |
| Credibilidad | Cada turno avanza lugar, relación o problema; prohibido saltar de «entramos» → suma → adiós |
| Aprendizaje = trama | El reto es un obstáculo diegético (runa, consola, puente, eco del Vacío) |
| Memoria visible | Las opciones ofrecidas y la elegida quedan en ledger y, en prosa, se pueden recordar («dejamos las Montañas para otro día») |
| Agencia clara | Si hay elección, hay chips **o** el mentor dice explícitamente qué escribir |
| Zona = capítulo corto | Salir de una zona requiere completar la quest intro (N retos), no un único ítem |

---

## 2. Post-examen — presentación de destinos

### 2.1 Turno de admisión (ya existe closing)

Tras `placement completed` + beat de rango:

1. **Turno A — mapa de caminos** (`input_mode: continue` o prosa corta): el mentor celebra el rango y anuncia que hay **varios reinos/sistemas** que piden ayuda.
2. **Turno B — pitches** (`input_mode: options_only` o `options_or_text`): **2–3 zonas** con tarjeta rica.

Cada opción **debe** incluir:

```ts
{
  id: "zone_math",
  label: "Bosque de los Números",           // título corto
  description: string,                     // 1–2 frases: qué es el lugar + qué pasa allí
  why_for_you: string,                     // motivo amable ligado al perfil (sin decir "nivel L2")
}
```

Reglas de `why_for_you` (motor PHP elige zonas; **LLM redacta** copy — [SPEC_APP_ADVENTURE_LLM_NARRATIVE.md](SPEC_APP_ADVENTURE_LLM_NARRATIVE.md) §2.1):

| Rol en la terna | Guía para el agente (ejemplos; tono por mundo) |
| --- | --- |
| Primera opción (materia más débil) | Metáfora de **materia**, no repetir el nombre de la zona |
| Segunda opción | Ángulo distinto: afianzar desde otro enfoque |
| Tercera opción | Variedad / curiosidad del viaje |

**Variabilidad:** el planificador debe evitar ofrecer **siempre** la misma terna ordenada para el mismo perfil (semilla sesión + shuffle entre candidatos débiles — spec LLM §2.1.1).

**Anti-repetición (obligatorio):**

- El turno del mentor (`zonePitchMapText`) **solo** enumera nombres de zona y remite a las cartas; **prohibido** volcar `description` + `why_for_you` en la burbuja del mentor.
- Cada `why_for_you` debe ser **distinto** entre las 2–3 opciones; prohibido la misma plantilla cambiando solo el nombre del lugar.
- No repetir en `why_for_you` el `label` de la carta (ya está en el título).

Priorización de las 2–3 zonas: igual que [SPEC_APP_WORLD_JOURNEY_CANON.md](SPEC_APP_WORLD_JOURNEY_CANON.md) §3.1 (débil + opcional favorita).

### 2.2 Persistencia de la encrucijada

Al ofrecer destinos:

- `append_story_beat` `beat_kind=choice` con `choices_offered` = las 2–3 opciones **completas** (label + description + why).
- Al elegir: `journey_decisions` + `choice_taken`; el mentor **nombra** la elegida y puede mencionar una no elegida en una frase («Las Montañas esperarán»).

El diario tutor muestra la decisión con el **label humano** de la zona, no solo `zone_math`.

### 2.3 Prohibido

- Chips solo con nombre de zona y cero contexto.
- Pedir «elige tu camino» en prosa **sin** `options` ni frase del tipo: «Escribe el nombre del lugar o lo que quieras explorar.»

---

## 3. Arco dentro de una zona (quest intro)

### 3.1 Estructura mínima (`Q_zone_intro_*`)

Al entrar en zona (primera vez o quest intro no completada):

| Paso | Beat / fase | Contenido mínimo |
| --- | --- | --- |
| Z0 | `narration` llegada | Sensorial: paisaje, clima, sonido; por qué el Vacío/Artefacto afecta **este** lugar |
| Z1 | presentación NPC | Al menos un `zone_guardian` o `companion` (ids en `meta.npc_ids`); el mentor **narra** su voz, no abre otro chat |
| Z2 | problema de la zona | Hilo abierto concreto (runas perdidas, señales borradas, puente inestable…) + meta de quest en lenguaje niño |
| Z3…Zn |  **N retos de aprendizaje** intercalados con beats narrativos | Ver §3.2 y §4 |
| Z-end | `quest_update` / micro-ceremonia | Fragmento/runa recuperada; oferta de seguir en zona, encrucijada, o **cierre de sesión motivado** |

**N (retos por quest intro de zona):**

| Parámetro | MVP | Notas |
| --- | --- | --- |
| `steps_total` / learning gates | **3** (configurable `ADVENTURE_ZONE_INTRO_GATES=3`) | Hoy el stub usa 2 pero solo ejecuta 1 reto |
| Beats narrativos entre retos | ≥1 | Lugar nuevo, ayuda del NPC, eco del antagonista |
| Salida de zona | Solo si quest intro `completed` **o** tutor fuerza fin de sesión | No «Hasta pronto» tras el primer ítem como fin de arco |

### 3.2 Micro-loop por reto (diegético)

```
situación en el mundo
  → el obstáculo exige saber (challenge_intro vestido)
  → respuesta del explorador
  → consecuencia en el mundo (éxito / casi / falla amable)
  → avance de quest (steps_done++)
  → si quedan gates: nuevo lugar/problema; si no: Z-end
```

**Prohibido:** mostrar el enunciado curricular desnudo sin anclaje («Las runas muestran: 5+7») como **primer** mensaje de llegada. El enunciado puede aparecer **después** de situar el obstáculo.

### 3.3 Dificultad del reto

| Fuente | Uso |
| --- | --- |
| `subject_levels[subject_id]` + `effective_age_band` + `difficulty_modifier` | `ChallengePlanner` (PHP) elige ítem del banco determinista |
| `challenge_writer` (LLM) | Vestido narrativo del ítem ya elegido |
| Antagonista | Solo tono (`antagonist_pressure`), no unfair |

Si el perfil ya superó sumas simples en placement, **prohibido** reutilizar `5+7` como primer gate de zona math.

Criterio aceptación: el primer reto de zona usa dificultad **acorde** al nivel de esa materia (tests con fixture L3+ no reciben ítem L1 canónico hardcodeado).

---

## 4. Planificador vs LLM

### 4.1 Planificador PHP (obligatorio en `flow_id=adventure`)

Estados de fase tipados (ejemplos; nombres estables en `meta.phase`):

| `phase` | Siguiente acción |
| --- | --- |
| `choose_zone` | Esperar opción de zona |
| `zone_arrive` | Z0–Z2 en **1 turno** mentor (3 párrafos) — [SPEC_APP_ADVENTURE_TURN_PACKAGING.md](SPEC_APP_ADVENTURE_TURN_PACKAGING.md) §3 |
| `adventure_challenge` | Reto activo con schema de scoring |
| `zone_between` | Beat narrativo / NPC / elección menor de camino **con options** |
| `zone_quest_complete` | Ceremonia corta + oferta continuar / otra zona / cerrar sesión |
| `session_wrap` | Despedida motivada; no cae a LLM libre sin plan |
| `adventure_crossroads` | C2: nueva elección de zona con pitches |

**Regla anti-hueco:** tras cualquier `continue` / opción del niño en adventure, el servidor **debe** resolver con el planificador. **Prohibido** caer al `llmMentorTurn` genérico sin `phase` y sin `input_mode` válido (causa del «elige camino» sin chips).

### 4.2 Rol del LLM (normativo tras [SPEC_APP_ADVENTURE_LLM_NARRATIVE.md](SPEC_APP_ADVENTURE_LLM_NARRATIVE.md))

**Genera (flujo feliz con IA activa):**

- Pitches de zona (`label` canon + `description` + `why_for_you` + puente del mentor).
- Llegada unificada Z0–Z2 con NPC nombrado y problema de zona.
- Vestido completo del reto (`narrative_wrapper` + `prompt_text`) y líneas de éxito/casi.
- Beats `zone_between` y cierre de quest.
- Lotes de copy de espera (thinking) por edad y mundo.

**No genera / no puede cambiar:**

- `zone_id`, `subject_id`, dificultad, `canonical_answer`, fin de quest arbitrario.
- Pedir elección sin `options` cuando el planificador marcó `options_only`.
- Ofrecer «Hasta pronto» salvo `phase=session_wrap` con motivo.

### 4.3 Sin plantillas narrativas

**Prohibido** servir copy de aventura desde `ZoneNarrativeCatalog`, `challengePool`, pitches PHP o arrays del cliente.

Si el LLM no compone tras reintentos (gateway + validación): fase `compose_failed` — ver [SPEC_APP_ADVENTURE_LLM_NARRATIVE.md](SPEC_APP_ADVENTURE_LLM_NARRATIVE.md) §1.2. Tests PHPUnit inyectan `AiGateway` con `chatFn`; no catálogos legacy.

---

## 5. Cierre de sesión y «Hasta pronto»

| Gatillo | Copy / UX |
| --- | --- |
| Cupo / minutos agotados | Mentor explica que el viaje **pausa** (descanso, estrellas, fogata); CTA «Hasta la próxima visita» o «Guardar y salir» |
| Quest intro incompleta | «Podemos seguir otro día en el Bosque…»; **no** fingir que la zona está resuelta |
| Quest intro completa | Celebración + invitar a otra zona o cerrar |
| Usuario elige salir (PIN) | Beat corto de despedida |

**Prohibido:** label «Hasta pronto» en un `continue` genérico sin prosa que diga **por qué** termina el tramo.

---

## 6. Claridad de input (diálogo)

Extiende [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md) §1.1:

| Situación | `input_mode` | UI obligatoria |
| --- | --- | --- |
| Elección de zona / camino / NPC | `options_only` (o `options_or_text` si se permite nombre libre) | Chips/cartas con label (+ description si pitch) |
| Reto con opciones | `options_only` / `options_or_text` | Chips; si texto libre, placeholder: «Escribe tu respuesta al reto…» |
| Solo texto libre narrativo | `text_only` | El **texto del mentor** incluye instrucción explícita («Cuéntame qué haces» / «Escribe el número») |
| Seguir prosa | `continue` | Un CTA con label motivado («Seguir el sendero», «Escuchar al guardián») — no genérico opaco |
| Esperando plan | `blocked` | Spinner; nunca chips vacíos |

**Invariante de validación:** si `input_mode` ∈ {`options_only`, `options_or_text`} y `options` tiene &lt; 2 ítems → rechazar envelope → re-prompt o `compose_failed`.

Si el mentor dice «elige» / «escoge» / «camino» en el texto, el envelope **debe** traer options o instrucción de texto libre en la misma burbuja.

---

## 7. UI — cajetín de aventura más alto

Ver delta en [SPEC_APP_SECTION_FRAME.md](SPEC_APP_SECTION_FRAME.md) §2.2b y [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md) §1.4.

En `#/play/:childId` el marco glass baja hacia el paisaje (menor `bottom` %) para leer **más historial de golpe** sin perder compose anclado al pie.

---

## 8. Modelo de datos / effects (deltas)

Sin tablas nuevas obligatorias si ya existen `narrative_quests`, `story_beats`, `journey_decisions`.

Campos / usos reforzados:

| Pieza | Cambio |
| --- | --- |
| `narrative_quests.steps_total` | ≥ 3 en quest intro de zona |
| `learning_gates` | Una entrada por gate; `done` al completar reto |
| `story_beats.choices_offered` | Incluye description/why en choose_zone |
| `meta.phase` | Catálogo §4.1; nunca null en adventure activo |
| `meta.npc_ids` | Lista de arquetipos presentes en el beat |

---

## 9. Criterios de aceptación

1. Post-examen: 2–3 zonas con `label` + `description` + `why_for_you`; elección persistida con options ofrecidas.
2. Entrada a zona: ≥2 beats narrativos (llegada + NPC/problema) **antes** del primer reto.
3. Quest intro: ≥3 retos (o N config) antes de marcar zona intro completa; entre retos hay narración.
4. Dificultad del primer reto ≠ plantilla L1 hardcodeada si el nivel de materia es ≥ L3 (test).
5. Tras un reto intermedio: no CTA «Hasta pronto» sin `session_wrap`; hay continuar en zona u opción de pausa motivada.
6. Ningún turno adventure pide elegir camino sin chips o sin instrucción explícita de texto.
7. Tras `continue` en adventure, no se invoca LLM libre sin phase del planificador.
8. Diario: orden §1.4 de JOURNEY_MEMORY; pitches y decisión legibles.
9. Play: marco más alto (§7); viewport 390×844 validado con Playwright.
10. PHPUnit: planificador de fases; validación options; fixtures de quest multi-gate.

## Aprobación

- [ ] Pitches de zona post-examen (§2)
- [ ] Arco multi-reto por zona (§3)
- [ ] Planificador anti-hueco + cierre motivado (§4–5)
- [ ] Claridad de input (§6)
- [ ] Cajetín play más alto (§7)
- [ ] Criterios §9 como puerta de implementación
