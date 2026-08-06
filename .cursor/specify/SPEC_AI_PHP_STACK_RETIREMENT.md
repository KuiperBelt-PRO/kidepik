# Spec: Retiro del stack IA PHP (OpenRouter / compose)

> Estado: **aprobada** (ago 2026) — cutover play → FastAPI Gemini  
> Relacionado: [SPEC_AI_GEMINI_GATEWAY.md](SPEC_AI_GEMINI_GATEWAY.md), [SPEC_AI_PYDANTIC_AGENTS.md](SPEC_AI_PYDANTIC_AGENTS.md), [SPEC_AI_JOURNEY_FILE_LEDGER.md](SPEC_AI_JOURNEY_FILE_LEDGER.md), [SPEC_AI_OPENROUTER_GATEWAY.md](SPEC_AI_OPENROUTER_GATEWAY.md) (legado), [SPEC_FASTAPI_BACKEND_MIGRATION.md](SPEC_FASTAPI_BACKEND_MIGRATION.md)

## Contexto

Tras el cutover nginx (`/api/v1/play/*` y `/api/v1/debug/ai/*` → FastAPI), el código PHP de gateway OpenRouter, compose de aventura/placement y controladores play/debug-ai es **código muerto respecto al HTTP**.

## Objetivo

1. Eliminar del árbol `api/` + `shared/Ai/` todo runtime LLM OpenRouter y orquestación play por IA.
2. Conservar catálogos/scoring no-LLM usados por crew/settings (`AgeBand`, `SubjectCatalog`, `ZoneCatalog`, `MentorCatalog`, `PlacementBank`, `ZonePitchPlanner`).
3. Documentar que **SPEC_AI_OPENROUTER_GATEWAY** queda **legado / no canónico** para producto.

## Decisiones

| # | Decisión | Valor |
| --- | --- | --- |
| R1 | Camino canónico play/IA | Solo FastAPI + Gemini + Pydantic AI |
| R2 | PHP play/debug-ai | Borrar controllers/services; rutas del Router → 410 o eliminar |
| R3 | `shared/Ai/` gateway/compose/prompts | Borrar |
| R4 | Catálogos en `shared/Ai/` | Mantener hasta mover a `shared/Catalogs/` (fuera de este corte) |
| R5 | Tablas SQL OpenRouter | No borrar migraciones históricas; runtime Gemini las ignora |
| R6 | Tests PHP AI-only | Eliminar o marcar skip; no mantener suite OpenRouter |

## Fuera de alcance

- Borrar el servicio Docker `php` entero (sigue crew/settings/legal legacy si aplica).
- Reescribir crew progress a Python en este corte.
