# 01 — Contexto de sistema

**Specs:** [docs/kidepik.md](../../docs/kidepik.md), [SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md](../specify/SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md), [SPEC_HOSTING_FREE_TIER_STACK.md](../specify/SPEC_HOSTING_FREE_TIER_STACK.md)

## Quién usa qué

```mermaid
flowchart TB
  subgraph actors [Actores]
    Tutor[Tutor / padre]
    Nino[Niño 7-9]
    Agente[Agente IA / dev]
  end

  subgraph client [Cliente]
    Web["web/ HTML+CSS+JS\nCapacitor futuro"]
  end

  subgraph edge [Origen único]
    Nginx["nginx :8082 / DreamHost\nestáticos + /api + /media"]
  end

  subgraph php [Backend]
    Api["api/ PHP 8.2+\nJWT via Supabase Auth"]
    Shared["shared/ Config Storage DB"]
  end

  subgraph data [Datos]
    SBAuth[Supabase Auth]
    PG[(Postgres)]
    Media["web/media/ filesystem"]
  end

  Tutor --> Web
  Nino --> Web
  Agente --> Web
  Web --> Nginx
  Nginx --> Api
  Nginx --> Media
  Api --> Shared
  Api --> SBAuth
  Api --> PG
  Shared --> Media
```

## Arquitectura vigente (única)

| Incluido | Descartado (no reabrir sin decisión) |
| --- | --- |
| DreamHost PHP + Supabase + media local | Cloudflare R2 / S3 / MinIO |
| Auth Google (tutor) | FastAPI / carpeta `backend/` |
| Cliente `web/` en `:8082` | Oracle OCI Always Free |
| | GCP Cloud Run como hosting API |

## Anti-errores

- Producto local = **`http://localhost:8082`**.
- Media = disco bajo `web/media/`, no blob en Postgres ni object storage cloud.
- Arranque = `./scripts/poc-up.ps1` únicamente.
