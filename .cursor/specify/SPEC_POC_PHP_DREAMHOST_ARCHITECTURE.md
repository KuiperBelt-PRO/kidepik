# Spec: POC — arquitectura PHP (DreamHost) + Supabase

> Estado: **propuesta para aprobación** (julio 2026)  
> **Sustituye:** [SPEC_POC_LOCAL_ARCHITECTURE.md](SPEC_POC_LOCAL_ARCHITECTURE.md) (FastAPI + MinIO + Supabase CLI en host)  
> Relacionado: [SPEC_POC_DOCKER_LOCAL_DEV.md](SPEC_POC_DOCKER_LOCAL_DEV.md), [SPEC_PHP_BACKEND_ARCHITECTURE.md](SPEC_PHP_BACKEND_ARCHITECTURE.md), [SPEC_MEDIA_STORAGE.md](SPEC_MEDIA_STORAGE.md), [SPEC_HOSTING_FREE_TIER_STACK.md](SPEC_HOSTING_FREE_TIER_STACK.md), [docs/kidepik.md](../../docs/kidepik.md) §10

## Objetivo

Simplificar la POC de KidepiK para que el **backend sea PHP** en el mismo dominio que el cliente web, desplegable en **DreamHost** (HTML, CSS, JavaScript y PHP), con **Supabase** como base de datos y autenticación.

El backend Python (FastAPI) queda **descartado para la POC**; el código en `backend/` se conserva como referencia histórica hasta su eliminación en una tarea de limpieza posterior.

## Decisión de stack (julio 2026)

| Capa | POC / MVP | Descartado (POC) |
| --- | --- | --- |
| **Cliente** | `web/` — HTML + CSS + JS (ES modules) | — |
| **API servidor** | **PHP 8.2+** (`api/` + `shared/`) | FastAPI, LangGraph, Python |
| **Base de datos + Auth** | **Supabase** (Postgres + Auth + pgvector) | Postgres local en VM, Neon |
| **Media (objetos)** | **Filesystem bajo `web/media/`** en DreamHost / Docker | Cloudflare R2, MinIO, Supabase Storage |
| **Hosting compute** | **DreamHost** (shared / VPS PHP del usuario) | GCP Cloud Run, Oracle Micro (MVP anterior) |
| **IA (futuro)** | OpenRouter vía PHP HTTP; librería RAG propia en PHP | LangGraph |

Detalle de media y migración futura a object storage: [SPEC_MEDIA_STORAGE.md](SPEC_MEDIA_STORAGE.md).

## Diagrama lógico

### Producción (DreamHost)

```
┌─────────────────────────────────────────────────────────────┐
│  DreamHost — mismo origen (HTTPS)                            │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Document root                                        │  │
│  │  • index.html, css/, js/, assets/  → estáticos        │  │
│  │  • /media/*                        → ficheros (nginx) │  │
│  │  • /api/v1/*                       → PHP (router)     │  │
│  └──────────────────────────┬───────────────────────────┘  │
└─────────────────────────────┼──────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
        Supabase Auth                   Supabase Postgres
        (JWT al cliente)                (solo URLs de media,
                                         no blobs)
              │
              └── OpenRouter (IA, fase posterior)
```

### Desarrollo local (Docker — ver spec dedicada)

El PC **no** ejecuta servidores de aplicación en el host (`php -S`, `uvicorn`, `npx serve`). Todo el tráfico de la app pasa por **Docker Compose** que replica la topología DreamHost.

## Alcance

### Incluido

- Estructura `api/` + `shared/` + `web/` servida por **nginx + php-fpm** en Docker.
- Paridad de rutas API POC (health, architecture, storage prepare-upload).
- Validación JWT Supabase en PHP (mismo contrato: `GET /auth/v1/user`).
- Supabase local vía contenedores (CLI `supabase start` — ver [SPEC_POC_DOCKER_LOCAL_DEV.md](SPEC_POC_DOCKER_LOCAL_DEV.md)).
- Media en `web/media/` con driver `local` ([SPEC_MEDIA_STORAGE.md](SPEC_MEDIA_STORAGE.md)).
- Pantalla POC en `web/` que prueba Auth + Postgres + upload media.
- Despliegue documentado hacia DreamHost (SFTP/rsync de `web/` + `api/`).

### Excluido (esta fase)

- Cloudflare R2, MinIO y Supabase Storage para media.
- Implementación completa de RAG / agentes IA (solo esqueleto en [SPEC_PHP_BACKEND_ARCHITECTURE.md](SPEC_PHP_BACKEND_ARCHITECTURE.md)).
- Capacitor, builds de tienda, CI de producción.
- Eliminación física de `backend/` Python (tarea posterior).
- Oracle ARM / Cloud Run como compute del MVP.

## Estructura de repositorio (objetivo)

```
kidepik/
  web/
    index.html
    css/ js/ assets/
    media/                  # Uploads; subcarpetas con .gitkeep; ficheros gitignored
      avatars/ audio/ pdf/ illustrations/ poc/
    js/config.sample.js
  api/
    public/index.php
    src/
  shared/
    Storage/                # StorageDriver + LocalFilesystemDriver (+ S3 stub futuro)
  docker/
    compose.yaml            # nginx + php-fpm (sin MinIO)
    nginx/ php/
  supabase/
  scripts/
    poc-up.ps1
    poc-down.ps1
  backend/                  # LEGACY — FastAPI
```

## Contratos HTTP (API PHP)

Base URL en producción: `https://<dominio-dreamhost>/api/v1`  
Base URL en local Docker: `http://localhost:8082/api/v1` (mismo origen que el cliente).

| Ruta | Auth | Comportamiento |
| --- | --- | --- |
| `GET /api/v1/health` | No | `{ "status": "ok", "service": "kidepik-api" }` |
| `GET /api/v1/architecture/status` | No | Estado Postgres (Supabase) y media (`MEDIA_ROOT` escribible) |
| `GET /api/v1/architecture/config` | No | URLs públicas (API, Supabase, `media_base_url`) |
| `POST /api/v1/storage/prepare-upload` | Bearer Supabase | Ver [SPEC_MEDIA_STORAGE.md](SPEC_MEDIA_STORAGE.md) |
| `POST /api/v1/storage/upload` | Token + multipart | Solo driver `local`; escribe en `web/media/` |

Alias legacy: `POST /api/v1/storage/presign-upload` → mismo handler que `prepare-upload`.

### Reglas de negocio

1. **Auth:** PHP valida el access token vía `GET {SUPABASE_URL}/auth/v1/user`. No decodificar JWT localmente con un solo algoritmo.
2. **Media lectura:** el cliente descarga **directo** desde `/media/...` (nginx). PHP no hace proxy de binarios en GET.
3. **Media escritura:** vía API `prepare-upload` + `upload` (local); Postgres guarda **solo** `public_url`.
4. **Base de datos:** `DATABASE_URL` solo en servidor; cliente usa Supabase JS para Auth y lecturas POC permitidas.
5. **CORS:** Mínimo — mismo origen en DreamHost y en Docker `:8082`.

### Supabase

- **Producción:** proyecto Supabase cloud (EU si es posible).
- **Local:** API en `http://localhost:54321`.
- Tabla POC: `public.poc_health` con fila `{ message: 'poc ready' }`.

## Cliente web

- Servido por **nginx en Docker** en `http://localhost:8082`.
- `web/js/config.js`: `API_URL` relativo `/api/v1`; opcional `MEDIA_BASE_URL` (default `/media`).
- Preview Electron y Playwright: `http://localhost:8082`.

## Despliegue DreamHost

| Artefacto | Destino típico DreamHost |
| --- | --- |
| `web/*` (incl. `media/` vacía o con `.gitkeep`) | `~/<dominio>/` (document root) |
| `api/public/*` + bootstrap | `~/<dominio>/api/` o integrado vía nginx |
| `shared/` | Fuera de document root o `include_path` |
| Secretos | `.env` no versionado |
| Supabase | Cloud — variables en PHP |
| Media subida | Crece en `~/dominio/media/` en el servidor |

## Criterios de éxito

1. `./scripts/poc-up.ps1` deja nginx+PHP (+ Supabase contenedores) en verde sin servidores en el host Windows.
2. `GET http://localhost:8082/api/v1/health` → 200.
3. Cliente web: login Supabase OK; `poc_health` OK; upload media OK; GET `/media/poc/...` OK.
4. Hot reload PHP/JS/CSS sin rebuild Docker (bind mounts).
5. PHPUnit verde en contenedor.
6. `StorageDriver` implementado; `S3ObjectStorageDriver` puede quedar stub.

## Migración desde POC FastAPI

| Componente actual | Acción |
| --- | --- |
| `backend/` FastAPI | Congelar |
| `docker/compose.yaml` servicios `api` Python + `minio` | Sustituir por `php` + `nginx`; **eliminar MinIO** |
| `presign-upload` (S3) | Renombrar semántica a `prepare-upload` agnóstico ([SPEC_MEDIA_STORAGE.md](SPEC_MEDIA_STORAGE.md)) |
| `scripts/poc-web-dev.ps1` | Deprecar |

## Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Espacio/copia DreamHost sin CDN | Aceptable en MVP; driver S3 futuro sin cambiar contratos |
| Media en mismo servidor que PHP | nginx sirve estáticos; PHP no en ruta `/media/` |
| Límites CPU DreamHost | Uploads acotados; IA async en fases posteriores |

## Aprobación

- [ ] Usuario aprueba pivot **PHP + DreamHost + Supabase** (sin FastAPI en POC).
- [ ] Usuario aprueba desarrollo **solo vía Docker** con hot reload.
- [x] Usuario aprueba **media en filesystem local** (`web/media/`), sin Cloudflare en MVP.
