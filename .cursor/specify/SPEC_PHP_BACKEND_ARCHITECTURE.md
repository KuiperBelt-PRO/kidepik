# Spec: Backend PHP — estructura, contratos y hoja de ruta RAG

> Estado: **aprobada** (julio 2026; storage solo local)  
> Relacionado: [SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md](SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md), [SPEC_MEDIA_STORAGE.md](SPEC_MEDIA_STORAGE.md), [docs/kidepik.md](../../docs/kidepik.md) §7–9

## Objetivo

Definir la arquitectura del **backend PHP** de KidepiK: organización de código, dependencias, validación Supabase, acceso a Postgres, **almacenamiento de media en filesystem** y hoja de ruta RAG.

## Contexto

- PHP en DreamHost: APIs REST, validación JWT, uploads a disco y orquestación HTTP a OpenRouter.
- Media en **`web/media/`** — único modo soportado ([SPEC_MEDIA_STORAGE.md](SPEC_MEDIA_STORAGE.md)).
- LangGraph no aplica; orquestación multi-paso en PHP explícito.

## Versiones y dependencias

| Componente | Versión mínima |
| --- | --- |
| PHP | **8.2+** |
| Composer | 2.x |
| Extensiones PHP | `pdo_pgsql`, `json`, `curl`, `mbstring`, `openssl`, `fileinfo` |

### Dependencias Composer (POC)

| Paquete | Uso |
| --- | --- |
| `vlucas/phpdotenv` | Carga `.env` |
| `guzzlehttp/guzzle` | HTTP Supabase Auth, OpenRouter |
| `phpunit/phpunit` | Tests (dev) |

Sin SDK S3/AWS.

## Estructura de directorios

```
api/
  public/index.php
  src/
    Controllers/
    Services/
    Http/
    Router.php
  tests/

shared/
  Config.php
  Database/
  Storage/
    StorageDriver.php
    UploadPlan.php
    LocalFilesystemDriver.php
    StorageDriverFactory.php
```

## Enrutamiento (núcleo POC + producto)

| Método | Ruta | Controlador |
| --- | --- | --- |
| GET | `/api/v1/health` | `HealthController` |
| GET | `/api/v1/architecture/status` | `ArchitectureController::status` |
| GET | `/api/v1/architecture/config` | `ArchitectureController::config` |
| POST | `/api/v1/storage/prepare-upload` | `StorageController::prepareUpload` |
| POST | `/api/v1/storage/upload` | `StorageController::upload` |
| … | parents, crew, legal, migrations | ver `Router.php` y [diagrams/04-backend-php.md](../diagrams/04-backend-php.md) |

## Autenticación Supabase

Validación vía `GET {SUPABASE_URL}/auth/v1/user` con Bearer + `apikey`. No decodificar JWT local con un solo algoritmo.

## Base de datos

- PDO `pgsql` con `DATABASE_URL`.
- URLs de media en columnas `text`; nunca blobs.

## Storage

- Solo `LocalFilesystemDriver` (`STORAGE_DRIVER=local`).
- Lectura: nginx sirve `/media/`; PHP no proxy en GET.

## Configuración y secretos

| Variable | Dónde |
| --- | --- |
| `DATABASE_URL` | Solo servidor |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Servidor + anon en cliente |
| `STORAGE_DRIVER`, `MEDIA_ROOT`, `MEDIA_PUBLIC_BASE_URL` | Solo servidor (`local`) |
| `OPENROUTER_API_KEY` | Solo servidor (fase IA) |

## Tests (PHPUnit)

| Test | Escenario |
| --- | --- |
| `HealthTest` | GET health → 200 |
| `ArchitectureTest` | status → postgres ok + media writable |
| `StorageTest` | prepare-upload sin token → 401 |

## Hoja de ruta RAG (post-POC)

`OpenRouterClient` → embeddings pgvector → `shared/Rag/` → agentes narrador/validador.

## Criterios de éxito

1. `composer install` en Docker; autoload PSR-4.
2. Rutas con JSON alineado a [SPEC_MEDIA_STORAGE.md](SPEC_MEDIA_STORAGE.md).
3. PHPUnit verde.
4. `LocalFilesystemDriver` operativo.

## Descartado

FastAPI (`backend/`), R2/S3, alias `presign-upload`, OCI, Cloudflare como storage.
