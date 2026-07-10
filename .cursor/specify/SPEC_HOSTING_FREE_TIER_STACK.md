# Spec: Arquitectura MVP hosting — DreamHost PHP + Supabase + media local

> Estado: **aprobada para MVP** (actualizada julio 2026) · Relacionado: [docs/kidepik.md](../../docs/kidepik.md) §10.5–10.8  
> **Pivot jul 2026:** compute → **DreamHost PHP**; media → **filesystem `web/media/`** (sin Cloudflare R2 en MVP).  
> Storage detallado: [SPEC_MEDIA_STORAGE.md](SPEC_MEDIA_STORAGE.md).

## Decisión

El **MVP en producción** usa:

| Capa | Servicio | Rol |
| --- | --- | --- |
| **Hosting app + API + media** | **DreamHost** (PHP 8.2+, espacio en disco del plan) | `web/`, `api/`, ficheros en `web/media/` |
| **Base de datos** | **Supabase** (Postgres + pgvector) | Datos relacionales; **solo URLs** de media |
| **Autenticación** | **Supabase Auth** | JWT hacia API PHP |
| **IA** | **OpenRouter** vía PHP | Fase posterior |

**No en MVP:** Cloudflare R2, MinIO, Supabase Storage, FastAPI, Cloud Run.

**Migración futura:** object storage (R2) vía `STORAGE_DRIVER=s3` sin cambiar esquema de URLs en Postgres — [SPEC_MEDIA_STORAGE.md](SPEC_MEDIA_STORAGE.md).

## ¿Por qué media en DreamHost y no R2?

| Criterio | Filesystem DreamHost | Cloudflare R2 (aplazado) |
| --- | --- | --- |
| Coste MVP | Incluido en plan (espacio amplio) | Cuenta y configuración extra |
| Complejidad | nginx sirve `/media/` | SDK S3, presigned PUT, bucket |
| Egress | Del mismo hosting | Ilimitado en R2 (ventaja a escala) |
| Cuándo migrar | Tráfico alto, CDN, multi-región | Checklist en SPEC_MEDIA_STORAGE |

## Neon vs Supabase

**Decisión:** **Supabase** para DB + Auth.

## Flujo de datos

```
App web / Capacitor ──JWT──► PHP API (DreamHost, mismo origen)
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
    Supabase Postgres          OpenRouter (IA)
    (URLs /media/...)               │
         │                          │
Cliente ──GET /media/...──► nginx (fichero en disco)
```

**Reglas:**

- Postgres guarda `public_url` (p. ej. `/media/avatars/{user}/{uuid}.jpg`).
- Lectura de ficheros: **directa** por nginx, sin PHP en el medio.
- Escritura: API `prepare-upload` + `upload` (local).

## DreamHost — consideraciones

| Tema | Recomendación |
| --- | --- |
| PHP | 8.2+; `pdo_pgsql` |
| `web/media/` | Crear en deploy; permisos escritura PHP; sin ejecución PHP en esa ruta |
| Backups | Incluir `media/` en estrategia DreamHost |
| Deploy | rsync/SFTP `web/` + `api/` + `shared/` |

## Desarrollo local

Docker nginx + php-fpm; `web/media/` bind-mount. Sin MinIO. [SPEC_POC_DOCKER_LOCAL_DEV.md](SPEC_POC_DOCKER_LOCAL_DEV.md).

## Criterios de éxito MVP

1. JWT Supabase + API PHP operativa.
2. Upload media → URL en Postgres → GET `/media/...` OK.
3. HTTPS en DreamHost.
4. Sin servicios cloud de storage adicionales en MVP.

## Histórico

- **Cloud Run / FastAPI / R2:** descartados para MVP jul 2026; R2 documentado como evolución en SPEC_MEDIA_STORAGE.
- **OCI ARM:** north star infra, no MVP activo.

## Pendiente

- [ ] Dominio DreamHost KidepiK.
- [ ] Proyecto Supabase cloud + secretos.
- [ ] Script deploy DreamHost.
- [ ] Implementar `LocalFilesystemDriver` + API storage.
