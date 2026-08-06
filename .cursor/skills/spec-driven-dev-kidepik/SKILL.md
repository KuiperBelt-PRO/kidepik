---
name: spec-driven-dev-kidepik
description: >-
  SDD + TDD en el repositorio kidepik (producto Kuiper Belt). Usar cuando el
  cambio sea código de este repo y se pida especificación, tests primero o
  feature con cobertura. Incluye puerta de descubrimiento en .cursor/specify/
  y .cursor/diagrams/ antes de proponer docs nuevas, mantenimiento vivo de
  specs, diagramas e índice CURRENT_SPECS, y uso de logs en web/logs/ para
  depurar. Delega el método en la skill genérica spec-driven-dev del hub
  Vibe-Coding.
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
- Specs formales en [.cursor/specify/](../../specify/) — **índice vivo** en [CURRENT_SPECS.md](../../CURRENT_SPECS.md).
- Diagramas de orientación en [.cursor/diagrams/](../../diagrams/) — **índice** en [diagrams/README.md](../../diagrams/README.md); no sustituyen specs.
- Planes de ejecución en [.cursor/tasks/](../../tasks/) cuando una feature sea multi-fase.
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
| **Logs local (depuración)** | JSONL en `web/logs/` (volumen Docker) | `shared/Logging/AppLogger.php`, `web/js/lib/app-logger.js` |

**Specs POC:** [SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md](../../specify/SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md), [SPEC_POC_DOCKER_LOCAL_DEV.md](../../specify/SPEC_POC_DOCKER_LOCAL_DEV.md), [SPEC_PHP_BACKEND_ARCHITECTURE.md](../../specify/SPEC_PHP_BACKEND_ARCHITECTURE.md), [SPEC_MEDIA_STORAGE.md](../../specify/SPEC_MEDIA_STORAGE.md).  
**Logs en disco:** [SPEC_APP_FILE_LOGGING.md](../../specify/SPEC_APP_FILE_LOGGING.md) — canales `api`, `ai`, `compose`, `client`; más detalle con `APP_DEBUG_AI=true`.  
**URLs:** [.cursor/plan/PROJECT_OVERVIEW.md](../../plan/PROJECT_OVERVIEW.md) — `http://localhost:8082`.  
**Diagramas:** [.cursor/diagrams/README.md](../../diagrams/README.md) — matriz tarea→spec→diagrama en [14-cursor-doc-routing.md](../../diagrams/14-cursor-doc-routing.md).

### UI autenticada (puerta obligatoria)

Si el cambio toca `web/` visible en rutas con sesión (`#/crew`, `#/settings`, `#/account`, `#/play/…`, etc.):

1. Leer [.cursor/DESIGN.md](../../DESIGN.md) § tokens + **«Nuevas superficies autenticadas»** + **§11 Skeleton de carga** (`fillGlassSkeleton` / `mountGlassSkeleton` / `mountTimelineSkeletonItems`; presets `document` | `panel` | `lines` | `timeline`).
2. Leer [SPEC_APP_SECTION_FRAME.md](../../specify/SPEC_APP_SECTION_FRAME.md) (matriz de rutas).
3. **No** inventar chrome: `mountLoaderChrome` + `mountSectionFrame` + controles `glass-*`.
4. **Estados de carga:** skeleton glass hasta datos listos; **no** `<p>Cargando…</p>` ni copy preescrito (p. ej. play: `SPEC_APP_ADVENTURE_LLM_NARRATIVE` §1). Paginación: filas skeleton, no texto bajo el botón.
5. **Guardados PATCH sin navegación:** `runGlassButtonAction` + `showGlassToast` ([SPEC_APP_GLASS_TOAST.md](../../specify/SPEC_APP_GLASS_TOAST.md)); no solo texto inline «Guardado».
6. Validar con skill `web-mobile-preview` (mundo animado visible detrás del marco).

---

## Logs en disco (depuración local)

En POC Docker, la app escribe **JSONL** bajo `web/logs/` (accesible desde Cursor y desde el contenedor en `/var/www/html/logs`). **No versionar** el contenido (`web/logs/*` en `.gitignore`; solo `.gitkeep`).

| Canal / archivo | Qué buscar |
| --- | --- |
| `api-{Y-m-d}.log` | Cada request HTTP (`http_request`: path, status, `duration_ms`) |
| `ai-{Y-m-d}.log` | Intentos LLM (`llm_attempt`: modelo, `ok`, `error_class`, latencia); cooldown (`models_in_cooldown`) |
| `compose-{Y-m-d}.log` | Fallos placement (`placement_compose_failed`, `handoff_compose_failed` + `compose_debug`) |
| `client-{Y-m-d}.log` | Front: `route_change`, `api_call` (status 504/401…), `window_error`, `ui_click` (debug) |

**Contrato:** [SPEC_APP_FILE_LOGGING.md](../../specify/SPEC_APP_FILE_LOGGING.md). Modo debug IA (panel + umbral `debug` en logs): [SPEC_APP_DEBUG_MODE.md](../../specify/SPEC_APP_DEBUG_MODE.md).

### Cuándo consultar logs (obligatorio en depuración)

| Situación | Orden de lectura |
| --- | --- |
| Fallo en play / prueba placement | `client` → `api` → `ai` → `compose` (correlacionar timestamp y `child_id` / `session_id`) |
| Timeout 504 en turno | `client` (`api_call` 504) + `api` (¿llegó el request?) + `ai` (¿sigue el fallback?) |
| Compose / mentor amable sin JSON | `compose` + `ai` (todos `llm_attempt` fallan vs fallo post-LLM) |
| Cambio en gateway, colas, cooldown | `ai` + CLI `api/bin/inspect-ai-queues.php` (colas BD + cooldowns activos) |

### Cómo leer (agente)

1. Reproducir el fallo en navegador (o pedir al usuario que lo haya hecho).
2. **Leer** los `.log` del día en `web/logs/` (herramienta Read o el usuario los adjunta).
3. `Get-Content web\logs\ai-2026-08-01.log -Tail 30` (PowerShell) si hace falta desde shell.
4. No sustituir logs por `docker logs` del contenedor PHP salvo migraciones/arranque; el detalle de producto está en `web/logs/`.
5. En el informe al usuario: citar **message** + campos clave del JSONL (modelo, status, `error_class`), no secretos.

Variables relevantes en `.env.poc`: `LOG_TO_FILES`, `LOG_LEVEL`, `APP_DEBUG_AI`, `LOG_CLIENT_INGEST` (ver `.env.poc.sample`).

---

## Inventario documental — consultar antes de proponer

**Regla:** antes de redactar una spec nueva, un diagrama nuevo o un plan de implementación, **buscar en el inventario existente**. No duplicar contratos ni proponer arquitectura que contradiga specs aprobadas o diagramas vigentes.

### Puerta de descubrimiento (obligatoria)

Ejecutar en este orden (paralelizar lecturas cuando sea posible):

1. **[CURRENT_SPECS.md](../../CURRENT_SPECS.md)** — qué existe, estado (aprobada / implementada / contrato / descartada) y enlaces.
2. **[diagrams/14-cursor-doc-routing.md](../../diagrams/14-cursor-doc-routing.md)** — matriz rápida pedido → spec → diagrama.
3. **Búsqueda en `.cursor/specify/`** — por prefijo o palabra clave del área (`SPEC_LOADER_*`, `SPEC_APP_*`, `SPEC_PHP_*`, …). Ver taxonomía abajo.
4. **Diagrama(s) del área** — según inventario § Diagramas; leer el Mermaid y las specs enlazadas en el propio fichero.
5. **`.cursor/tasks/`** — si hay plan de ejecución abierto para la misma iniciativa.
6. **Código** — `codegraph explore` / lectura dirigida si la spec dice «implementada».
7. **Engram** (`mem_search`) — decisiones previas del proyecto que no estén aún en `.cursor/`.
8. **Logs** (`web/logs/*.log`) — si el encargo es **depurar un fallo reproducido** (play, IA, API, navegación): leer § Logs en disco antes de hipótesis o parches.

Si tras esto **ya cubre** el cambio una spec existente → **ampliar o actualizar** esa spec (y su diagrama), no crear otra paralela.

### Taxonomía de specs (`.cursor/specify/`)

| Familia / prefijo | Ámbito | Ejemplos |
| --- | --- | --- |
| `SPEC_POC_*`, `SPEC_PHP_*`, `SPEC_HOSTING_*`, `SPEC_MEDIA_*` | Stack, API, hosting, media | POC Docker, backend PHP, migrations, storage |
| `SPEC_WEB_*` | Cliente `web/`, preview dev | Frontend architecture, dev preview |
| `SPEC_LOADER_*`, `LOADER_*`, `ELEMENTS_ENGINE_*` | Loader procedural (fantasía, FX, terreno, cielo…) | Gate, screen, fantasy engine, crystals |
| `SPEC_APP_*` | Producto post-login y aventura | Auth, shell, secciones tutor, play, examen, diálogo |
| `SPEC_WORLD_*`, `SPEC_LEGAL_*` | Mundo dual, legal autenticado | Persistencia capas, términos/privacidad |
| `SPEC_CAPACITOR_*` | Fase posterior móvil nativo | Shell Capacitor |
| `REPO_BOOTSTRAP_SPEC` | Estructura `.cursor/` del repo | Bootstrap documentación |

Convención de nombres: `SPEC_<ÁREA>_<TEMA>.md`. Un fichero por iniciativa con contrato propio. Detalle en [specify/README.md](../../specify/README.md).

### Inventario de diagramas (`.cursor/diagrams/`)

Los diagramas **orientan**; el contrato vive en `.cursor/specify/`. Actualizar el diagrama cuando cambie un flujo, ruta, tabla o contrato HTTP que el diagrama represente.

| # | Fichero | Actualizar cuando toques… |
| --- | --- | --- |
| 01 | `01-system-context.md` | Actores, hosting, límites MVP, integraciones externas |
| 02 | `02-repo-layout.md` | Carpetas nuevas, responsabilidades de directorio |
| 03 | `03-runtime-local.md` | Docker, puertos, scripts `poc-*`, env |
| 04 | `04-backend-php.md` | Router, controllers, contratos API |
| 05 | `05-data-auth-model.md` | Tablas, auth JWT, `parent_accounts`, migraciones |
| 06 | `06-frontend-architecture.md` | Módulos JS, capas UI, build del cliente |
| 07 | `07-routing-navigation.md` | Hash routes, shell, navegación |
| 08 | `08-world-layers-themes.md` | Temas fantasía/sci-fi, persistencia de capas |
| 09 | `09-loader-gate-auth.md` | Loader → gate → Google OAuth |
| 10 | `10-parent-surfaces.md` | Cuenta, Ajustes, Tripulación, Legal tutor |
| 11 | `11-child-adventure-pipeline.md` | Play, examen, diálogo (contrato) |
| 12 | `12-media-storage.md` | `web/media/`, drivers, uploads |
| 13 | `13-dev-test-validate.md` | PHPUnit, Playwright, flujos de validación |
| 14 | `14-cursor-doc-routing.md` | Enrutado documental Cursor (specs/skills) de specs o cambio de precedencia documental |
| 15 | `15-ai-orchestrator-agents.md` | Orquestador, mapa de agentes play, decisión de rol por turno |
| 16 | `16-journey-mechanics-flows.md` | Flujos first-run / prueba / caminos / rangos / espera |
| 17 | `17-storage-decision-tree.md` | Criterio PG vs archivos vs DuckDB vs código |
| 18 | `18-parallel-worlds.md` | Mundos fantasy/sci-fi en paralelo y cambio de tema |

Orden de lectura sugerido para onboarding: [diagrams/README.md](../../diagrams/README.md) § Orden de lectura.

### Precedencia documental

1. Spec aprobada en `.cursor/specify/`
2. Código actual si la spec indica «implementada»
3. Diagramas (mapa, no contrato)
4. Engram (decisiones de sesiones anteriores)

---

## Mantenimiento vivo durante el desarrollo

Las specs y los diagramas **no son estáticos**: se crean, amplían y actualizan **en cada fase** del SDD cuando el cambio lo merezca.

| Momento | Spec (`.cursor/specify/`) | Diagrama (`.cursor/diagrams/`) | Índice |
| --- | --- | --- | --- |
| **Antes de proponer** | Buscar existente; no duplicar | Leer el del área (tabla § Inventario) | Consultar [CURRENT_SPECS.md](../../CURRENT_SPECS.md) |
| **Fase 1 — nueva feature** | Crear `SPEC_*.md` o **ampliar** la existente; pedir aprobación | Actualizar Mermaid del diagrama enlazado | Añadir fila en CURRENT_SPECS con estado |
| **Fase 1 — cambio pequeño** | Sección nueva en spec padre o nota en chat | Solo si cambia flujo visible en el diagrama | Actualizar estado si aplica |
| **Fase 2 — plan** | Enlazar spec ↔ tasks en `.cursor/tasks/` si es multi-fase | Verificar que el diagrama refleja el plan | — |
| **Fase 4 — implementación** | Marcar desviaciones o ampliaciones descubiertas **antes** de cerrar | Actualizar si el código divergió del Mermaid | — |
| **Fase 5 — cerrar** | Estado final (implementada / contrato / obsoleta) | Sincronizar diagrama afectado | **Obligatorio** si cambió comportamiento o contrato |

### Cuándo crear spec nueva vs ampliar

| Situación | Acción |
| --- | --- |
| Contrato HTTP, ruta hash, tabla o flujo de producto **nuevo** y ortogonal | Nueva `SPEC_<ÁREA>_<TEMA>.md` + fila en CURRENT_SPECS |
| Sub-feature del mismo dominio (p. ej. otro builder del loader) | Ampliar familia `SPEC_LOADER_*` o spec padre; plan en `tasks/` si hay fases |
| Ajuste que no cambia contrato (refactor interno, copy, CSS sin rutas) | Sin spec nueva; diagrama solo si cambia el mapa de flujo |
| Contradicción con spec «aprobada» | Actualizar spec y pedir re-aprobación; no implementar en silencio |

### Cuándo actualizar diagrama vs crear fichero nuevo

- **Por defecto:** actualizar uno de los `01`–`14` existentes.
- **Nuevo fichero** solo si aparece un **aspecto arquitectónico nuevo** que no encaja en el inventario (caso raro); entonces numerar `15-…`, documentar en [diagrams/README.md](../../diagrams/README.md) y en [14-cursor-doc-routing.md](../../diagrams/14-cursor-doc-routing.md).
- **No** duplicar en diagrama lo que ya es contrato detallado en spec (enlazar, no copiar párrafos largos).

---

## Ajustes kidepik por fase (sobre el flujo del hub)

### Fase 1 — Especificar

1. Ejecutar la **puerta de descubrimiento** (§ Inventario documental).
2. Features que cambien contratos HTTP, auth, storage o flujos móvil: spec en `.cursor/specify/` (o resumen estructurado en chat **solo** si el cambio es trivial y acotado).
3. Identificar y leer el **diagrama del área**; anotar si habrá que actualizarlo al cerrar.
4. Seguir [.cursor/SDD.md](../../SDD.md): no implementar producto funcional sin spec acordada cuando el cambio sea relevante.
5. Presentar spec (nueva o delta sobre existente) y **pausar para aprobación** del usuario antes de implementar (salvo excepciones triviales del hub).

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
5. **Logs:** tras flujos de play, IA o API, revisar `web/logs/` (§ Logs en disco). Si el usuario reporta fallo, **leer logs antes de cerrar** la tarea o proponer otro fix.

### Fase 5 — Cerrar

- **Spec:** estado final en el fichero de `.cursor/specify/` (implementada, contrato, obsoleta…).
- **Índice:** actualizar [CURRENT_SPECS.md](../../CURRENT_SPECS.md) si cambió comportamiento, contrato o estado.
- **Diagrama(s):** sincronizar el/los de la tabla § Inventario de diagramas si el flujo, ruta o modelo cambió.
- **Tasks:** marcar o archivar plan en `.cursor/tasks/` si existía.
- Suite PHPUnit del módulo tocado (+ validación UI según fase 4).
- Resumen al usuario según la skill del hub (incluir qué docs se crearon o actualizaron).

---

## Referencias

| Tema | Dónde |
| --- | --- |
| Método SDD + TDD (canónico) | `Vibe-Coding/.cursor/skills/spec-driven-dev/SKILL.md` |
| Patrones en este repo | [patterns.md](patterns.md) |
| Logs JSONL local (`web/logs/`) | [SPEC_APP_FILE_LOGGING.md](../../specify/SPEC_APP_FILE_LOGGING.md) |
| Docker Compose local | `Vibe-Coding/.cursor/skills/docker-compose-operations/SKILL.md` |
| Git commit / push | `Vibe-Coding/.cursor/skills/git-workflow/SKILL.md` |
