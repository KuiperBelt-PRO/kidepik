# Spec: POC local — arquitectura histórica (DESCARTADA)

> Estado: **descartada** (julio 2026)  
> **No implementar.** Conservada solo como aviso para agentes.

## Decisión

El POC FastAPI + MinIO / Cloudflare R2 / puerto `:8080` **ya no forma parte** del producto.

**Stack canónico vigente:**

| Capa | Tecnología |
| --- | --- |
| App + API | PHP (`api/` + `shared/`) + nginx Docker `:8082` / DreamHost |
| Cliente | `web/` HTML/CSS/JS |
| Auth + DB | Supabase |
| Media | filesystem `web/media/` (`STORAGE_DRIVER=local`) |

Ver: [SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md](SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md), [SPEC_POC_DOCKER_LOCAL_DEV.md](SPEC_POC_DOCKER_LOCAL_DEV.md), [SPEC_MEDIA_STORAGE.md](SPEC_MEDIA_STORAGE.md), [diagrams/README.md](../diagrams/README.md).

**Eliminado del repo:** carpeta `backend/` (FastAPI), MinIO, alias `presign-upload`, driver S3/R2, script `poc-web-dev.ps1`.
