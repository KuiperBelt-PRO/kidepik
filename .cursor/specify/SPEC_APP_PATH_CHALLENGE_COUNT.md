# Spec: Retos por camino — recuento configurable por tutor

> Estado: **implementada** (23 ago 2026)  
> Relacionado: [SPEC_APP_SUBJECT_PROGRESS_LINEAR_B.md](SPEC_APP_SUBJECT_PROGRESS_LINEAR_B.md), [SPEC_APP_PATH_COMPOSER_TUTOR_CONTEXT.md](SPEC_APP_PATH_COMPOSER_TUTOR_CONTEXT.md), [SPEC_APP_PATH_COMPOSER_PARALLEL_REUSE.md](SPEC_APP_PATH_COMPOSER_PARALLEL_REUSE.md), [SPEC_APP_JOURNEY_MECHANICS.md](SPEC_APP_JOURNEY_MECHANICS.md), [SPEC_APP_CREW_MEMBER_DETAIL.md](SPEC_APP_CREW_MEMBER_DETAIL.md), [SPEC_APP_CREW_PROGRESS.md](SPEC_APP_CREW_PROGRESS.md), [SPEC_APP_PLAY_PROGRESS_HUD.md](SPEC_APP_PLAY_PROGRESS_HUD.md), [SPEC_APP_DEBUG_JOURNEY_REWIND.md](SPEC_APP_DEBUG_JOURNEY_REWIND.md), [SPEC_APP_REWARDS_ECONOMY.md](SPEC_APP_REWARDS_ECONOMY.md), [SPEC_AI_PYDANTIC_AGENTS.md](SPEC_AI_PYDANTIC_AGENTS.md), [SPEC_APP_AGE_BANDS.md](SPEC_APP_AGE_BANDS.md)  
> **Diagrama:** [16-journey-mechanics-flows.md](../diagrams/16-journey-mechanics-flows.md) §3  
> **UI:** [DESIGN.md](../DESIGN.md) §10 stepper glass

## Contexto

Hoy cada camino de práctica tiene **exactamente 3 retos** de forma rígida:

| Capa | Comportamiento actual |
| --- | --- |
| Ajuste tutor | No existe. `children.settings.learning` no guarda recuento. |
| `path_composer` | Prompt, skill `backend/agents/path_composer.md` y parse (`_PATH_MIN_CHALLENGES = 3`) exigen 3; el parse **trunca** `challenges[:3]` aunque el LLM devuelva más. |
| Play | Completar camino usa `len(challenges)` del pack (ya variable en runtime), pero el pack siempre llega con 3. HUD: «Reto *k* de *total*». |
| Progreso | [Linear B](SPEC_APP_SUBJECT_PROGRESS_LINEAR_B.md) P5: Δ **fijo** `0.075` por acierto, **independiente** del N real del pack. 4 caminos × 3 retos = 12 aciertos → umbral. |

El tutor necesita acortar o alargar el camino (atención, sesión, refuerzo) **sin** cambiar el número de caminos de la encrucijada (sigue habiendo **3 propuestas**).

## Objetivo

1. El tutor elige **cuántos retos tiene cada camino** de ese tripulante: **mínimo 3**, **máximo 10**. Si no lo ha fijado, el default es **3 o 5 según la banda de edad**.
2. El agente `path_composer` genera **exactamente N** retos (prompt, envelope, validador estructural, fallback).
3. El registro de progreso por acierto usa **el N de ese camino** (Δ por acierto = fracción de un camino; **4 caminos completos** siguen llenando la barra de materia). Un solo camino **no** sube de L.
4. Play, cierre de camino, HUD, rewind y logs respetan el N **horneado en el pack**, no el ajuste en caliente.

El examen de acceso (**placement**) **no** cambia: su N de ítems es otro contrato.

---

## 1. Decisiones (aprobadas 23 ago 2026)

| # | Decisión | Valor |
| --- | --- | --- |
| C1 | Ámbito | Por **tripulante** (`children.settings.learning.challenges_per_path`). Misma N en fantasy y sci-fi. **No** por materia. |
| C2 | Rango | Entero **3–10**. Default **según banda** (§1.2) si la clave falta. |
| C3 | Exactitud | El pack debe tener **exactamente N** retos. Menos → rechazo estructural. Más → se toman los **primeros N** (tras validar MCQ de esos N). |
| C4 | Encrucijada | Sigue habiendo **3 caminos** en paralelo. N afecta a retos **dentro** de cada camino, no al número de chips. |
| C5 | Progreso | **4 caminos completos** = 1 subida de L de materia. Δ por acierto **sí depende de N** del camino que se puntúa. **Supersede** Linear B P5. Un camino no basta para subir de nivel. |
| C6 | Fuente de N al puntuar | `len(path.challenges)` del pack activo (horneado). Si falta, `payload.challenges_per_path`, si no el default de banda del child (§1.2), si no **3**. **No** releer el ajuste tutor en el turno. |
| C7 | Cuándo aplica un cambio de N | **Siguiente compose.** Camino en curso y slots ya en el pack conservan su N. No se invalida el pack al guardar el ajuste. |
| C8 | Fallo de reto | Sin cambio (Linear B P1): fallo no mueve rolling; reintento del mismo índice. |
| C9 | Cierre de camino | Sigue siendo «N aciertos de ese pack» (`challenge_index >= len(challenges)`). Sin bonus extra de rolling al cerrar. |
| C10 | Recompensas | Grant de **cierre de camino** igual que hoy (por camino, no por N). Grants por reto aprobado no se reescalan. |
| C11 | UI | Pestaña **Progreso** de `#/crew/:childId`, bloque «Materias de aprendizaje». Stepper glass **3–10**. Guardado **al instante** (como el interruptor de materia). Solo tutor; `#/member` no lo muestra. |
| C12 | Hogar | Sin `crew_defaults.challenges_per_path` en este corte. Altas nuevas **no** persisten la clave: el compose usa el default de banda. |
| C13 | Placement / first-run | Fuera de alcance. |

### 1.1 Por qué C5 (Δ escala con N)

Si Δ se quedara en `0.075` con N=10, **~12 aciertos** (un camino y pico) subirían de L. El tutor alargaría el camino y a la vez aceleraría el nivel: efecto contrario al de «más práctica por camino».

Con C5, **completar un camino aporta ~25 % de barra** sea N=3 o N=10. Hacen falta **4 caminos**. Más retos = más práctica **dentro** del mismo tramo hacia el siguiente L; no más L por minuto.

### 1.2 Default según banda de edad

Fuente: `children.age_band` **cronológica** ([SPEC_APP_AGE_BANDS.md](SPEC_APP_AGE_BANDS.md)), **no** `effective_age_band` (ese mueve dificultad, no duración de sesión).

Si no hay `age_band`, derivar de `age_years`. Si tampoco hay edad: **3**.

| `age_band` | Edades | Default N | Motivo |
| --- | --- | --- | --- |
| `band_early` | 5–7 | **3** | Atención corta, lectura breve |
| `band_child` | 8–10 | **3** | Camino compacto |
| `band_tween` | 11–13 | **5** | Más texto y práctica por ruta |
| `band_teen` | 14–17 | **5** | Idem |
| `band_adult` | 18–64 | **5** | Idem |
| `band_senior` | 65–99 | **3** | Ritmo cómodo (misma spec de bandas) |

Función: `default_challenges_per_path(age_band) → 3 | 5`.

**Sticky vs adaptativo:**

| Situación | N efectivo |
| --- | --- |
| Clave **ausente** / `null` | Default de la banda **actual** (si el tutor cambia la edad, el default se mueve) |
| Tutor ha hecho PATCH de la clave | El entero persistido (3–10), aunque cambie la edad |

No se escribe la clave al crear el miembro ni al cambiar solo la edad.

---

## 2. Contrato de datos

### 2.1 Campo

```ts
children.settings.learning.challenges_per_path?: number; // entero 3..10; omitir = default de banda
```

| Lectura | Valor efectivo |
| --- | --- |
| clave ausente / `null` | `default_challenges_per_path(age_band)` |
| entero 3–10 | ese valor |
| otro (float, string, 0, 1, 2, 11, `[]`) | **422** en PATCH; en lectura defensiva (compose/play) clamp a 3–10 o default de banda |

No hay migración SQL: `settings` ya es JSONB. No se reescribe el JSON de miembros existentes hasta el primer guardado del stepper.

### 2.2 Normalización (servidor)

Funciones: `default_challenges_per_path(age_band)`, `effective_challenges_per_path(raw, age_band)` + espejo JS `defaultChallengesPerPath` / `effectiveChallengesPerPath`.

```
si PATCH no incluye la clave → no tocar
si PATCH incluye la clave:
  debe ser int (no bool)
  si n < 3 o n > 10 → ValueError → 422
  persistir n
lectura / compose:
  si raw es int 3–10 → raw
  si no → default_challenges_per_path(age_band)
```

`PATCH /api/v1/crew/:id` con `learning: { challenges_per_path }` **fusiona** esa clave; no borra `active_subjects`, notas ni prioridades.

Bool `true`/`false` **no** se coerce a 1/0.

### 2.3 Exposición API

| Ruta | Campo |
| --- | --- |
| `GET /api/v1/crew/:id` | `settings.learning.challenges_per_path` solo si el tutor lo fijó. El cliente calcula el efectivo con `age_band` + helper. Opcional: `challenges_per_path` top-level = efectivo (si se añade, documentar que es derivado). |
| `PATCH /api/v1/crew/:id` | `learning.challenges_per_path` |
| `GET /api/v1/member` | **No** incluir (ajuste tutor) |
| Play `open` / `turn` | No hace falta el ajuste; el pack ya trae `challenges[]`. Meta de turno ya tiene `index` + `total`. |

### 2.4 Ledger (horneado)

En cada entrada de `path_pack` y en eventos `path_progress`:

```json
{
  "path_id": "…",
  "subject_id": "math",
  "challenges_per_path": 5,
  "challenges": [ "… exactamente 5 …" ]
}
```

`challenges_per_path` es redundante con `len(challenges)` y existe para rewind/logs si el blob se recorta. Al escribir el pack: `challenges_per_path = len(challenges)`.

---

## 3. UI tutor (Progreso)

Viewport **390×844**. Controles glass ([DESIGN.md](../DESIGN.md)): stepper `glass-stepper` (mismo patrón que edad; **min 3, max 10**), no slider de minutos ni `<select>` nativo.

### 3.1 Colocación

Bloque existente **«Materias de aprendizaje»** (`data-subjects-block`), **encima** de la nota general:

```
┌─────────────────────────────────┐
│ Materias de aprendizaje         │
│ Retos por camino                │
│  [ − ]  3  [ + ]                │
│ Cada camino tendrá 3 retos.     │
│ 4 caminos completos suben de    │
│ nivel en esa materia. Aplica a  │
│ los próximos caminos generados. │
│ … nota general + grid materias  │
└─────────────────────────────────┘
```

| Elemento | Contrato |
| --- | --- |
| Label | «Retos por camino» |
| Valor vivo | Entero 3–10 (efectivo), `aria-live="polite"` |
| Helper | «Cada camino tendrá {N} retos. Cuatro caminos completos suben de nivel en esa materia. Aplica a los próximos caminos que se generen, no al que esté en curso.» |
| Default de edad | Si la clave no está fijada, línea extra: «Por defecto para su edad: {3 o 5}.» |
| Guardado | PATCH al soltar el stepper (cambio confirmado), toast «Guardado» ([SPEC_APP_GLASS_TOAST.md](SPEC_APP_GLASS_TOAST.md)). No esperar a «Guardar notas». |
| Perfil tutor | Oculto (`is_tutor_profile`). |
| `#/member` | Oculto. |

Si N=10, el helper puede añadir: «Los caminos serán más largos y tardarán más en generarse.»

### 3.2 Estados

| Estado | UI |
| --- | --- |
| Carga | Skeleton `panel` del bloque materias (existente); el stepper no aparece hasta `GET` OK |
| Error PATCH | Toast error; el stepper **revierte** al valor persistido / efectivo anterior |
| − en 3 / + en 10 | Botón deshabilitado (`opacity: 0.45`) |

---

## 4. Path composer

### 4.1 Inyección al prompt

`DialogueService._path_compose_prompt` (y skill `backend/agents/path_composer.md`) dejan de decir «3 retos» fijo.

Bloque normativo (N = recuento **efectivo** del child: persistido o default de banda):

```
Genera EXACTAMENTE {N} retos (ni uno más ni uno menos).
Los {N} practican la misma lección; cada uno con ejemplo nuevo.
```

El skill § «Orden de escritura» punto 4 pasa a: **«Escribe exactamente N retos»**, con N inyectado en el user prompt (el `.md` puede decir «N lo indica el prompt de la llamada»).

### 4.2 Envelope Pydantic

`PathDetail.challenges`: `min_length=3`, `max_length=10` (hoy no hay tope). El **corte exacto N** lo hace el parse de diálogo, no el envelope (el LLM a veces se pasa; se trunca a N).

### 4.3 Parse / calidad estructural

Sustituir `_PATH_MIN_CHALLENGES = 3` por N de la llamada (`expected_challenge_count`, siempre ≥ 3).

| Condición | `issue` | Acción |
| --- | --- | --- |
| `len(challenges) < N` | `path_challenge_count_short` | Rechazo duro + log + reintento slot |
| `len(challenges) > N` | — | Usar `challenges[:N]`; log suave `path_compose_challenge_count_truncated` (`received`, `expected`) |
| MCQ no puntuable en alguno de los N | códigos actuales | Rechazo duro de ese slot |

Validar MCQ de **los N retos usados**, no solo los 3 primeros.

T12 de [PATH_COMPOSER_TUTOR_CONTEXT](SPEC_APP_PATH_COMPOSER_TUTOR_CONTEXT.md): «duro = estructural (3 caminos, **N retos**, MCQ)».

### 4.4 Fallback de slot

Si el slot cae a plantilla, la plantilla genera **exactamente N** retos puntuables (hoy genera 3). Misma N que el prompt de esa llamada.

### 4.5 Logs (`compose`)

| message | Campos extra |
| --- | --- |
| `path_compose_path_parse_failed` (`path_challenge_count_short`) | `expected_count`, `challenges_received` (ya existe received; añadir expected) |
| `path_compose_challenge_count_truncated` | `expected_count`, `challenges_received`, `slot_index`, `subject_id` |
| `path_compose_slot_ok` | `challenge_count` (= N persistido) |

### 4.6 Recaps / slices

Cualquier `challenges[:3]` en recap de mentor, quality o pack **pasa a** `challenges[:N]` o a la lista completa del pack. No dejar un techo 3 oculto.

---

## 5. Play (sesión)

El flujo de [JOURNEY_MECHANICS](SPEC_APP_JOURNEY_MECHANICS.md) §5.1 («Reto 1..N») ya es correcto si `total = len(challenges)`.

| Superficie | Contrato |
| --- | --- |
| HUD diálogo | «Reto *k* de *total*» / «Secuencia *k* de *total*» (ya usa `meta.total`) |
| Completar camino | `challenge_index >= len(challenges)` (ya implementado) |
| Regenerar camino fallido | El slot nuevo se compone con el N **efectivo actual** (puede diferir del camino fallido) |
| Refresh tras completar | Los 2 reutilizados conservan su N horneado; el slot nuevo usa el N efectivo actual |

No mezclar retos de dos packs. Un camino = un array.

---

## 6. Progreso (delta sobre Linear B)

Constantes que **no** cambian:

| Constante | Valor |
| --- | --- |
| `THRESHOLD_UP` | `1.0` |
| `SEED_ROLLING` | `0.10` |
| `PATHS_PER_LEVEL_UP` | `4` |
| `ROLLING_MODEL` | `"linear_b"` |

Constantes que **sí** dependen de N del camino puntuado:

```
span = THRESHOLD_UP − SEED_ROLLING          # 0.90
required_corrects(N) = PATHS_PER_LEVEL_UP × N
delta(N) = span / required_corrects(N)      # 0.90 / (4N)
```

`MIN_CHALLENGES_PER_PATH = 3`, `MAX_CHALLENGES_PER_PATH = 10`.  
`CHALLENGES_PER_PATH_NORM` deja de ser Δ global: el default de producto es §1.2.

### 6.1 Tabla de referencia (desde semilla, un solo N)

| N | Δ por acierto | Aciertos para subir L | Caminos para subir L | % barra por acierto (aprox.) | % barra por camino completo |
| --- | --- | --- | --- | --- | --- |
| **3** | **0.075** | **12** | **4** | **~8** | **~25** |
| 5 | 0.045 | 20 | 4 | ~5 | ~25 |
| 10 | 0.0225 | 40 | 4 | ~2 | ~25 |

N=3 coincide con Linear B vigente (`DELTA_PER_CORRECT = 0.075`).  
N=5 (default tween/teen/adult): 20 aciertos, **sigue siendo 4 caminos**.

P4 Linear B generalizado: **4 caminos × N retos = 4N aciertos** desde semilla → umbral.

### 6.2 `record_path_challenge`

Firma: además de `score`, recibir `challenges_per_path: int` (N del pack, ya ≥ 3).

```
si score < 1.0 → rolling sin cambio (igual que hoy)
si score ≥ 1.0 → rolling += delta(N); clamp a THRESHOLD_UP; posible subida L
```

Effect `record_learning_result` (campos nuevos; el cliente ignora desconocidos):

```json
{
  "type": "record_learning_result",
  "subject_id": "math",
  "score": 1.0,
  "accuracy_rolling": 0.175,
  "level_id": "L1",
  "rolling_delta": 0.075,
  "rolling_model": "linear_b",
  "challenges_per_path": 3
}
```

`rolling_delta` debe ser el `delta(N)` aplicado, no la constante 0.075.

### 6.3 Historial mixto (N cambia entre caminos)

Ejemplo: 3 aciertos con N=3 (Δ=0.075) y luego caminos con N=10 (Δ=0.0225). El rolling **acumula deltas distintos**. No se recalcula el pasado al cambiar el ajuste.

### 6.4 Rewind V2

`count_conserved_corrects` + `linear_state_after_corrects(n)` asumen Δ uniforme: **insuficiente**.

Nueva reconstrucción **por evento**, en orden cronológico, por materia:

```
rolling = SEED_ROLLING
level = level_id de placement
para cada path_progress conservado con last_ok true:
    N = payload.challenges_per_path
        o len(payload.path.challenges)
        o default de banda del child
        o 3
    N = clamp(N, 3, 10)
    rolling = min(THRESHOLD_UP, rolling + delta(N))
    si rolling >= THRESHOLD_UP y level < L5:
        level += 1
        rolling = SEED_ROLLING
```

Fallback `path_challenge_echo`: si no hay `path_progress`, usar Δ del N efectivo actual del child; documentado como peor aproximación.

### 6.5 `finalize_path_completion`

Sin cambio de rolling (P2 Linear B). Solo informe / rewards / `path_completed`.

---

## 7. Implementación (referencia)

| Capa | Archivos típicos |
| --- | --- |
| Config | `subject_progress_config.py` — `delta_per_correct(n)`, `required_corrects(n)`, `MIN/MAX`, `default_challenges_per_path(band)` |
| Bandas | `age_band.py` o el config anterior (tabla §1.2) |
| Persistencia | `backend/app/services/crew.py` — PATCH `learning.challenges_per_path` |
| Compose | `dialogue.py` (`_path_compose_prompt`, `_path_detail_to_pack_entry`, quality), `path_composer_context.py` si conviene pasar N en el context pack |
| Skill | `backend/agents/path_composer.md` |
| Envelope | `backend/app/ai/agents/envelopes.py` (`min_length=3`, `max_length=10`) |
| Progreso | `subject_progress.py` — `record_path_challenge(..., challenges_per_path=)`, rewind |
| UI | `web/js/components/crew-panel.js`, `web/js/lib/subject-catalog.js`, CSS stepper existente |
| Tests | `backend/tests/unit/test_subject_progress.py`, `test_crew_service.py`, `test_dialogue_service.py`; `web/tests/subject-catalog.test.js` |

---

## 8. Tests (fase TDD)

| ID | Caso | Assert |
| --- | --- | --- |
| N1a | Default `band_child` / `band_early` / `band_senior` | Ausente → **3** |
| N1b | Default `band_tween` / `band_teen` / `band_adult` | Ausente → **5** |
| N1c | Sin edad ni banda | Ausente → **3** |
| N2 | PATCH 3 y 10 | Persiste; GET lo devuelve |
| N3 | PATCH 0, 1, 2, 11, 3.5, true | 422 |
| N4 | PATCH parcial | No borra `active_subjects` |
| N5 | Prompt N=5 | Texto «EXACTAMENTE 5 retos» |
| N6 | Parse 4 retos con N=5 | `path_challenge_count_short` |
| N7 | Parse 7 retos con N=5 | Pack con 5; log truncated |
| N8 | Parse 3 con N=3 | Igual que hoy |
| N9 | `delta(3) == 0.075`; `delta(5) == 0.045` | Fórmula |
| N10 | 20 aciertos N=5 desde semilla | Sube L; rolling = semilla (4 caminos) |
| N11 | 12 aciertos N=3 | Igual que `linear_twelve_correct` actual |
| N12 | 1 acierto N=10 | Δ=0.0225; **no** sube L |
| N13 | Mix 3 aciertos N=3 + 1 N=10 | rolling = 0.10+3×0.075+0.0225 |
| N14 | Fallo | rolling invariante |
| N15 | Completar camino | `challenge_index >= N`; sin bonus |
| N16 | Rewind mixto | Reconstruye con deltas por evento |
| N17 | Edad cambia, clave ausente | Tween 11 años → 5; luego edad 9 → 3 |
| N18 | Edad cambia, clave fijada a 7 | Sigue 7 |
| N19 | UI helper | `effectiveChallengesPerPath(undefined, 'band_teen') === 5` |
| N20 | Perfil tutor / member | Sin control |

---

## 9. Criterios de aceptación

1. Niño 8–10 (o 5–7, o senior) sin clave: caminos de **3** retos y Δ **0.075**.
2. Tween/teen/adult sin clave: caminos de **5** retos y Δ **0.045**; **4 caminos** (20 aciertos) para subir L.
3. Tutor pone 5 en un child de default 3, guarda, próximo compose: **5** retos; HUD «Reto 1 de 5» … «5 de 5»; al 5º acierto se cierra el camino. La barra de un camino ≈ 25 %.
4. Tutor pone 10: máximo respetado. PATCH 1, 2 u 11 → **422**.
5. Cambio de N a mitad de un camino de 3: ese camino termina en 3; el compose **siguiente** usa el nuevo N.
6. Barra tutor: un camino completo ≈ **25 %** del tramo L→L+1, independiente de N (redondeo entero). Nunca un solo camino llena el tramo.
7. Rewind debug tras aciertos con N distintos restaura rolling coherente con esos N.
8. `#/member` y ficha tutor-como-miembro no muestran el stepper.
9. Tests §8 en verde; Playwright: Progreso → stepper → toast → play (fase implementación).

---

## 10. Fuera de alcance

- N distinto por materia o por mundo.
- Default de hogar / «aplicar a toda la tripulación».
- Invalidar `path_pack` al guardar N.
- Escalar grants de moneda/ítem con N.
- Cambiar N de ítems del placement.
- Multiplicador `learning.progress_boost`.
- Mostrar N al niño fuera del HUD «Reto k de total».
- Usar `effective_age_band` para el default de N.

---

## 11. Relación con otras specs (actualizar en implementación)

| Documento | Cambio |
| --- | --- |
| [SPEC_APP_SUBJECT_PROGRESS_LINEAR_B.md](SPEC_APP_SUBJECT_PROGRESS_LINEAR_B.md) | P4/P5, §2 Δ(N), rewind V2 por evento, tests T2/T5 |
| [SPEC_APP_PATH_COMPOSER_TUTOR_CONTEXT.md](SPEC_APP_PATH_COMPOSER_TUTOR_CONTEXT.md) | T12: N retos |
| [SPEC_APP_PATH_COMPOSER_PARALLEL_REUSE.md](SPEC_APP_PATH_COMPOSER_PARALLEL_REUSE.md) | `path_challenge_count_short` = &lt; N |
| [SPEC_APP_JOURNEY_MECHANICS.md](SPEC_APP_JOURNEY_MECHANICS.md) | M4 / §5: 3 MCQ → N tutor (min 3, default por banda) |
| [SPEC_APP_CREW_MEMBER_DETAIL.md](SPEC_APP_CREW_MEMBER_DETAIL.md) | Progreso: stepper 3–10 |
| [SPEC_APP_CREW_MEMBER_SETTINGS.md](SPEC_APP_CREW_MEMBER_SETTINGS.md) | Nota: el control vive en Progreso, no en Ajustes |
| [SPEC_APP_REWARDS_ECONOMY.md](SPEC_APP_REWARDS_ECONOMY.md) | Copy «cierre de camino (N retos)» |
| [SPEC_APP_AGE_BANDS.md](SPEC_APP_AGE_BANDS.md) | Enlace al default 3/5 |
| [16-journey-mechanics-flows.md](../diagrams/16-journey-mechanics-flows.md) | Compose con N; retos 1..N |
| `backend/agents/path_composer.md` | «exactamente N retos» |

---

## 12. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| N=10 alarga compose y sesión | Helper UI; tope 10; 3 slots siguen en paralelo (no 10 caminos) |
| LLM devuelve 3 por hábito cuando N=5 | Prompt + rechazo `path_challenge_count_short` + reintento |
| Truncar `[:3]` olvidado en un recap | Tests de parse + grep de `_PATH_MIN_CHALLENGES` / `[:3]` en path |
| Rewind con Δ fijo | Reescritura por evento §6.4 |
| Default de banda vs valor sticky | Tests N17 / N18 |

---

## Aprobación

- [x] C1–C13 (23 ago 2026): **mínimo 3**, default **3 o 5 según banda**, **C5 Δ escala** (4 caminos para subir L), **C7 no invalidar pack**
- [x] UI en Progreso + guardado instantáneo
- [x] Copy del helper
- [x] Autorización a implementar (TDD §8) — encargo 23 ago 2026
