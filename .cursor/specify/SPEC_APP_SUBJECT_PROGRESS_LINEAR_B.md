# Spec: Progreso por materia — modelo lineal «Opción B»

> Estado: **aprobada — pendiente de implementación completa** (16 ago 2026)  
> Relacionado: [SPEC_APP_CREW_PROGRESS.md](SPEC_APP_CREW_PROGRESS.md), [SPEC_APP_ADVENTURE_SESSION.md](SPEC_APP_ADVENTURE_SESSION.md), [SPEC_APP_JOURNEY_MECHANICS.md](SPEC_APP_JOURNEY_MECHANICS.md), [SPEC_APP_PLAY_PROGRESS_HUD.md](SPEC_APP_PLAY_PROGRESS_HUD.md), [SPEC_APP_DEBUG_JOURNEY_REWIND.md](SPEC_APP_DEBUG_JOURNEY_REWIND.md), [SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md), [SPEC_APP_PROGRESSION_RANKS.md](SPEC_APP_PROGRESSION_RANKS.md)

## Contexto

Hoy el progreso de materia en caminos usa una **media móvil exponencial (EMA)** con `α = 0.35` en cada reto (`SubjectProgressService.record_path_challenge`). Eso produce:

1. **Salto inicial:** la UI muestra **10%** con `accuracy_rolling = null`, pero el primer acierto parte de base interna **0.5** → barra ~**84%**.
2. **Demasiado rápido:** con **2 aciertos** el rolling llega a ~0.79 → barra ~**99%**, sin completar el camino ni acumular 4 caminos.
3. **Rebobinado:** el rewind en fases de aventura no truncaba `user_subject_levels` (bug corregido 16 ago 2026); la barra podía quedar inflada tras deshacer turnos.

La **Opción B** sustituye el EMA por incrementos **lineales y predecibles** por acierto en retos de camino, calibrados para que **4 caminos completos** (con retos acertados) llenen la barra de L*k* → L*{k+1}*.

---

## Objetivo

1. Definir constantes, fórmulas y eventos que gobiernan `user_subject_levels.accuracy_rolling` tras retos de **caminos** (`path_challenge`).
2. Alinear la barra tutor (`CrewProgressService`) y el HUD general en play con la misma semilla y la misma escala.
3. Mantener el examen de placement como fuente de `level_id` inicial **sin** mezclar su lógica con caminos.
4. Documentar interacción con rewind, effects del turno y subida de nivel general / rango.

El niño **no** ve `L*` en play por defecto; el tutor **sí** en tripulación ([SPEC_APP_CREW_MEMBER_DETAIL.md](SPEC_APP_CREW_MEMBER_DETAIL.md)).

---

## 1. Principios (decisiones)

| # | Principio | Decisión |
| --- | --- | --- |
| P1 | Granularidad | **Un acierto en reto de camino** → +Δ fijo al rolling; **un fallo** → sin cambio (reintento narrativo) |
| P2 | Camino completo | No hay bonificación extra al cerrar el camino; el último reto ya aportó su Δ |
| P3 | Umbral de subida | `rolling ≥ THRESHOLD_UP` → subida de **nivel de materia** (L*k* → L*{k+1}*) en el mismo turno que cruza el umbral |
| P4 | Calibración | **4 caminos** × **3 retos** = **12 aciertos** desde semilla → umbral (barra 10% → 100%) |
| P5 | Caminos con N retos ≠ 3 | Δ **no** depende del N real del pack; siempre el mismo incremento por acierto (normalización pedagógica) |
| P6 | Semilla coherente | Tras placement, sin práctica en caminos: rolling interno = `SEED_ROLLING` (barra **10%**), no `null` con salto oculto |
| P7 | Tras subir nivel | `rolling` vuelve a `SEED_ROLLING`; no usar 0.55 ni EMA residual |
| P8 | Placement | El examen fija `level_id` por materia; **no** modifica rolling de caminos (rolling post-placement = semilla hasta primer acierto) |
| P9 | Retroceso | Sin bajar nivel por fallos en retos MVP; `threshold_down` solo para hints tutor (futuro) |
| P10 | Rewind | Truncar filas `user_subject_levels` con `updated_at > anchor_at` en fases post-placement (ya implementado); V2 opcional: recalcular desde ledger |

---

## 2. Constantes (calibración Opción B)

Valores por defecto; tunables en `SubjectProgressService` (o módulo `subject_progress_config.py`).

| Constante | Valor | Descripción |
| --- | --- | --- |
| `THRESHOLD_UP` | `1.0` | Rolling al **100%** de barra; subida de nivel en ese umbral |
| `SEED_ROLLING` | `0.10` | Rolling inicial post-placement / tras subida de nivel → **10%** de barra |
| `PATHS_PER_LEVEL_UP` | `4` | Caminos **completos** de referencia para llenar la barra |
| `CHALLENGES_PER_PATH_NORM` | `3` | Retos de referencia por camino (normalización) |
| `REQUIRED_CORRECT_CHALLENGES` | `12` | `PATHS_PER_LEVEL_UP × CHALLENGES_PER_PATH_NORM` |
| `DELTA_PER_CORRECT` | `0.075` | `(THRESHOLD_UP − SEED_ROLLING) / REQUIRED_CORRECT_CHALLENGES` |

### 2.1 Incrementos visibles (barra tutor / HUD)

La barra usa la fórmula existente ([SPEC_APP_CREW_PROGRESS.md](SPEC_APP_CREW_PROGRESS.md) §3.1):

```
percent_to_next = clamp(0, 100, round((accuracy_rolling / THRESHOLD_UP) * 100))
```

Con `SEED_ROLLING = 0.08` → **10%** inicial.

| Evento | Δ rolling | Δ barra típico (redondeo entero) |
| --- | --- | --- |
| 1 acierto (desde semilla) | +0.06 | 10% → **18%** |
| 2º acierto | +0.06 | 18% → **25%** |
| 3º acierto (≈ 1 camino) | +0.06 | 25% → **33%** |
| 4º–6º (≈ 2 caminos) | +0.06 c/u | ~**+8%** redondeado por paso |
| 7º–9º (≈ 3 caminos) | +0.06 c/u | idem |
| 10º–12º (≈ 4 caminos) | +0.06 c/u | llega a **100%** y dispara subida |

**Resumen pedagógico:** ~**8% de barra por reto acertado** (media); ~**23–25% por camino** de 3 retos; **4 caminos** para subir de L1→L2 en esa materia (si todos los retos se aciertan).

Tabla de referencia (rolling tras k aciertos consecutivos desde semilla, sin fallos):

| k aciertos | rolling | percent_to_next |
| --- | --- | --- |
| 0 | 0.08 | 10 |
| 1 | 0.14 | 18 |
| 2 | 0.20 | 25 |
| 3 | 0.26 | 33 |
| 4 | 0.32 | 40 |
| 5 | 0.38 | 48 |
| 6 | 0.44 | 55 |
| 7 | 0.50 | 63 |
| 8 | 0.56 | 70 |
| 9 | 0.62 | 78 |
| 10 | 0.68 | 85 |
| 11 | 0.74 | 93 |
| 12 | 0.80 | 100 |

El **nivel sube** en el turno que deja `rolling ≥ 0.80` (normalmente el **12º acierto** si la semilla era `SEED_ROLLING`).

---

## 3. Fuentes de verdad

| Dato | Ubicación |
| --- | --- |
| Nivel por materia | `user_subject_levels.level_id` |
| Progreso hacia siguiente L | `user_subject_levels.accuracy_rolling` (0–1, escala lineal hacia `THRESHOLD_UP`) |
| Origen del último cambio | `user_subject_levels.source` — valores: `placement`, `path_challenge`, `path_level_up` |
| Nivel general | `children.general_level` + `child_world_progress.general_level` |
| Rango | `children.rank_id`, `rank_track` |
| Estado de camino en sesión | Ledger `path_progress` en `events.jsonl` (no sustituye rolling en PG) |

**No** se introduce columna nueva en MVP: `accuracy_rolling` sigue siendo el acumulado lineal (no «precisión EMA»).

---

## 4. Eventos que modifican rolling

### 4.1 Placement completado

Al cerrar placement ([SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md)):

- Upsert `user_subject_levels` con `level_id` calculado por materia.
- `accuracy_rolling = SEED_ROLLING` (no `null`).
- `source = placement`.

Así la barra tutor muestra **10%** coherente con el valor interno.

### 4.2 Reto de camino — acierto (`path_challenge`, score = 1.0)

Invocado desde `DialogueService._path_challenge_answer` cuando `_score_placement_item ≥ 1.0`.

```
new_rolling = min(THRESHOLD_UP, current_rolling + DELTA_PER_CORRECT)
```

- Si antes no existía fila: `current_rolling = SEED_ROLLING`.
- **No** aplicar EMA ni `PATH_COMPLETE_BONUS`.
- Persistir `source = path_challenge`.
- Emitir effect:

```json
{
  "type": "record_learning_result",
  "subject_id": "math",
  "score": 1.0,
  "accuracy_rolling": 0.14,
  "level_id": "L1",
  "rolling_delta": 0.06,
  "rolling_model": "linear_b"
}
```

### 4.3 Reto de camino — fallo (score = 0.0)

- **No** modificar `accuracy_rolling`.
- **No** emitir `record_learning_result` (o emitir con `rolling_delta: 0` solo si el cliente necesita telemetría).
- Flujo narrativo: feedback + `path_intro` con `retry: true` (existente).

### 4.4 Subida de nivel de materia

Tras aplicar Δ en §4.2, si `new_rolling >= THRESHOLD_UP` y `level_index(level_id) < 5`:

1. `level_id` → `L{k+1}`.
2. `accuracy_rolling` → `SEED_ROLLING` (barra vuelve a **10%** en la nueva L).
3. `source` → `path_level_up`.
4. Effects adicionales:

```json
{ "type": "update_subject_level", "subject_id": "math", "level_id": "L2" }
```

5. Recalcular `general_level` (misma ponderación que placement).
6. Si procede, `grant_rank` ([SPEC_APP_PROGRESSION_RANKS.md](SPEC_APP_PROGRESSION_RANKS.md)).

La subida puede ocurrir **en el último reto del camino** o en un reto intermedio si el rolling ya estaba alto (datos legacy).

### 4.5 Camino completado (`finalize_path_completion`)

- **Eliminar** la mezcla EMA con `score = 1.0` y `PATH_COMPLETE_BONUS = 0.08`.
- La función solo:
  - Comprueba si falta subida de nivel (por si el umbral se alcanzó pero no se procesó).
  - Dispara informe tutor / recompensas / `path_completed` (lógica existente en `dialogue.py`).
- **No** añade rolling por «cerrar camino» si los retos ya lo hicieron.

### 4.6 Retos con equipaje / ayudas

Si un reto se resuelve con ítem ([SPEC_APP_PLAY_CHALLENGE_BAGGAGE_OFFER.md](SPEC_APP_PLAY_CHALLENGE_BAGGAGE_OFFER.md)) y el servidor marca **acierto**:

- Mismo Δ que un acierto normal (el ítem no acelera la barra en MVP).

Futuro: flag tutor `learning.progress_boost` podría multiplicar Δ (fuera de este corte).

---

## 5. Presentación UI

### 5.1 Tripulación — pestaña Progreso

Reutilizar `LevelProgressDto` ([SPEC_APP_CREW_PROGRESS.md](SPEC_APP_CREW_PROGRESS.md) §2).

Cambios de copy en hints:

| Situación | `hint_tutor` |
| --- | --- |
| `rolling == SEED_ROLLING` y sin caminos recientes | «Nivel L{k} en {materia} — aún sin práctica en caminos.» |
| `rolling` entre semilla y umbral | «Nivel L{k} en {materia}.» |
| `rolling >= THRESHOLD_UP` antes de commit de subida | «Cerca de subir a L{k+1} en {materia}.» (solo si el nivel aún no subió en PG) |
| Tras subida | Barra 10% en el nuevo L |

**Eliminar** la condición `recent_attempts >= 4` para el hint «Cerca de subir»; usar `rolling >= THRESHOLD_UP - DELTA_PER_CORRECT` o `percent >= 93`.

### 5.2 Play — HUD general

[SPEC_APP_PLAY_PROGRESS_HUD.md](SPEC_APP_PLAY_PROGRESS_HUD.md): sin cambio de layout; la barra general sigue siendo media ponderada de materias. El ritmo más lento en cada materia hace que el HUD general también suba más despacio.

### 5.3 Animación de barra (cliente)

Opcional MVP: al recibir `record_learning_result` con `rolling_delta > 0`, animar +N% en la ficha si está abierta. No obligatorio para cerrar esta spec.

---

## 6. API y contrato de effects

### 6.1 Rutas afectadas

| Ruta | Cambio |
| --- | --- |
| `POST /api/v1/play/.../turn` | Effects `record_learning_result` con `rolling_model: "linear_b"` |
| `GET /api/v1/crew/:childId` | Barras coherentes con nuevo rolling |
| `POST /api/v1/play/.../open` | Tras placement, materias con rolling = semilla |

### 6.2 Compatibilidad cliente

`web/js` que consuma `record_learning_result`:

- Ignorar campos nuevos desconocidos.
- Refrescar progreso si `type` es `record_learning_result`, `update_subject_level`, `set_general_level`.

---

## 7. Rebobinado (debug)

[SPEC_APP_DEBUG_JOURNEY_REWIND.md](SPEC_APP_DEBUG_JOURNEY_REWIND.md) §4.1:

| Fase pending | `user_subject_levels` |
| --- | --- |
| Post-placement (`choose_path`, `path_challenge`, …) | `DELETE` filas con `updated_at > anchor_at` **o** recalcular (V2) |

**MVP (Opción B):** truncar por `updated_at` (implementado 16 ago 2026).

**V2 (recomendado):** tras truncar ledger, **reconstruir** rolling desde:

1. Semilla placement para la materia.
2. Sumar `DELTA_PER_CORRECT` por cada acierto conservado en `path_progress` / turnos `path_challenge_echo` con `choice_correct: true` posteriores al ancla.

Esto evita perder progreso legítimo anterior al ancla cuando solo se deshace un camino reciente.

---

## 8. Migración y datos legacy

### 8.1 Viajeros en desarrollo (local)

Script opcional `python -m app.scripts.reset_subject_rolling --child-id … --subject math` o SQL:

```sql
update user_subject_levels
set accuracy_rolling = 0.08, source = 'placement', updated_at = now()
where child_id = :cid and world_theme = :theme and subject_id = :sid;
```

### 8.2 Producción (futuro)

| Escenario | Acción |
| --- | --- |
| `accuracy_rolling` alto por EMA legacy | Cap a `THRESHOLD_UP` o reset a semilla por materia con `source != placement` |
| `accuracy_rolling IS NULL` | Set `SEED_ROLLING` |
| Nivel ya L2+ con rolling incoherente | Mantener `level_id`; reset rolling a semilla |

No backfill histórico de aciertos desde ledger en MVP.

---

## 9. Implementación (referencia)

| Componente | Cambio |
| --- | --- |
| `backend/app/services/subject_progress.py` | Sustituir `_blend_rolling` / EMA por incremento lineal; eliminar bonus en `finalize_path_completion` |
| `backend/app/services/dialogue.py` | Sin cambio de flujo; solo effects del servicio |
| `backend/app/services/crew_progress.py` | Semilla: si `accuracy_rolling == SEED_ROLLING`, hint coherente; quitar default 0.5 implícito |
| `backend/app/services/placement*.py` o seed post-placement | Inicializar rolling = `SEED_ROLLING` |
| `backend/tests/unit/test_subject_progress.py` | Tabla §10 |
| `backend/tests/unit/test_journey_rewind.py` | Rewind trunca rolling post-ancla |

---

## 10. Tests

| ID | Test | Assert |
| --- | --- | --- |
| T1 | `linear_delta_from_seed` | 1 acierto: rolling = 0.14, percent = 18 |
| T2 | `linear_twelve_correct` | 12 aciertos desde semilla: rolling = 0.80, level L1→L2, rolling reset 0.08 |
| T3 | `wrong_answer_no_change` | Fallo: rolling unchanged |
| T4 | `path_complete_no_bonus` | Completar camino sin acierto extra no suma rolling |
| T5 | `three_correct_per_path` | 3 aciertos: rolling = 0.26, percent = 33 |
| T6 | `placement_seed` | Tras placement, rolling = SEED_ROLLING en todas las materias |
| T7 | `crew_progress_percent` | `CrewProgressService` 10% con semilla |
| T8 | `rewind_truncates_rolling` | Rewind post-placement elimina incrementos posteriores al ancla |
| T9 | `general_level_recalc` | Subida math L2 actualiza general si ponderación lo exige |
| T10 | `effect_payload` | `rolling_model == linear_b`, `rolling_delta == 0.06` |

---

## 11. Criterios de aceptación

1. Tras placement, cada materia activa muestra **10%** en tripulación y rolling interno **0.08**.
2. Un acierto en reto de camino sube la barra ~**8%** (redondeo), no ~74%.
3. **12 aciertos** consecutivos en la misma materia (desde semilla) suben **un** nivel L (ej. math L1→L2) y dejan la barra en **10%** del nuevo nivel.
4. Un camino de **3 retos** acertados suma ~**23–33%** de barra según redondeo (≈ 25% objetivo).
5. Fallar un reto **no** baja la barra.
6. Completar camino **no** añade bonificación extra de rolling.
7. Rebobinar en debug durante/tras caminos revierte incrementos posteriores al ancla (MVP: truncado PG).
8. HUD general en play refleja el ritmo más lento (media ponderada).
9. Tests §10 en verde.

---

## 12. Supersede / relación con otras specs

| Documento | Relación |
| --- | --- |
| [SPEC_APP_CREW_PROGRESS.md](SPEC_APP_CREW_PROGRESS.md) §3.1 | **Amplía:** sustituye EMA y default 0.5; mantiene fórmula `percent_to_next` |
| [SPEC_APP_ADVENTURE_SESSION.md](SPEC_APP_ADVENTURE_SESSION.md) §5.1 | **Ajusta:** «rolling↑ por reto» con Δ fijo; subida L con 12 aciertos / 4 caminos |
| [SPEC_APP_DEBUG_JOURNEY_REWIND.md](SPEC_APP_DEBUG_JOURNEY_REWIND.md) | **Compatible;** V2 recálculo opcional |
| Implementación EMA actual | **Deprecada** tras aprobación de esta spec |

---

## 13. Fuera de alcance (MVP)

- Bajar nivel por racha de fallos (`threshold_down`).
- Δ distinto por dificultad o `effective_age_band`.
- Barra por materia en HUD play (solo general).
- Recálculo rewind desde ledger (V2).
- Multiplicador tutor en `settings.learning`.

---

## Aprobación

- [x] Constantes §2 (`4 caminos`, `3 retos`, Δ = 0.075, umbral 1.0) aceptadas
- [x] Fallo sin penalización §4.3 aceptado
- [x] Reset a semilla tras subida de nivel §4.4 aceptado
- [x] Migración legacy §8 aceptada
- [x] Implementación autorizada en `SubjectProgressService` + placement seed
