# Project Overview

Repositorio **kidepik** — producto en fase de arranque bajo la org GitHub `KuiperBelt-PRO`.

## Estado actual

- Ramas: `master` (release), `develop` (integración).
- **Pivot POC (jul 2026):** PHP + DreamHost (prod) + Docker local (dev) + Supabase + media en `web/media/` — ver [specify/SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md](../specify/SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md).
- **Cliente producto:** `web/` (HTML/CSS/JS). Capacitor para tiendas en fase posterior.
- **Backend POC:** `api/` + `shared/` (PHP). `backend/` FastAPI = legacy, no extender.
- POC FastAPI histórica: [specify/SPEC_POC_LOCAL_ARCHITECTURE.md](../specify/SPEC_POC_LOCAL_ARCHITECTURE.md) (supersedida).

## URLs locales (POC Docker)

| Servicio | Host (PC) | Notas |
| --- | --- | --- |
| **App (web + API PHP)** | `http://localhost:8082` | nginx Docker — **única URL de producto** |
| Media | `http://localhost:8082/media/...` | Ficheros en `web/media/` |
| Supabase API | `http://localhost:54321` | Contenedores vía `supabase start` |

Arranque: `./scripts/poc-up.ps1` · Preview móvil PC: `./scripts/poc-web-preview.ps1` · Electron viewport 390×844.

**No usar:** `poc-web-dev.ps1` (deprecado), `localhost:8080` (FastAPI legacy), MinIO `:9000` (descartado MVP).

## Documentación de agentes

Reglas Cursor, SDD y specs viven bajo `.cursor/`. Enlazar features maduras desde [CURRENT_SPECS.md](../CURRENT_SPECS.md).

## CodeGraph

Índice local en `.codegraph/` (gitignored). Inicializar o reindexar:

```powershell
codegraph init .
codegraph status .
```

El MCP `codegraph` del hub `Vibe-Coding` indexa por `projectPath` cuando el workspace multi-root está abierto.
