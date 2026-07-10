# Spec: Backend PHP — estructura, contratos y hoja de ruta RAG

> Estado: **propuesta para aprobación** (julio 2026)  
> Relacionado: [SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md](SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md), [SPEC_MEDIA_STORAGE.md](SPEC_MEDIA_STORAGE.md), [docs/kidepik.md](../../docs/kidepik.md) §7–9

## Objetivo

Definir la arquitectura del **backend PHP** de KidepiK: organización de código, dependencias, validación Supabase, acceso a Postgres, **almacenamiento de media** (filesystem local con abstracción migrable) y hoja de ruta RAG.

## Contexto

- PHP en DreamHost: APIs REST, validación JWT, uploads a disco y orquestación HTTP a OpenRouter.
- Media en **`web/media/`** en MVP; migración futura a R2 vía `StorageDriver` — ver [SPEC_MEDIA_STORAGE.md](SPEC_MEDIA_STORAGE.md).
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

`aws/aws-sdk-php` — **solo cuando** se implemente `S3ObjectStorageDriver` (fase R2); no obligatorio en POC MVP.

## Estructura de directorios

```
api/
  public/index.php
  src/
    Controllers/
      HealthController.php
      ArchitectureController.php
      StorageController.php
    Services/
      SupabaseAuthService.php
      DatabaseService.php
  tests/

shared/
  Config.php
  Storage/
    StorageDriver.php
    UploadPlan.php
    LocalFilesystemDriver.php
    S3ObjectStorageDriver.php    # stub o implementación futura
    StorageDriverFactory.php
```

## Enrutamiento

| Método | Ruta | Controlador |
| --- | --- | --- |
| GET | `/api/v1/health` | `HealthController` |
| GET | `/api/v1/architecture/status` | `ArchitectureController::status` |
| GET | `/api/v1/architecture/config` | `ArchitectureController::config` |
| POST | `/api/v1/storage/prepare-upload` | `StorageController::prepareUpload` |
| POST | `/api/v1/storage/presign-upload` | Alias legacy → mismo handler |
| POST | `/api/v1/storage/upload` | `StorageController::upload` (driver `local`) |

## Autenticación Supabase

Validación vía `GET {SUPABASE_URL}/auth/v1/user` con Bearer + `apikey`. No decodificar JWT local con un solo algoritmo.

## Base de datos

- PDO `pgsql` con `DATABASE_URL`.
- POC: `public.poc_health` en `architecture/status`.
- URLs de media en columnas `text`; nunca blobs.

## Storage

Implementación según [SPEC_MEDIA_STORAGE.md](SPEC_MEDIA_STORAGE.md):

- `StorageDriverFactory::fromEnv()` según `STORAGE_DRIVER`.
- MVP: `LocalFilesystemDriver` escribe bajo `MEDIA_ROOT` (`web/media/`).
- Lectura: nginx sirve `/media/`; PHP no proxy en GET.
- Futuro: `S3ObjectStorageDriver` sin cambiar contratos JSON ni columnas URL.

## Configuración y secretos

| Variable | Dónde |
| --- | --- |
| `DATABASE_URL` | Solo servidor |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Servidor + anon en cliente |
| `STORAGE_DRIVER`, `MEDIA_ROOT`, `MEDIA_PUBLIC_BASE_URL` | Solo servidor |
| `OPENROUTER_API_KEY` | Solo servidor (fase IA) |
| `S3_*` | Solo servidor (fase R2) |

## Tests (PHPUnit)

| Test | Escenario |
| --- | --- |
| `HealthTest` | GET health → 200 |
| `ArchitectureTest` | status → postgres ok + media writable |
| `StorageTest` | prepare-upload sin token → 401; con token → upload + public_url GET 200 |

## Hoja de ruta RAG (post-POC)

Sin cambios de visión: `OpenRouterClient` → embeddings pgvector → `shared/Rag/` → agentes narrador/validador.

## Criterios de éxito (POC PHP)

1. `composer install` en Docker; autoload PSR-4.
2. Rutas POC con JSON alineado a [SPEC_MEDIA_STORAGE.md](SPEC_MEDIA_STORAGE.md).
3. PHPUnit verde.
4. `LocalFilesystemDriver` operativo; `S3ObjectStorageDriver` stub documentado.

## Aprobación

- [ ] Usuario aprueba estructura `api/` + `shared/` sin framework pesado.
- [x] Usuario aprueba media local + interfaz `StorageDriver` migrable.
