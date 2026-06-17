# Spec: POC local — arquitectura FastAPI + Supabase + R2

> Estado: **validada** (junio 2026) — cliente `web/` + tres capas en verde  
> Relacionado: [SPEC_HOSTING_FREE_TIER_STACK.md](SPEC_HOSTING_FREE_TIER_STACK.md), [docs/kidepik.md](../../docs/kidepik.md) §10, [docs/POC_LOCAL.md](../../docs/POC_LOCAL.md)

## Objetivo

Validar en local que el **cliente web** puede hablar con las **tres capas** del MVP producción, sin implementar funcionalidad de producto.

| Capa producción | Simulación local |
| --- | --- |
| GCP Cloud Run (FastAPI) | Contenedor `api` en Docker, puerto **8080** |
| Supabase (Postgres + Auth + REST) | **Supabase CLI** (`supabase start`), puerto **54321** |
| Cloudflare R2 (S3) | **MinIO** (API S3-compatible), puerto **9000** |

## Alcance

### Incluido

- Stack levantable con `scripts/poc-up.ps1` (Supabase + Docker Compose).
- FastAPI con healthcheck, validación JWT Supabase y presigned URLs hacia MinIO/R2.
- Migración SQL mínima (`poc_health`) accesible vía PostgREST.
- Cliente **`web/`** (HTML/CSS/JS) con pantalla POC que prueba las 3 integraciones.
- Documentación de URLs para desarrollo en `localhost:8082`.

### Excluido (fuera de POC)

- LangGraph, IA, lógica pedagógica, avatar, narrativa.
- Cloud Run real, Supabase cloud, R2 cloud.
- Capacitor, builds de tienda, CI.

## Contratos

### FastAPI (`http://HOST:8080`)

| Ruta | Auth | Comportamiento |
| --- | --- | --- |
| `GET /health` | No | `{ "status": "ok", "service": "kidepik-api" }` |
| `GET /api/v1/architecture/status` | No | Estado de conexión a Postgres (vía env) y MinIO/R2 |
| `GET /api/v1/architecture/config` | No | URLs públicas para cliente (API, Supabase, storage) |
| `POST /api/v1/storage/presign-upload` | Bearer Supabase | Body `{ "filename": "..." }` → URL firmada PUT + URL pública lectura |

**Auth en FastAPI:** validación del access token vía `GET /auth/v1/user` de Supabase (compatible ES256/HS256). No decodificar JWT localmente con un solo algoritmo.

**Presigned URLs:** en desarrollo con navegador en el mismo PC, `localhost` suele bastar. Para dispositivo en la LAN, usar **IP LAN del PC** en `.env.poc` (`S3_PUBLIC_BASE_URL` / `S3_EXTERNAL_ENDPOINT_URL`).

**Regla producción replicada:** FastAPI **no** hace proxy de binarios; solo devuelve URLs.

### Supabase local

- API: `http://HOST:54321`
- Auth: registro/login email+password de prueba.
- Tabla `public.poc_health` con fila `{ message: 'poc ready' }` — el cliente la lee vía Supabase JS.

### Storage (MinIO ≈ R2)

- Bucket `kidepik-media`, credenciales en `.env` (no versionadas).
- Mismo cliente `boto3` que producción; cambia solo `endpoint_url` y credenciales.

## Cliente web

- **Desarrollo:** `./scripts/poc-web-dev.ps1` → `http://localhost:8082`
- **Preview móvil PC:** `./scripts/poc-web-preview.ps1` (Electron 390×844)
- Config: `web/js/config.js` (generado por script desde `config.sample.js` + `supabase status`)

## Criterios de éxito

1. `scripts/poc-up.ps1` deja Supabase + API + MinIO en verde.
2. `GET /health` responde 200 desde el host.
3. Cliente `web/`: login Supabase OK + lectura `poc_health` OK + upload vía presign OK.
4. Tests backend (`pytest`) pasan en local.

**Resultado (jun 2026):** criterios 1–3 verificados con cliente web en `localhost:8082`.

## Estructura de archivos

```
kidepik/
  backend/           # FastAPI
  web/               # Cliente HTML/CSS/JS
  docker/            # compose.yaml (api + minio)
  supabase/          # config.toml + migrations
  scripts/           # poc-up.ps1, poc-down.ps1, poc-web-dev.ps1, poc-web-preview.ps1
  .env.poc.sample    # plantilla env Docker (copiar a .env.poc)
```
