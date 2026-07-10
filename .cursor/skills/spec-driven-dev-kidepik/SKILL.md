---
name: spec-driven-dev-kidepik
description: >-
  SDD + TDD en el repositorio kidepik (producto Kuiper Belt). Usar cuando el
  cambio sea código de este repo y se pida especificación, tests primero o
  feature con cobertura. Delega el método en la skill genérica spec-driven-dev
  del hub Vibe-Coding; esta skill solo acota ámbito y convenciones de kidepik.
---

# SDD + TDD para kidepik

## Autoridad metodológica (leer primero)

El **método completo** — cuándo usar o no, conceptos SDD/TDD, fases 1–5, ciclo Red-Green-Refactor, reglas críticas, TDD sin spec formal, escalado de specs y validación en navegador — está en:

**`Vibe-Coding/.cursor/skills/spec-driven-dev/SKILL.md`**

Activa **esta** skill cuando el trabajo sea en **kidepik**; a continuación **lee y aplica** la skill del hub. No improvises un flujo paralelo ni dupliques sus pasos aquí.

Esta skill **no sustituye** a `spec-driven-dev` ni a las skills SDD de otros repos (`spec-driven-dev-pda`, `spec-driven-dev-kuiper`, `spec-driven-dev-kuiper-auto`, `spec-driven-dev-misc`).

---

## Ámbito del repositorio

- Código bajo **kidepik**: `api/` + `shared/` (PHP), `web/` (cliente HTML/CSS/JS), `supabase/`, `docker/`, scripts `scripts/poc-*.ps1`. `backend/` (FastAPI) = **legacy**, no extender.
- Specs formales en [.cursor/specify/](../../specify/) y enlazadas desde [CURRENT_SPECS.md](../../CURRENT_SPECS.md).
- Fases del repo documentadas en [.cursor/SDD.md](../../SDD.md) (Specify → Plan → Task → Implement → Validate).
- Respeta versiones en `api/composer.json`, `web/package.json` y manifiestos del stack POC.

---

## Cuándo usar (además de los criterios del hub)

- Implementar o extender el **POC** (PHP + Docker nginx/php-fpm + Supabase + MinIO + cliente `web/`).
- Añadir rutas API, auth JWT Supabase, storage S3-compatible, migraciones SQL o pantallas móvil con contrato en spec.
- El usuario pide SDD/TDD y el cambio vive claramente en este repo.

## Cuándo NO usar

- Los casos del hub (`spec-driven-dev` § Cuándo NO usar) aplican igual.
- Infra OCI / hosting sin lógica testeable → skill [oci-mcp-ops](../oci-mcp-ops/SKILL.md) u operaciones, no SDD de producto.
- Code review sin implementación → `Vibe-Coding/.cursor/skills/code-review/SKILL.md`.

---

## Contexto de stack (lectura rápida)

| Capa | Tecnología | Código típico |
| --- | --- | --- |
| API | **PHP 8.2+**, Composer, PHPUnit | `api/src/`, `api/tests/`, `shared/` |
| Datos / auth | Supabase (Postgres, Auth) | `supabase/migrations/`, `supabase/config.toml` |
| Object storage (POC) | Filesystem `web/media/` | `shared/Storage/LocalFilesystemDriver.php` — ver [SPEC_MEDIA_STORAGE.md](../../specify/SPEC_MEDIA_STORAGE.md) |
| Cliente producto | **HTML + CSS + JS** (ES modules); Capacitor fase posterior | `web/` |
| Preview dev móvil | Electron + Playwright viewport 390×844 | `tools/preview-electron/`, `poc-up.ps1`, `poc-web-preview.ps1` |
| Orquestación local | Docker Compose (nginx+php) + Supabase CLI (contenedores) | `docker/compose.yaml`, `scripts/poc-up.ps1` |
| Hosting prod | DreamHost PHP | ver SPEC_HOSTING_FREE_TIER_STACK |

**Specs POC (jul 2026):** [SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md](../../specify/SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md), [SPEC_POC_DOCKER_LOCAL_DEV.md](../../specify/SPEC_POC_DOCKER_LOCAL_DEV.md), [SPEC_PHP_BACKEND_ARCHITECTURE.md](../../specify/SPEC_PHP_BACKEND_ARCHITECTURE.md), [SPEC_MEDIA_STORAGE.md](../../specify/SPEC_MEDIA_STORAGE.md).  
**URLs y arranque local:** [.cursor/plan/PROJECT_OVERVIEW.md](../../plan/PROJECT_OVERVIEW.md) — app única en `http://localhost:8082`.

---

## Ajustes kidepik por fase (sobre el flujo del hub)

Tras leer cada fase en `spec-driven-dev`, aplica estos matices:

### Fase 1 — Especificar

- Features que cambien contratos HTTP, auth, storage o flujos móvil: spec en `.cursor/specify/` (o resumen estructurado en chat si el cambio es pequeño).
- Seguir [.cursor/SDD.md](../../SDD.md): no implementar producto funcional sin spec acordada cuando el cambio sea relevante.

### Fase 2 — Planificar

| Superficie | Tests / código |
| --- | --- |
| API | `api/tests/*Test.php` junto a `api/src/` |
| SQL | Nueva migración en `supabase/migrations/` con nombre timestamp |
| Web / UI | `web/` — Playwright viewport 390×844 o checklist en spec |
| Compose / env | Cambios en `docker/compose.yaml`, `.env.poc.sample` — documentar impacto si afecta al arranque |

Estructura backend: `api/public/index.php` + `api/src/` + `shared/` (ver [SPEC_PHP_BACKEND_ARCHITECTURE.md](../../specify/SPEC_PHP_BACKEND_ARCHITECTURE.md)).

### Fase 3 — Test First

**Backend (PHPUnit):** con stack Docker levantado (`./scripts/poc-up.ps1`):

```powershell
docker compose --env-file .env.poc -f docker/compose.yaml exec php vendor/bin/phpunit
```

- Tests de integración HTTP contra `http://localhost:8082/api/v1/*` con stack levantado; mocks en unitarios.
- Para integración con Postgres/MinIO: `./scripts/poc-up.ps1` obligatorio.

**Supabase:** validar migraciones con `supabase db reset` / stack local antes de dar por cerrada la fase.

**Web:** `./scripts/poc-up.ps1` + MCP browser según [web-mobile-preview](../web-mobile-preview/SKILL.md) — **no** `poc-web-dev.ps1`.

### Fase 4 — Validar cobertura y superficie observable

1. Cruzar requisitos de spec ↔ tests (tabla del hub y [patterns.md](patterns.md#checklist-de-cruce-spec-tests)).
2. **API:** `GET http://localhost:8082/api/v1/health` y rutas de la spec con stack Docker levantado.
3. **UI / demos:** reglas en [cursor-browser-mcp-testing.mdc](../../rules/cursor-browser-mcp-testing.mdc). **Cliente web** (`poc-up.ps1` → `http://localhost:8082`) vía skill [web-mobile-preview](../web-mobile-preview/SKILL.md). Capturas solo bajo `tmp/playwright-output/`.
4. **Preview móvil PC:** `./scripts/poc-web-preview.ps1` (Electron 390×844) cuando haga falta validar viewport.

### Fase 5 — Cerrar

- Actualizar [CURRENT_SPECS.md](../../CURRENT_SPECS.md) si cambia comportamiento o contratos.
- Suite `PHPUnit` del módulo tocado (en contenedor PHP).
- Resumen al usuario según la skill del hub (implementación, tests, cobertura de spec, validación navegador/móvil).

---

## Referencias

| Tema | Dónde |
| --- | --- |
| Método SDD + TDD (canónico) | `Vibe-Coding/.cursor/skills/spec-driven-dev/SKILL.md` |
| Patrones pytest / estructura en este repo | [patterns.md](patterns.md) |
| Buenas prácticas Python (hub) | `Vibe-Coding/.cursor/skills/python-engineering/SKILL.md` |
| Docker Compose local | `Vibe-Coding/.cursor/skills/docker-compose-operations/SKILL.md` |
| OCI / Always Free | [oci-mcp-ops/SKILL.md](../oci-mcp-ops/SKILL.md) |
| Git commit / push | `Vibe-Coding/.cursor/skills/git-workflow/SKILL.md` |
