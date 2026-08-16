# Spec: Contexto tutor en generación de caminos (path_composer)

> Estado: **aprobada — implementada** (15 ago 2026)  
> Relacionado: [SPEC_APP_JOURNEY_MECHANICS.md](SPEC_APP_JOURNEY_MECHANICS.md) §5, [SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md), [SPEC_APP_CREW_MEMBER_DETAIL.md](SPEC_APP_CREW_MEMBER_DETAIL.md), [SPEC_APP_PRODUCT_BACKLOG_AGO2026.md](SPEC_APP_PRODUCT_BACKLOG_AGO2026.md) B11, [SPEC_AI_PYDANTIC_AGENTS.md](SPEC_AI_PYDANTIC_AGENTS.md)  
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

## UI tutor (Progreso)

- Checkbox **«Priorizar en caminos»** por materia (`data-subject-priority`).
- Helper: «Orienta el examen y los próximos caminos de práctica.»

## Implementación

- Servicio: `backend/app/services/path_composer_context.py`
- Integración caminos: `DialogueService._weak_subjects_for_path_pack`, `_path_compose_prompt`
- Integración placement: `DialogueService._placement_compose_prompt`
- Persistencia: `CrewService._normalize_subject_priorities`
- Ledger debug opcional: evento `path_compose_context`

## Criterios de aceptación

1. Prompt estructurado con nota por camino (test unitario).
2. Materia con nota sube en ranking frente a par sin nota (test).
3. Regeneración de camino fallido reutiliza el mismo contexto de slot.
