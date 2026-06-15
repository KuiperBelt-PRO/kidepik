# Spec: POC local — arquitectura FastAPI + Supabase + R2

> Estado: **validada** (junio 2026) — Expo Go + móvil físico, tres capas en verde  
> Relacionado: [SPEC_HOSTING_FREE_TIER_STACK.md](SPEC_HOSTING_FREE_TIER_STACK.md), [docs/kidepik.md](../../docs/kidepik.md) §10, [docs/POC_LOCAL.md](../../docs/POC_LOCAL.md)

## Objetivo

Validar en local (emulador Android) que la app móvil puede hablar con las **tres capas** del MVP producción, sin implementar funcionalidad de producto.

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
- App **Expo SDK 54** (React Native) con pantalla única que prueba las 3 integraciones.
- Documentación de URLs para **Expo Go** (IP LAN) y emulador Android (`10.0.2.2`).

### Excluido (fuera de POC)

- LangGraph, IA, lógica pedagógica, avatar, narrativa.
- Cloud Run real, Supabase cloud, R2 cloud.
- iOS, builds EAS, CI.

## Contratos

### FastAPI (`http://HOST:8080`)

| Ruta | Auth | Comportamiento |
| --- | --- | --- |
| `GET /health` | No | `{ "status": "ok", "service": "kidepik-api" }` |
| `GET /api/v1/architecture/status` | No | Estado de conexión a Postgres (vía env) y MinIO/R2 |
| `GET /api/v1/architecture/config` | No | URLs públicas para cliente (API, Supabase, storage) |
| `POST /api/v1/storage/presign-upload` | Bearer Supabase | Body `{ "filename": "..." }` → URL firmada PUT + URL pública lectura |

**Auth en FastAPI:** validación del access token vía `GET /auth/v1/user` de Supabase (compatible ES256/HS256). No decodificar JWT localmente con un solo algoritmo.

**Presigned URLs:** `upload_url` y `public_url` deben usar la **IP LAN del PC** en móvil físico (`S3_PUBLIC_BASE_URL` / `S3_EXTERNAL_ENDPOINT_URL` en `.env.poc`). `10.0.2.2` solo en emulador.

**Regla producción replicada:** FastAPI **no** hace proxy de binarios; solo devuelve URLs.

### Supabase local

- API: `http://HOST:54321`
- Auth: registro/login email+password de prueba.
- Tabla `public.poc_health` con fila `{ message: 'poc ready' }` — la app la lee vía cliente Supabase.

### Storage (MinIO ≈ R2)

- Bucket `kidepik-media`, credenciales en `.env` (no versionadas).
- Mismo cliente `boto3` que producción; cambia solo `endpoint_url` y credenciales.

## App móvil

- **Expo Go** (recomendado POC): `./scripts/poc-expo-go.ps1` — móvil físico, misma Wi‑Fi, IP LAN automática.
- Emulador Android (opcional): URLs con `10.0.2.2`, requiere Android SDK.

## Red — Expo Go (móvil físico)

Desde el móvil, el PC se alcanza por **IP LAN** (p. ej. `192.168.1.42`), no `localhost` ni `10.0.2.2`.

| Servicio | URL típica |
| --- | --- |
| FastAPI | `http://192.168.x.x:8080` |
| Supabase | `http://192.168.x.x:54321` |
| MinIO | `http://192.168.x.x:9000` |

El script `poc-expo-go.ps1` escribe `mobile/.env` y reinicia la API con presigned URLs hacia esa IP.

## Red — emulador Android (opcional)

Desde AVD, `localhost` del host = **`10.0.2.2`**.

| Servicio | URL emulador |
| --- | --- |
| FastAPI | `http://10.0.2.2:8080` |
| Supabase | `http://10.0.2.2:54321` |
| MinIO API | `http://10.0.2.2:9000` |

En dispositivo físico: sustituir por IP LAN del PC (documentado en README POC).

## Criterios de éxito

1. `scripts/poc-up.ps1` deja Supabase + API + MinIO en verde.
2. `GET /health` responde 200 desde host y desde el móvil (IP LAN).
3. App Expo Go: login Supabase OK + lectura `poc_health` OK + upload vía presign OK.
4. Tests backend (`pytest`) pasan en local.

**Resultado (jun 2026):** criterios 1–3 verificados con Expo Go en Android físico (misma Wi‑Fi).

## Estructura de archivos

```
kidepik/
  backend/           # FastAPI
  mobile/            # Expo app POC
  docker/            # compose.yaml (api + minio)
  supabase/          # config.toml + migrations
  scripts/           # poc-up.ps1, poc-down.ps1, poc-expo-go.ps1
  .env.poc.sample    # plantilla env Docker (copiar a .env.poc)
```
