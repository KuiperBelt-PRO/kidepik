# POC local — arranque, URLs y cliente web

> **Estado:** ago 2026 — FastAPI + Docker nginx (`:8082`) + Supabase CLI.

Ver specs: [.cursor/specify/SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md](../.cursor/specify/SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md), [.cursor/specify/SPEC_POC_DOCKER_LOCAL_DEV.md](../.cursor/specify/SPEC_POC_DOCKER_LOCAL_DEV.md)

## Requisitos

- Docker Desktop
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) o `pnpm dlx supabase`

## Arranque

```powershell
cd kidepik
./scripts/poc-up.ps1
```

| Servicio | URL |
| --- | --- |
| **App (web + API FastAPI)** | `http://localhost:8082` |
| API health | `http://localhost:8082/api/v1/health` |
| Media | `http://localhost:8082/media/` |
| Supabase API | `http://localhost:54321` |

Preview móvil PC (Electron 390×844):

```powershell
./scripts/poc-web-preview.ps1
```

## Config del cliente

`scripts/poc-up.ps1` genera `web/js/config.js` con rutas relativas (`apiUrl: "/api/v1"`).

## Tests API (pytest en contenedor)

```powershell
docker compose --env-file .env.poc -f docker/compose.yaml exec api pytest -q
```

## Parar

```powershell
./scripts/poc-down.ps1
```

## Estructura POC

```
api/          # Backend PHP
shared/       # StorageDriver local, Config
web/          # Cliente + web/media/
docker/       # compose.yaml (nginx + php)
supabase/
scripts/      # poc-up, poc-down, poc-web-preview
```

Archivos locales no versionados: `.env.poc`, `web/js/config.js`, `web/media/**` (salvo `.gitkeep`), `tmp/`.
