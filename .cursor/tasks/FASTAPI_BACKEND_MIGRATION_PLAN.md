# Plan: Migración backend FastAPI

> Estado: **en curso** — [SPEC_FASTAPI_BACKEND_MIGRATION.md](../specify/SPEC_FASTAPI_BACKEND_MIGRATION.md) aprobada  
> Rama: `fast_api_backend` (epic `agentic_approach`)

## Decisiones cerradas

- Solo POC Docker local (hosting prod aplazado)
- SQLAlchemy 2 async + asyncpg
- Carpeta `backend/`
- Cutover nginx → FastAPI (PHP se conserva, perfil `php-legacy`)
- Sin scaffolding agentic

## Checklist por fase

### Fase 0 — Andamiaje ✅
- [x] Crear `backend/` (FastAPI + pyproject + Dockerfile)
- [x] Servicio Docker `api` + proxy nginx
- [x] `GET /api/v1/health` + pytest
- [x] Actualizar `poc-up.ps1`

### Fase 1 — Auth + tutor ✅ (código)
- [x] SupabaseAuth + parents + settings + crew + legal + client logs + architecture/migrations
- [ ] Smoke Playwright tutor completo (pendiente validación UI)

### Fase 2 — Storage ✅
- [x] prepare-upload + upload → `web/media/`

### Fase 3 — Play / IA ⚠️ PHP activo (strangler)
- [ ] Port FastAPI aplazado a petición
- [x] nginx enruta `/api/v1/play/*` y `/api/v1/debug/ai/*` → PHP
- [x] Resto de `/api/` → FastAPI

### Fase 4 — Cutover HTTP ⚠️ híbrido local
- [x] FastAPI para API producto (health, parents, crew, settings, storage, legal…)
- [x] PHP para Play/IA
- [x] Docs/diagramas/overview actualizados
- [ ] Retiro ficheros PHP — **no** (acordado conservar)

### Fase 5 — Agentic
- [ ] Fuera de alcance (instrucciones posteriores)
