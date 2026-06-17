# POC local — arranque, URLs y cliente web

> **Estado:** validada (junio 2026) — tres integraciones en verde con cliente `web/`.

Ver spec: [.cursor/specify/SPEC_POC_LOCAL_ARCHITECTURE.md](../.cursor/specify/SPEC_POC_LOCAL_ARCHITECTURE.md)

## Requisitos

- Docker Desktop
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) o `pnpm dlx supabase`
- Node.js 20+ y pnpm

## Arranque rápido (backend)

```powershell
cd kidepik
./scripts/poc-up.ps1
```

| Servicio | Simula | Puerto |
| --- | --- | --- |
| Supabase | DB + Auth | 54321 |
| `api` (Docker) | Cloud Run | 8080 |
| `minio` (Docker) | R2 | 9000 |

## Cliente web (producto)

```powershell
./scripts/poc-web-dev.ps1
```

Abre **`http://localhost:8082`** (loader → galería → mockups). Con POC arquitectura:

```powershell
./scripts/poc-web-dev.ps1 -Backend
```

Preview móvil en PC (Electron 390×844):

```powershell
./scripts/poc-web-preview.ps1
```

Capturas de agentes: `tmp/playwright-output/`. Spec preview: [.cursor/specify/SPEC_WEB_DEV_PREVIEW.md](../.cursor/specify/SPEC_WEB_DEV_PREVIEW.md).

### Config del cliente

El script `poc-web-dev.ps1` genera `web/js/config.js` con URLs `localhost` y la publishable key de Supabase (`supabase status`).

### Notas técnicas

- **JWT Supabase (ES256):** el backend valida tokens llamando a `GET /auth/v1/user`, no decodificando JWT en local.
- **Presigned MinIO:** en desarrollo local con `localhost` en el navegador del PC; para dispositivo físico en la misma red, ajustar `.env.poc` con IP LAN (`S3_PUBLIC_BASE_URL`, `S3_EXTERNAL_ENDPOINT_URL`).
- Publishable key local: `supabase status` → `Publishable`.

## Tests backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -e ".[dev]"
pytest
```

## Parar

```powershell
./scripts/poc-down.ps1
```

## Estructura del repo (POC)

```
backend/     # FastAPI (Cloud Run sim)
docker/      # compose: api + minio
web/         # Cliente HTML/CSS/JS
scripts/     # poc-up, poc-down, poc-web-dev, poc-web-preview
supabase/    # config + migraciones
.env.poc.sample
```

Archivos locales no versionados: `.env.poc`, `web/js/config.js`, `tmp/`, `supabase/.temp/`.
