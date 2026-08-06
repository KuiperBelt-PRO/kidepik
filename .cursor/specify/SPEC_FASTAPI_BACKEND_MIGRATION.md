# Spec: Migración del backend PHP → FastAPI (Supabase + agentes)

> Estado: **aprobada e implementada parcialmente** (ago 2026) — POC Docker local operativo; Play/IA aún sin paridad 1:1 con PHP  
> Rama: `epic/agentic_approach` → feature `fast_api_backend`  
> Relacionado: [SPEC_PHP_BACKEND_ARCHITECTURE.md](SPEC_PHP_BACKEND_ARCHITECTURE.md) (legado, se conserva en repo), [SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md](SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md) (legado), [SPEC_POC_LOCAL_ARCHITECTURE.md](SPEC_POC_LOCAL_ARCHITECTURE.md) (aviso histórico), [SPEC_POC_DOCKER_LOCAL_DEV.md](SPEC_POC_DOCKER_LOCAL_DEV.md), [SPEC_MEDIA_STORAGE.md](SPEC_MEDIA_STORAGE.md), [SPEC_AI_OPENROUTER_GATEWAY.md](SPEC_AI_OPENROUTER_GATEWAY.md), [SPEC_APP_FILE_LOGGING.md](SPEC_APP_FILE_LOGGING.md), [diagrams/04-backend-php.md](../diagrams/04-backend-php.md)

### Decisiones de aprobación (ago 2026)

| # | Pregunta | Decisión |
| --- | --- | --- |
| 1 | Hosting prod | **Aplazado.** Solo POC local Docker (`:8082`). |
| 2 | ORM | **SQLAlchemy 2.0 async** + asyncpg (queries `text()` al portar; modelos opcionales después). |
| 3 | Carpeta | **`backend/`** |
| 4 | Cutover | **Big-bang local:** nginx proxya **todo** `/api/` a FastAPI. PHP permanece en el repo (no se borra); el servicio `php` puede quedar en compose desactivado del camino HTTP. |
| 5 | Retiro PHP | **No borrar** `api/` ni `shared/` de momento. |
| — | Agentic | **Fuera de alcance de esta migración** (ago 2026). Hilo aparte (propuesta): [SPEC_AI_GEMINI_GATEWAY](SPEC_AI_GEMINI_GATEWAY.md), [SPEC_AI_PYDANTIC_AGENTS](SPEC_AI_PYDANTIC_AGENTS.md), [SPEC_AI_AGENT_SKILLS](SPEC_AI_AGENT_SKILLS.md), [SPEC_AI_JOURNEY_FILE_LEDGER](SPEC_AI_JOURNEY_FILE_LEDGER.md). |

## 0. Decisión de pivot (reabre FastAPI)

Hasta julio 2026 el stack canónico era **PHP (`api/` + `shared/`) + DreamHost + Supabase + `web/`**. FastAPI quedó **descartado** ([SPEC_POC_LOCAL_ARCHITECTURE](SPEC_POC_LOCAL_ARCHITECTURE.md)).

Esta spec **reabre de forma deliberada** el backend FastAPI en la epic `agentic_approach`, con alcance acotado:

| Capa | Antes | Después (objetivo) |
| --- | --- | --- |
| Cliente producto | `web/` HTML/CSS/JS | **Sin cambio** |
| Generador procedural (formas, iconos, FX, loader) | `web/js/` | **Sin cambio** |
| API REST `/api/v1/*` | PHP 8.2 + php-fpm | **FastAPI (Python 3.11+) async** |
| Auth | Supabase Auth (JWT Bearer) | **Igual** (validación desde FastAPI) |
| DB | Supabase Postgres (`DATABASE_URL`) | **Igual** (driver async Python) |
| Media | `web/media/` + nginx | **Igual** (escritura desde FastAPI; lectura nginx) |
| IA / OpenRouter / compose | `shared/Ai/` + services PHP | **Port a Python** (misma semántica) |
| Agentes / MCP / skills (futuro cercano) | No cabía bien en PHP | **Python nativo** (motivación principal) |

**Fuera de alcance de esta migración:**

- Reescribir el front a React/Svelte/Vue.
- Mover el motor procedural del loader a Python.
- Cambiar Supabase Auth o el esquema de tablas de producto (salvo migraciones SQL normales).
- Reintroducir R2, MinIO o Supabase Storage como storage primario (sigue [SPEC_MEDIA_STORAGE](SPEC_MEDIA_STORAGE.md)).

### Motivación

1. **Agentes, MCP y skills** se integran de forma natural en el ecosistema Python.
2. **FastAPI async** facilita I/O concurrente (OpenRouter, compose en lotes, timeouts largos de play) sin bloquear el event loop.
3. Un único runtime de servidor para API + orquestación agentic reduce frontera PHP↔Python.

---

## 1. Objetivo

Entregar un backend **FastAPI** que:

1. Exponga **el mismo contrato HTTP** `/api/v1/*` que consume hoy `web/` (paridad de rutas, status codes y formas JSON).
2. Se conecte a **Supabase Postgres** y valide JWT vía **Supabase Auth**.
3. Escriba media en **`web/media/`** y siga sirviendo estáticos + media por nginx en `:8082`.
4. Deje el camino listo para un paquete de **agentes/MCP/skills** sin mezclarlo con el cliente.
5. Permita **retirar** `api/` PHP y la lógica de negocio de `shared/` PHP cuando la paridad esté verificada.

---

## 2. Frontera de responsabilidad (contrato de alcance)

```
┌─────────────────────────────────────────────────────────────┐
│  web/  (HTML + CSS + JS)                                    │
│  · UI tutor / play / legal / shell                          │
│  · Loader procedural, FX, iconos, animaciones               │
│  · Cliente Supabase Auth (OAuth PKCE)                       │
│  · fetch → /api/v1/*                                        │
└───────────────────────────┬─────────────────────────────────┘
                            │ mismo origen :8082
┌───────────────────────────▼─────────────────────────────────┐
│  nginx                                                      │
│  · /          → estáticos web/                              │
│  · /media/*   → ficheros web/media/                         │
│  · /api/v1/*  → proxy → FastAPI (uvicorn)                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  backend/  (FastAPI)                                        │
│  · Auth Bearer → Supabase Auth                              │
│  · CRUD parents / crew / settings / legal                   │
│  · Storage prepare-upload + upload                          │
│  · Play / placement / adventure / journey                   │
│  · Gateway OpenRouter + colas + logs JSONL                  │
│  · (futuro) agents / mcp / skills                           │
└───────┬─────────────────────────────┬───────────────────────┘
        │ DATABASE_URL                │ OPENROUTER_*
        ▼                             ▼
   Supabase Postgres            OpenRouter (solo free)
```

**Nota sobre “PHP en el front”:** el cliente no ejecuta PHP. Hoy nginx sirve `web/` y solo el API pasaba por php-fpm. Tras la migración, **PHP desaparece del camino de producto**; si queda algún script PHP residual, no forma parte del contrato.

---

## 3. Principio de paridad de contrato (no romper `web/`)

### 3.1 Invariantes

| Invariante | Valor |
| --- | --- |
| Prefijo | `/api/v1` |
| Content-Type | `application/json; charset=utf-8` (salvo upload multipart) |
| Error JSON | `{"detail": "<mensaje>"}` (igual que `JsonResponse::error` PHP) |
| Auth | Header `Authorization: Bearer <access_token>` |
| Origen local | `http://localhost:8082` (sin CORS obligatorio en mismo origen) |
| Media pública | URLs `/media/...` en columnas Postgres; blobs nunca en DB |

### 3.2 Inventario de rutas a portar (fuente: `api/src/Router.php`)

#### Núcleo / infra

| Método | Ruta | Módulo PHP actual |
| --- | --- | --- |
| GET | `/api/v1/health` | HealthController |
| GET | `/api/v1/architecture/config` | ArchitectureController |
| GET | `/api/v1/architecture/status` | ArchitectureController |
| GET | `/api/v1/migrations/status` | MigrationsController |
| POST | `/api/v1/storage/prepare-upload` | StorageController |
| POST | `/api/v1/storage/upload` | StorageController |
| GET | `/api/v1/legal/{slug}` | LegalController |
| POST | `/api/v1/client/logs` | ClientLogController |

#### Cuenta tutor

| Método | Ruta | Módulo PHP actual |
| --- | --- | --- |
| POST | `/api/v1/parents/bootstrap` | ParentsController |
| GET/PATCH/DELETE | `/api/v1/parents/me` | ParentsController |
| GET/PATCH | `/api/v1/parents/me/settings` | ParentSettingsController |
| GET/POST | `/api/v1/crew` | CrewController |
| GET/PATCH/DELETE | `/api/v1/crew/{id}` | CrewController |
| PATCH | `/api/v1/crew/{id}/permissions` | CrewController |

#### Play / journey

| Método | Ruta | Módulo PHP actual |
| --- | --- | --- |
| POST | `/api/v1/play/{childId}/dialogue/session` | PlayDialogueController |
| POST | `/api/v1/play/{childId}/dialogue/turn` | PlayDialogueController |
| GET | `/api/v1/play/{childId}/dialogue/history` | PlayDialogueController |
| GET | `/api/v1/play/{childId}/journey/summary` | PlayDialogueController |
| GET | `/api/v1/play/{childId}/journey/timeline` | PlayDialogueController |

#### Debug IA (solo local / tutor)

| Método | Ruta | Módulo PHP actual |
| --- | --- | --- |
| GET | `/api/v1/debug/ai/status` | DebugAiController |
| GET | `/api/v1/debug/ai/queues` | DebugAiController |
| GET | `/api/v1/debug/ai/resolve` | DebugAiController |
| GET | `/api/v1/debug/ai/attempts` | DebugAiController |
| POST | `/api/v1/debug/ai/ping` | DebugAiController |

**Regla:** cada ruta migrada debe tener **al menos un test de contrato** (status + claves JSON mínimas) antes de cortar el tráfico PHP.

Las specs de producto existentes (`SPEC_APP_*`, `SPEC_AI_*`) siguen siendo la fuente de **semántica**; esta spec solo cambia el **runtime** que las implementa.

---

## 4. Estructura de repositorio objetivo

```
kidepik/
  web/                      # SIN CAMBIO de stack (HTML/CSS/JS + media/)
  backend/                  # NUEVO — FastAPI
    app/
      main.py               # create_app(), lifespan
      config.py             # settings desde env
      deps.py               # DI: db, auth, storage
      http/
        errors.py           # → {"detail": ...}
        middleware.py       # request logging
      routers/
        health.py
        architecture.py
        migrations.py
        storage.py
        legal.py
        parents.py
        crew.py
        play.py
        client_logs.py
        debug_ai.py
      services/             # lógica de negocio (puertos de api/src/Services)
      ai/                   # puerto de shared/Ai/*
      storage/              # LocalFilesystemDriver equivalent
      db/                   # pool async, queries
      logging_/             # AppLogger JSONL → web/logs/
    tests/                  # pytest
    pyproject.toml          # Python ≥3.11
    Dockerfile
  supabase/                 # migraciones SQL — SIN CAMBIO de autoridad
  docker/
    compose.yaml            # nginx + fastapi (+ supabase CLI externo)
    nginx/default.conf      # proxy_pass → fastapi:8000
  api/                      # LEGADO PHP — retirar al cerrar fases
  shared/                   # LEGADO PHP — retirar al cerrar fases
  scripts/
    poc-up.ps1              # actualizar para levantar fastapi
```

### 4.1 Agentic / MCP / skills

**Fuera de alcance** de esta migración. No crear carpetas ni specs agentic aquí.

---

## 5. Stack técnico FastAPI

| Componente | Elección | Notas |
| --- | --- | --- |
| Runtime | Python **3.11+** | Alineado con repos Kuiper |
| Framework | **FastAPI** + **Uvicorn** | ASGI async |
| Settings | `pydantic-settings` | Lee `.env.poc` / env Docker |
| HTTP client | `httpx.AsyncClient` | Supabase Auth + OpenRouter |
| DB | `asyncpg` **o** SQLAlchemy 2.0 async | Preferencia: SQLAlchemy async + asyncpg si hay modelos; asyncpg puro si se quiere mínimo |
| Validación | Pydantic v2 | Request/response models |
| Tests | **pytest** + `httpx.ASGITransport` / `pytest-asyncio` | Sustituye PHPUnit para API |
| Packaging | `pyproject.toml` (+ uv preferente) | Sin Poetry obligatorio |
| Logs | JSONL en `web/logs/` | Paridad [SPEC_APP_FILE_LOGGING](SPEC_APP_FILE_LOGGING.md) |

### 5.1 Auth Supabase (paridad PHP)

Replicar `SupabaseAuthService`:

1. Recibir `Authorization: Bearer …`.
2. `GET {SUPABASE_URL}/auth/v1/user` con headers `Authorization` + `apikey: SUPABASE_ANON_KEY`.
3. Extraer `sub`, `email`, metadata de display/avatar.
4. **No** confiar solo en decode JWT local con un algoritmo fijo.
5. Errores → `401` con `{"detail": "..."}`.

Modo Playwright local ([SPEC_DEV_LOCAL_AUTH_PLAYWRIGHT](SPEC_DEV_LOCAL_AUTH_PLAYWRIGHT.md)): portar el bypass **solo** si `APP_ENV=local` y la spec de auth local sigue vigente.

### 5.2 Base de datos

- Misma `DATABASE_URL` hacia Postgres de Supabase (local `:54322` vía `host.docker.internal`).
- Misma política: escrituras de negocio desde el backend con service connection; no INSERT directo desde el rol `authenticated` del cliente para parents/crew.
- Migraciones: **autoridad sigue en** `supabase/migrations/` (+ historial compartido). El runner PHP (`MigrationRunner`) se porta o se sustituye por aplicación vía Supabase CLI / endpoint de status equivalente.

### 5.3 Storage local

Portar semántica de [SPEC_MEDIA_STORAGE](SPEC_MEDIA_STORAGE.md):

- `STORAGE_DRIVER=local`
- `MEDIA_ROOT` → montaje `web/media/`
- `prepare-upload` + `upload` + token TTL
- nginx sigue sirviendo GET `/media/...` (FastAPI **no** proxy de lectura)

### 5.4 IA / OpenRouter

Portar módulos de `shared/Ai/` y services de play con **misma semántica** documentada en:

- [SPEC_AI_OPENROUTER_GATEWAY](SPEC_AI_OPENROUTER_GATEWAY.md)
- [SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE](SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE.md)
- [SPEC_APP_ADVENTURE_LLM_NARRATIVE](SPEC_APP_ADVENTURE_LLM_NARRATIVE.md)
- resto de `SPEC_APP_*` / `SPEC_AI_*` vigentes

Ventaja async: compose en lotes (A2) con `asyncio.gather` / semáforos en lugar de paralelismo ad-hoc PHP.

**No** cambiar en esta migración las máximas de modelos free, colas `ai_purpose_model_queues`, ni contratos de espera UI.

### 5.5 Logs

Canales `api`, `ai`, `compose`, `client` en `web/logs/{canal}-{Y-m-d}.log` — misma forma JSONL. Variables `LOG_TO_FILES`, `LOG_LEVEL`, `APP_DEBUG_AI`, `LOG_CLIENT_INGEST`.

---

## 6. Docker local (única vía de desarrollo)

Actualiza el espíritu de [SPEC_POC_DOCKER_LOCAL_DEV](SPEC_POC_DOCKER_LOCAL_DEV.md):

| Servicio | Rol | Puerto host |
| --- | --- | --- |
| `web` (nginx) | Estáticos + `/media` + proxy `/api` | **8082:80** |
| `api` (fastapi/uvicorn) | Backend Python | interno `8000` |
| Supabase CLI | Auth + Postgres | **54321** / **54322** |

### 6.1 Proxy nginx (objetivo)

```nginx
location /api/ {
    proxy_pass http://api:8000;
    proxy_set_header Host $host;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 300s;   # play / compose LLM
}
```

### 6.2 Volúmenes

| Host | Contenedor | Acceso |
| --- | --- | --- |
| `web/` | nginx `/var/www/html` | ro (media rw según config) |
| `web/media/` | fastapi + nginx | rw en fastapi |
| `web/logs/` | fastapi | rw |
| `backend/` | fastapi | código hot-reload (`uvicorn --reload`) |

### 6.3 Transición (strangler)

Durante la migración por fases, nginx **puede** enrutar:

- rutas ya portadas → FastAPI
- rutas pendientes → php-fpm (temporal)

Cuando la fase N cierra con tests verdes + smoke Playwright, se corta el path PHP correspondiente. Al cerrar la última fase: **eliminar** servicios `php`, carpetas `api/` y `shared/` PHP del producto.

**Anti-patrón:** dos implementaciones divergentes de la misma ruta en producción estable. Solo coexisten durante la ventana de strangler documentada en el plan de tareas.

---

## 7. Hosting de producción (decisión abierta — bloqueante)

DreamHost **shared PHP** no ejecuta Uvicorn/FastAPI. Esta migración **obliga** a elegir hosting de API distinto del actual.

### Opciones candidatas (para aprobar con el usuario)

| Opción | Pros | Contras |
| --- | --- | --- |
| **A. VPS / VM** (Hetzner, DigitalOcean, …) + nginx | Control total; mismo origen posible | Ops propias |
| **B. PaaS** (Fly.io, Railway, Render) | Despliegue simple | Coste; CORS o reverse proxy |
| **C. Cloud Run / similar** | Escala a 0 | Antes descartado; reabrir solo con decisión explícita |
| **D. Estáticos en DreamHost + API en PaaS** | Menos cambio de front hosting | CORS, cookies, complejidad de origen |

**Requisito de producto:** preferir **mismo origen** HTTPS (nginx frontal que sirve `web/` y proxy `/api` → FastAPI) para no reescribir el cliente.

Hasta aprobar hosting, el alcance de implementación se limita a **Docker local + paridad de contrato**; el deploy prod se documenta en una sub-spec o sección de [SPEC_HOSTING_FREE_TIER_STACK](SPEC_HOSTING_FREE_TIER_STACK.md) actualizada.

---

## 8. Fases de migración (orden obligatorio)

Cada fase: **tests de contrato primero** → implementación mínima → smoke en `:8082` → actualizar diagramas/índice si aplica.

### Fase 0 — Andamiaje (sin cortar PHP)

1. Crear `backend/` con FastAPI health.
2. Añadir servicio Docker `api` (uvicorn) **en paralelo** a php.
3. nginx: ruta opcional de canary o puerto interno documentado.
4. `GET /api/v1/health` vía FastAPI en entorno de prueba (o path canary).
5. pytest verde para health + settings.

**Criterio de salida:** stack Docker levanta web + fastapi + supabase; health 200.

### Fase 1 — Auth + cuenta tutor

Portar: parents bootstrap/me, settings, crew CRUD/permissions, legal, client logs, architecture, migrations status.

**Criterio:** tests de contrato + flujo Playwright tutor (login local) → crew → settings → cuenta.

### Fase 2 — Storage media

Portar prepare-upload + upload; verificar GET `/media/...`.

### Fase 3 — Play / journey / IA

Portar PlayDialogue + Placement + Adventure + Journey + gateway OpenRouter + debug AI + file logging.

**Criterio:** un flujo feliz placement/adventure y un fallo `compose_failed` observable; logs en `web/logs/`.

### Fase 4 — Cutover total

1. nginx `/api/` → solo FastAPI.
2. Retirar php-fpm del compose.
3. Archivar o eliminar `api/` y `shared/` PHP (o mover a `legacy/` temporal con fecha de borrado).
4. Actualizar skills/reglas que digan “stack = PHP”.
5. Actualizar [SPEC_POC_PHP_DREAMHOST_ARCHITECTURE](SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md) y [SPEC_HOSTING_FREE_TIER_STACK](SPEC_HOSTING_FREE_TIER_STACK.md) a estado **legado / sustituido**.
6. Actualizar diagramas `01`, `03`, `04`, `13`, `14` y [PROJECT_OVERVIEW](../plan/PROJECT_OVERVIEW.md).

## 9. Variables de entorno

Reutilizar el conjunto de `.env.poc.sample` con los mismos nombres donde sea posible:

| Variable | Uso |
| --- | --- |
| `APP_ENV`, `APP_NAME` | Runtime |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Auth validation |
| `DATABASE_URL` | Postgres |
| `PUBLIC_API_URL`, `PUBLIC_SUPABASE_URL` | Expuestos vía architecture/config |
| `STORAGE_DRIVER`, `MEDIA_ROOT`, `MEDIA_PUBLIC_BASE_URL`, `UPLOAD_TOKEN_TTL` | Media |
| `OPENROUTER_*`, `AI_*`, `APP_DEBUG_AI` | IA |
| `LOG_TO_FILES`, `LOG_LEVEL`, `LOG_CLIENT_INGEST` | Logs |

Añadir si hace falta: `API_HOST`, `API_PORT`, `CORS_ORIGINS` (solo si el hosting no es same-origin).

---

## 10. Tests y validación

| Capa | Herramienta | Qué cubre |
| --- | --- | --- |
| Unidad / contrato API | pytest en contenedor o venv CI | Cada ruta migrada |
| Integración DB | Postgres Supabase local | parents/crew |
| UI observable | MCP Playwright `:8082` 390×844 | Flujos tutor + play |
| Logs | Lectura `web/logs/` | Tras play/IA |

Comando objetivo (tras Fase 0):

```powershell
docker compose --env-file .env.poc -f docker/compose.yaml exec api pytest -q
```

PHPUnit se mantiene **solo** mientras exista código PHP; no se exige paridad PHPUnit↔pytest en el cutover final.

---

## 11. Actualización documental obligatoria (al aprobar / al cerrar)

| Documento | Acción al aprobar | Acción al cerrar cutover |
| --- | --- | --- |
| Esta spec | Estado → **aprobada** | Estado → **implementada** |
| [CURRENT_SPECS.md](../CURRENT_SPECS.md) | Entrada pivot FastAPI | Stack canónico actualizado |
| [SPEC_POC_LOCAL_ARCHITECTURE](SPEC_POC_LOCAL_ARCHITECTURE.md) | Nota: sustituida por esta | — |
| Specs PHP DreamHost / PHP backend / hosting | Marcar “legado durante migración” | Sustituir o archivar |
| [SPEC_POC_DOCKER_LOCAL_DEV](SPEC_POC_DOCKER_LOCAL_DEV.md) | Delta nginx→fastapi | Reescribir servicios |
| Diagramas 01, 03, 04, 13, 14 | — | Mermaid FastAPI |
| Skills `spec-driven-dev-kidepik`, `AGENTS.md`, `PROJECT_OVERVIEW` | Nota de pivot en curso | Stack = FastAPI + web/ |
| Plan en `.cursor/tasks/` | Crear plan de fases | Archivar |

---

## 12. Criterios de éxito globales

1. `./scripts/poc-up.ps1` levanta nginx + FastAPI + Supabase; app en `http://localhost:8082`.
2. Cliente `web/` funciona **sin cambios de contrato** (salvo bugs descubiertos y acordados).
3. Auth Google / local Playwright sigue operativa.
4. Upload media + play LLM (si AI_ENABLED) operativos con logs JSONL.
5. Suite pytest de rutas migradas verde.
6. PHP fuera del camino de producto tras Fase 4.
7. Layout `backend/app/` listo para agents/mcp/skills sin reescritura del router.

---

## 13. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Drift de contrato JSON | Tests de contrato por ruta; comparar fixtures contra respuestas PHP en strangler |
| Timeouts LLM / proxy | `proxy_read_timeout` alto; misma política de 504 al cliente |
| Hosting DreamHost incompatible | Decisión §7 antes de prod |
| Alcance “portar todo el Ai PHP” | Fase 3 aislada; no mezclar features nuevas de producto |
| Agentes demasiado pronto | Fase 5 en spec hija; no bloquear cutover API |
| Doble mantenimiento PHP+Python | Strangler con fecha; no features nuevas en PHP tras Fase 0 |

---

## 14. Preguntas abiertas (necesitan respuesta del usuario)

1. **Hosting prod (§7):** ¿opción A/B/C/D u otra?
2. **ORM:** ¿SQLAlchemy async o asyncpg “a pelo”?
3. **Nombre de carpeta:** ¿confirmar `backend/` (histórico) frente a `api-py/`?
4. **Strangler:** ¿proxy selectivo por ruta durante fases, o big-bang tras Fase 3 en local?
5. **Retiro PHP:** ¿borrar del repo en el mismo PR de cutover o carpeta `legacy/` un sprint?

---

## 15. Aprobación

**No implementar código de producto** hasta que el usuario apruebe esta spec (y, como mínimo, responda §14.1 hosting o acepte “solo Docker local en esta epic”).

Tras aprobación:

1. Estado → `aprobada`.
2. Crear [.cursor/tasks/FASTAPI_BACKEND_MIGRATION_PLAN.md](../tasks/FASTAPI_BACKEND_MIGRATION_PLAN.md) con checklist por fase.
3. Empezar **Fase 0** en la rama `fast_api_backend`.
