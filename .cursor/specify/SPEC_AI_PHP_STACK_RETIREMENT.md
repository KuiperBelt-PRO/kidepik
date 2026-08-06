# Spec: Retiro del stack IA PHP (OpenRouter / compose)

> Estado: **aprobada** (ago 2026) — cutover play → FastAPI Gemini  
> **Delta propuesta:** sin PlacementBank; vocabulario solo AgeBand+SubjectCatalog ([SPEC_APP_CANONICAL_VOCABULARY](SPEC_APP_CANONICAL_VOCABULARY.md), [SPEC_DATA_STORAGE_LAYERS](SPEC_DATA_STORAGE_LAYERS.md))  
> Relacionado: [SPEC_AI_GEMINI_GATEWAY.md](SPEC_AI_GEMINI_GATEWAY.md), [SPEC_AI_PYDANTIC_AGENTS.md](SPEC_AI_PYDANTIC_AGENTS.md), [SPEC_AI_JOURNEY_FILE_LEDGER.md](SPEC_AI_JOURNEY_FILE_LEDGER.md), [SPEC_AI_OPENROUTER_GATEWAY.md](SPEC_AI_OPENROUTER_GATEWAY.md) (legado), [SPEC_FASTAPI_BACKEND_MIGRATION.md](SPEC_FASTAPI_BACKEND_MIGRATION.md)

## Contexto

Tras el cutover nginx (`/api/v1/play/*` y `/api/v1/debug/ai/*` → FastAPI), el código PHP de gateway OpenRouter, compose de aventura/placement y controladores play/debug-ai es **código muerto respecto al HTTP**.

## Objetivo

1. Eliminar del árbol `api/` + `shared/Ai/` todo runtime LLM OpenRouter y orquestación play por IA.
2. **No** conservar PlacementBank / ZonePitchPlanner / MentorCatalog / ZoneCatalog como dependencia de producto nuevo.
3. Conservar solo vocabulario **AgeBand + SubjectCatalog** en Python ([SPEC_APP_CANONICAL_VOCABULARY](SPEC_APP_CANONICAL_VOCABULARY.md)).
4. Documentar que **SPEC_AI_OPENROUTER_GATEWAY** queda **legado / no canónico**.

## Decisiones

| # | Decisión | Valor |
| --- | --- | --- |
| R1 | Camino canónico play/IA | Solo FastAPI + Gemini + Pydantic AI + orquestador |
| R2 | PHP play/debug-ai | Borrar controllers/services; rutas del Router → 410 o eliminar |
| R3 | `shared/Ai/` gateway/compose/prompts | Borrar |
| R4 | PlacementBank + `placement_bank/` | **Eliminar** (sin banco de ítems) |
| R5 | ZoneCatalog / MentorCatalog / ZonePitchPlanner | Deprecar; no nuevos usos |
| R6 | AgeBand / SubjectCatalog | Vivir en `backend/app/catalogs/`; borrar copies PHP al migrar crew |
| R7 | Tablas SQL OpenRouter | No borrar migraciones históricas; runtime Gemini las ignora |
| R8 | Tests PHP AI-only | Eliminar o marcar skip |
| R9 | `child_traits` / placement_* tablas | Dejar de escribir; semántica en ledger ([SPEC_DATA_STORAGE_LAYERS](SPEC_DATA_STORAGE_LAYERS.md)) |

## Fuera de alcance

- Borrar el servicio Docker `php` entero (sigue crew/settings/legal legacy si aplica).
- Drop físico inmediato de todas las tablas legacy (puede ser migración posterior).
