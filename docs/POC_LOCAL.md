# POC local — arranque, URLs y app móvil

> **Estado:** validada (junio 2026) — tres integraciones en verde con Expo Go en Android físico.

Ver spec: [.cursor/specify/SPEC_POC_LOCAL_ARCHITECTURE.md](../.cursor/specify/SPEC_POC_LOCAL_ARCHITECTURE.md)

## Requisitos

- Docker Desktop
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) o `pnpm dlx supabase`
- Node.js 20+ y pnpm
- Móvil Android/iOS con **[Expo Go](https://expo.dev/go)** (SDK 54 compatible)
- PC y móvil en la **misma Wi‑Fi**

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

## App móvil con Expo Go (móvil físico)

Un solo comando detecta tu IP LAN, escribe `mobile/.env`, reinicia la API con URLs LAN para MinIO y abre Metro:

```powershell
./scripts/poc-expo-go.ps1
```

## Expo Web (PC y agentes Cursor) — recomendado para desarrollo UI

Navegador local, capturas MCP / Playwright, sin Wi‑Fi ni QR:

```powershell
./scripts/poc-expo-web.ps1
```

Abre **`http://localhost:8081`** (loader → galería). Con POC arquitectura:

```powershell
./scripts/poc-expo-web.ps1 -Backend
```

Capturas de agentes: `tmp/playwright-output/`. Spec: [.cursor/specify/SPEC_EXPO_WEB_LOCAL_PREVIEW.md](../.cursor/specify/SPEC_EXPO_WEB_LOCAL_PREVIEW.md).

### Expo Go — pasos tras `poc-expo-go.ps1`

1. Instala **Expo Go** en el móvil ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779)).
2. Escanea el QR: se abre `tmp/expo-go-qr.png` y también aparece ASCII en la terminal.
3. En la app, pulsa **Ejecutar pruebas de arquitectura**.

Deben quedar en verde: FastAPI, Supabase (`poc_health`) y MinIO/R2 (presigned upload).

### Notas técnicas

- **Expo SDK 54** — alineado con la versión actual de Expo Go.
- **JWT Supabase (ES256):** el backend valida tokens llamando a `GET /auth/v1/user`, no decodificando JWT en local.
- **Presigned MinIO:** en móvil físico, `.env.poc` debe usar la **IP LAN** (`S3_PUBLIC_BASE_URL`, `S3_EXTERNAL_ENDPOINT_URL`). `10.0.2.2` solo funciona en emulador.
- **`http://localhost:8081`** en el PC muestra el manifiesto JSON de Metro; no indica error.
- Publishable key local: `supabase status` → `Publishable` (copiar a `mobile/.env`).

### Si falla la conexión

- Comprueba en el navegador del móvil: `http://<IP-LAN-PC>:8080/health`
- Firewall Windows: permite **Node.js** y puertos **8080, 54321, 9000, 8081** en red privada.
- Misma Wi‑Fi (no datos móviles).
- Redes distintas: `cd mobile; pnpm start --tunnel` (más lento).

### Manual (sin script)

```powershell
# Sustituye 192.168.x.x por la IP de tu PC
cd mobile
Copy-Item .env.sample .env
# Editar .env con IP LAN en las tres URLs + publishable key (supabase status)
pnpm install
pnpm start --lan
```

## Emulador Android (opcional)

Requiere Android Studio + SDK. Usar URLs `10.0.2.2` en `mobile/.env` y `pnpm android`.

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
mobile/      # Expo SDK 54
scripts/     # poc-up, poc-down, poc-expo-go
supabase/    # config + migraciones
.env.poc.sample
```

Archivos locales no versionados: `.env.poc`, `mobile/.env`, `tmp/`, `supabase/.temp/`, `mobile/.expo/`.
