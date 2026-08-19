# Spec: Contexto tutor en generación de caminos (path_composer)

> Estado: **aprobada — implementada** (15 ago 2026) — **delta 19 ago 2026:** calibración de dificultad (suelo por banda + nivel de materia).  
> Relacionado: [SPEC_APP_JOURNEY_MECHANICS.md](SPEC_APP_JOURNEY_MECHANICS.md) §5, [SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md), [SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE.md](SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE.md), [SPEC_APP_SUBJECT_PROGRESS_LINEAR_B.md](SPEC_APP_SUBJECT_PROGRESS_LINEAR_B.md), [SPEC_APP_CREW_MEMBER_DETAIL.md](SPEC_APP_CREW_MEMBER_DETAIL.md), [SPEC_APP_PRODUCT_BACKLOG_AGO2026.md](SPEC_APP_PRODUCT_BACKLOG_AGO2026.md) B11, [SPEC_AI_PYDANTIC_AGENTS.md](SPEC_AI_PYDANTIC_AGENTS.md)  
> **Diagrama:** [16-journey-mechanics-flows.md](../diagrams/16-journey-mechanics-flows.md) §3

## Contexto

El tutor escribe nota general (`learning.general_note`) y notas por materia (`learning.subject_notes[]`). Antes entraban en el prompt como línea plana sin influir en la priorización de materias ni mapearse por camino.

## Objetivo

1. Context pack estructurado para `path_composer`.
2. Priorización híbrida: niveles PG + señales del tutor.
3. Mapeo nota → camino en el prompt.
4. Sin inventario en generación (equipaje = runtime play).

## Decisiones

| # | Decisión | Valor |
| --- | --- | --- |
| T1 | Nota general | Bloque `## Contexto del tutor` |
| T2 | Notas por materia | Sub-bloque por slot de camino |
| T3 | Priorización | `0.7 × weakness_pg + 0.3 × tutor_signal` |
| T4 | Señal tutor | +1.0 si hay nota; +0.5 si palabras foco; +2.0 si `subject_priorities[]` |
| T5 | Priorizar en caminos | Checkbox UI → `learning.subject_priorities[]` |
| T6 | Diversidad | 3 `subject_id` distintos si hay ≥3 materias activas |
| T7 | Placement | `placement_tutor_sections` en `placement_item_writer` |
| T8 | Inventario | **No** en path_composer |
| T9 | Suelo de dificultad | `difficulty_range(effective_age_band)` es **mínimo absoluto**; L1 no baja de ese suelo |
| T10 | Objetivo por slot | `target = f(banda, level_id, accuracy_rolling, difficulty_modifier)` inyectado en el prompt de cada camino |
| T11 | Instrucciones, no validador curricular | Calibrar con prompt + skills. **Prohibido** un validador post-compose que rechace el pack por contenido (p. ej. detectar `10+5`) y force reintento LLM: alarga la espera y empeora la partida |
| T12 | Validadores laxos (19 ago 2026) | Duro solo lo estructural (3 caminos, 3 retos, MCQ puntuable). Cliché, paleta, wrapper, leak → log suave. El pack LLM se sirve; plantilla solo si el compose no produce pack jugable |

## Calibración pedagógica (19 ago 2026)

La edad marca el **marco curricular**. El nivel por materia y el rolling operan **dentro** de ese marco.

```
floor, ceil = SubjectCatalog.difficulty_range(effective_age_band)
L = índice de level_id (L1=1 … L5=5; default L1)
r = clamp((accuracy_rolling − SEED_ROLLING) / (THRESHOLD_UP − SEED_ROLLING), 0, 1)
position = clamp((L − 1 + r) / 4, 0, 1)
raw = floor + position × (ceil − floor) + difficulty_modifier
target = clamp(round_half_up(raw), floor, ceil)
```

| Capa | Fuente | Efecto |
| --- | --- | --- |
| Suelo / techo | `effective_age_band` | Contenido acorde a la edad; un teen no recibe aritmética de 6–7 años como núcleo |
| Punto de partida | `user_subject_levels.level_id` (placement) | L1 cerca del suelo; L5 cerca del techo |
| Avance intra-nivel | `accuracy_rolling` | Tras placement, semilla 0.10 → inicio del tramo del L* actual |
| Ajuste fino | `difficulty_modifier` | Suma al `raw`; **nunca** por debajo de `floor` |

**Invariante:** ningún reto de camino ni ítem de placement puede quedar **por debajo del suelo de la banda**, aunque el nivel sea L1 o el modificador sea negativo.

**Placement** (sin `level_id` aún): `target` = punto medio del rango de la banda; el enunciado sigue el mismo suelo.

**Contenido:** el servidor inyecta un `curriculum_hint` por `subject_id` + banda (p. ej. `math` + `band_teen` → porcentajes / proporcionalidad / ecuaciones; **prohibido** `10+5` como pregunta principal). Si el modelo se desvía, se mejora el hint/skill; no se añade un filtro que regenere el pack.

## UI tutor (Progreso)

- Checkbox **«Priorizar en caminos»** por materia (`data-subject-priority`).
- Helper: «Orienta el examen y los próximos caminos de práctica.»

## Implementación

- Servicio: `backend/app/services/path_composer_context.py`
- Calibración: `backend/app/services/challenge_difficulty.py`
- Integración caminos: `DialogueService._weak_subjects_for_path_pack`, `_path_compose_prompt`
- Integración placement: `DialogueService._placement_compose_prompt`
- Persistencia: `CrewService._normalize_subject_priorities`
- Ledger debug opcional: evento `path_compose_context`

## Criterios de aceptación

1. Prompt estructurado con nota por camino (test unitario).
2. Materia con nota sube en ranking frente a par sin nota (test).
3. Regeneración de camino fallido reutiliza el mismo contexto de slot.
4. Teen L1 en `math` → `target` ≥ 2 (suelo `band_teen`); nunca 1.
5. Teen L4+ post-placement → prompt de caminos incluye objetivo ≥ 3 y hint que prohíbe suma directa de enteros de 1–2 cifras.
6. Placement `band_teen` inyecta rango 2–4 y el mismo hint de `math`.
7. Título cliché / paleta / wrapper corto **no** rechazan el pack (aviso en log). Reintento duro solo si faltan caminos/retos o el MCQ no se puede puntuar.
