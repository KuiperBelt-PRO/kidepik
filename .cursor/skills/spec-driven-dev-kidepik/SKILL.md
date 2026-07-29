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

- Código bajo **kidepik**: `api/` + `shared/` (PHP), `web/` (cliente HTML/CSS/JS), `supabase/`, `docker/`, scripts `scripts/poc-*.ps1`.
- Specs formales en [.cursor/specify/](../../specify/) y enlazadas desde [CURRENT_SPECS.md](../../CURRENT_SPECS.md).
- Fases del repo documentadas en [.cursor/SDD.md](../../SDD.md) (Specify → Plan → Task → Implement → Validate).
- Respeta versiones en `api/composer.json`, `web/package.json` y manifiestos del stack POC.
- **Stack canónico:** DreamHost PHP + Supabase + `web/media/`. Sin FastAPI, R2, MinIO, OCI ni Cloud Run.

---

## Cuándo usar (además de los criterios del hub)

- Implementar o extender el **POC** (PHP + Docker nginx/php-fpm + Supabase + media `web/media/` + cliente `web/`).
- Añadir rutas API, auth JWT Supabase, storage filesystem local, migraciones SQL o pantallas móvil con contrato en spec.
- El usuario pide SDD/TDD y el cambio vive claramente en este repo.

## Cuándo NO usar

- Los casos del hub (`spec-driven-dev` § Cuándo NO usar) aplican igual.
- Code review sin implementación → `Vibe-Coding/.cursor/skills/code-review/SKILL.md`.

---

## Contexto de stack (lectura rápida)

| Capa | Tecnología | Código típico |
| --- | --- | --- |
| API | **PHP 8.2+**, Composer, PHPUnit | `api/src/`, `api/tests/`, `shared/` |
| Datos / auth | Supabase (Postgres, Auth) | `supabase/migrations/`, `supabase/config.toml` |
| Media | Filesystem `web/media/` | `shared/Storage/LocalFilesystemDriver.php` |
| Cliente producto | **HTML + CSS + JS** (ES modules); Capacitor fase posterior | `web/` |
| Preview dev móvil | Electron + Playwright viewport 390×844 | `tools/preview-electron/`, `poc-up.ps1`, `poc-web-preview.ps1` |
| Orquestación local | Docker Compose (nginx+php) + Supabase CLI | `docker/compose.yaml`, `scripts/poc-up.ps1` |
| Hosting prod | DreamHost PHP | SPEC_HOSTING_FREE_TIER_STACK |

**Specs POC:** [SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md](../../specify/SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md), [SPEC_POC_DOCKER_LOCAL_DEV.md](../../specify/SPEC_POC_DOCKER_LOCAL_DEV.md), [SPEC_PHP_BACKEND_ARCHITECTURE.md](../../specify/SPEC_PHP_BACKEND_ARCHITECTURE.md), [SPEC_MEDIA_STORAGE.md](../../specify/SPEC_MEDIA_STORAGE.md).  
**URLs:** [.cursor/plan/PROJECT_OVERVIEW.md](../../plan/PROJECT_OVERVIEW.md) — `http://localhost:8082`.  
**Diagramas:** [.cursor/diagrams/README.md](../../diagrams/README.md).

---

## Ajustes kidepik por fase (sobre el flujo del hub)

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

### Fase 3 — Test First

**Backend (PHPUnit):** con stack Docker levantado (`./scripts/poc-up.ps1`):

```powershell
docker compose --env-file .env.poc -f docker/compose.yaml exec php vendor/bin/phpunit
```

**Web:** `./scripts/poc-up.ps1` + MCP browser según [web-mobile-preview](../web-mobile-preview/SKILL.md).

### Fase 4 — Validar cobertura y superficie observable

1. Cruzar requisitos de spec ↔ tests.
2. **API:** `GET http://localhost:8082/api/v1/health` y rutas de la spec.
3. **UI:** [cursor-browser-mcp-testing.mdc](../../rules/cursor-browser-mcp-testing.mdc) + [web-mobile-preview](../web-mobile-preview/SKILL.md). Capturas bajo `tmp/playwright-output/`.
4. **Preview móvil:** `./scripts/poc-web-preview.ps1` cuando haga falta.

### Fase 5 — Cerrar

- Actualizar [CURRENT_SPECS.md](../../CURRENT_SPECS.md) si cambia comportamiento o contratos.
- Suite PHPUnit del módulo tocado.
- Resumen al usuario según la skill del hub.

---

## Referencias

| Tema | Dónde |
| --- | --- |
| Método SDD + TDD (canónico) | `Vibe-Coding/.cursor/skills/spec-driven-dev/SKILL.md` |
| Patrones en este repo | [patterns.md](patterns.md) |
| Docker Compose local | `Vibe-Coding/.cursor/skills/docker-compose-operations/SKILL.md` |
| Git commit / push | `Vibe-Coding/.cursor/skills/git-workflow/SKILL.md` |
