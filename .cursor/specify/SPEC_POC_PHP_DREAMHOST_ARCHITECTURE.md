# Spec: POC — arquitectura PHP (DreamHost) + Supabase

> Estado: **aprobada** (julio 2026; limpieza legacy jul 2026)  
> Aviso histórico FastAPI: [SPEC_POC_LOCAL_ARCHITECTURE.md](SPEC_POC_LOCAL_ARCHITECTURE.md)  
> Relacionado: [SPEC_POC_DOCKER_LOCAL_DEV.md](SPEC_POC_DOCKER_LOCAL_DEV.md), [SPEC_PHP_BACKEND_ARCHITECTURE.md](SPEC_PHP_BACKEND_ARCHITECTURE.md), [SPEC_MEDIA_STORAGE.md](SPEC_MEDIA_STORAGE.md), [SPEC_HOSTING_FREE_TIER_STACK.md](SPEC_HOSTING_FREE_TIER_STACK.md), [docs/kidepik.md](../../docs/kidepik.md) §10

## Objetivo

Backend **PHP** en el mismo dominio que el cliente web, desplegable en **DreamHost**, con **Supabase** (DB + Auth) y media en **`web/media/`**.

## Decisión de stack

| Capa | Tecnología | Descartado |
| --- | --- | --- |
| **Cliente** | `web/` HTML + CSS + JS | — |
| **API** | **PHP 8.2+** (`api/` + `shared/`) | FastAPI, Python producto |
| **DB + Auth** | **Supabase** | Neon como primario |
| **Media** | Filesystem `web/media/` | R2, MinIO, Supabase Storage |
| **Hosting** | **DreamHost** | Cloud Run, OCI |
| **IA (futuro)** | OpenRouter vía PHP | — |

## Diagrama lógico (producción)

```
DreamHost (mismo origen HTTPS)
  estáticos web/ + /media/* + /api/v1/* (PHP)
        │                    │
        ▼                    ▼
  Supabase Auth        Supabase Postgres (URLs media, no blobs)
```

Local: Docker nginx + php-fpm en `:8082` — [SPEC_POC_DOCKER_LOCAL_DEV.md](SPEC_POC_DOCKER_LOCAL_DEV.md).

## Estructura

```
kidepik/
  web/          # cliente + media/
  api/          # PHP
  shared/       # Storage local, Config, Database
  docker/       # nginx + php-fpm
  supabase/
  scripts/      # poc-up, poc-down, poc-web-preview
```

## Contratos HTTP (núcleo)

| Ruta | Auth | Comportamiento |
| --- | --- | --- |
| `GET /api/v1/health` | No | ok |
| `GET /api/v1/architecture/status\|config` | No | estado / URLs |
| `POST /api/v1/storage/prepare-upload` | Bearer | [SPEC_MEDIA_STORAGE](SPEC_MEDIA_STORAGE.md) |
| `POST /api/v1/storage/upload` | Token | escribe `web/media/` |

Rutas producto (parents, crew, legal, …): `Router.php` y [diagrams/04-backend-php.md](../diagrams/04-backend-php.md).

## Criterios de éxito

1. `./scripts/poc-up.ps1` → stack verde.
2. Health 200 en `:8082`.
3. Upload media + GET `/media/...` OK.
4. PHPUnit verde en contenedor.
5. Solo `LocalFilesystemDriver`.

## Descartado (eliminado del repo)

`backend/` FastAPI, MinIO, R2/S3 driver, `presign-upload`, `poc-web-dev.ps1`, OCI MCP.
