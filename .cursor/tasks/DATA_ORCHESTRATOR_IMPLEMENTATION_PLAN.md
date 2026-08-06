# Plan: Capas de datos + orquestador + mecánicas (ago 2026)

> Specs **aprobadas** (ago 2026).  
> Specs: DATA_STORAGE_LAYERS, JOURNEY_MECHANICS, CENTRAL_ORCHESTRATOR, WORLD_GLOSSARY, WAITING_PHRASES, PARALLEL_WORLDS, CANONICAL_VOCABULARY.

## Cortes

| # | Entrega | Estado |
| --- | --- | --- |
| 0 | Renombrar diagrama 14 → `14-cursor-doc-routing` | **hecho** |
| 1 | Agent `.md` loader + Orchestrator + wire `_agent_mentor_turn` | **hecho** |
| 2 | DuckDB glossary + seeds fantasy/sci-fi | **hecho** |
| 3 | `waiting_phrases` migración + `pick_waiting_batch` + hints en placement/path | **hecho** |
| 4 | Ledger `worlds/{theme}/` + `placement_*` / `path_*` en events | **hecho** |
| 5 | Dejar de escribir `child_traits`; solo `traveler.md` | **hecho** |
| 6 | Sin PlacementBank (compose LLM + `ProgressionRanks`) | **hecho** |
| 7 | Tests unitarios backend (+ ledger world/placement) | **hecho** (22 passed) |
| 8 | Placement 100% JSONL (sin `placement_exams` como fuente) | **hecho** |
| 9 | `path_composer` + flujo 3 caminos en `dialogue.py` | **hecho** |
| 10 | UI rotación `waiting_hints` cada 8s | **hecho** |
| 11 | Migración `child_world_progress` + PK `user_subject_levels` por mundo | **hecho** (aplicada en POC local) |
| 12 | Crew progress sin PlacementBank; `placement_completed_at` desde children/cwp | **hecho** |

## Notas de cierre sprint

- Fuente de verdad examen/caminos: ledger JSONL por mundo.
- Supabase: flags/niveles oficiales/`waiting_phrases`/`child_world_progress`.
- PHP: `shared/Catalogs/ProgressionRanks.php`; eliminados `PlacementBank.php` + `placement_bank/`.
- UI: `meta.waiting_hints` con intervalo 8000 ms.

## Siguiente (opcional)

- ~~Smoke E2E play completo (placement → choose_path → path_challenge) con Gemini real.~~ **hecho** (`app.scripts.smoke_placement_paths`)
- ~~Deprecar lectura residual de `placement_exams` en scripts/reset legacy.~~ **hecho** (reset limpia `child_world_progress`; exams solo como residuo)
- ~~Actualizar specs antiguas (`SPEC_APP_PLACEMENT_EXAM`) marcando tablas deprecadas.~~ **hecho**
