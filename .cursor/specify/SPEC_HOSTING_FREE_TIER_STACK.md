# Spec: Arquitectura MVP hosting — DreamHost PHP + Supabase + media local

> Estado: **aprobada** (julio 2026; sin R2/OCI/Cloud Run)  
> Relacionado: [docs/kidepik.md](../../docs/kidepik.md) §10 · [SPEC_MEDIA_STORAGE.md](SPEC_MEDIA_STORAGE.md)

## Decisión

El **producto en producción** usa únicamente:

| Capa | Servicio | Rol |
| --- | --- | --- |
| **Hosting app + API + media** | **DreamHost** (PHP 8.2+) | `web/`, `api/`, `web/media/` |
| **Base de datos** | **Supabase** (Postgres) | Datos; **solo URLs** de media |
| **Autenticación** | **Supabase Auth** | JWT hacia API PHP |
| **IA** | **OpenRouter** vía PHP | Fase posterior |

**No formar parte del plan:** Cloudflare R2, MinIO, Supabase Storage, FastAPI, GCP Cloud Run, Oracle OCI Always Free.

## Flujo de datos

```
App web / Capacitor ──JWT──► PHP API (DreamHost, mismo origen)
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
    Supabase Postgres          OpenRouter (IA)
    (URLs /media/...)               
         │                          
Cliente ──GET /media/...──► nginx (fichero en disco)
```

**Reglas:**

- Postgres guarda `public_url` (p. ej. `/media/avatars/{user}/{uuid}.jpg`).
- Lectura de ficheros: **directa** por nginx.
- Escritura: API `prepare-upload` + `upload` (local).

## DreamHost — consideraciones

| Tema | Recomendación |
| --- | --- |
| PHP | 8.2+; `pdo_pgsql` |
| `web/media/` | Crear en deploy; permisos escritura PHP; sin ejecución PHP en esa ruta |
| Backups | Incluir `media/` en estrategia DreamHost |
| Deploy | rsync/SFTP `web/` + `api/` + `shared/` |

## Desarrollo local

Docker nginx + php-fpm; `web/media/` bind-mount. [SPEC_POC_DOCKER_LOCAL_DEV.md](SPEC_POC_DOCKER_LOCAL_DEV.md). Arranque: `./scripts/poc-up.ps1` → `http://localhost:8082`.

## Criterios de éxito

1. JWT Supabase + API PHP operativa.
2. Upload media → URL en Postgres → GET `/media/...` OK.
3. HTTPS en DreamHost.
4. Sin object storage cloud ni compute OCI/Cloud Run.

## Descartado (no reabrir sin decisión explícita)

R2/S3, MinIO, FastAPI/`backend/`, OCI ARM, Cloud Run como hosting de API.
