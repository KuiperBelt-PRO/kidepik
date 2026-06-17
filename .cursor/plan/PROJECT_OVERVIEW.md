# Project Overview

Repositorio **kidepik** — producto en fase de arranque bajo la org GitHub `KuiperBelt-PRO`.

## Estado actual

- Ramas: `master` (release), `develop` (integración).
- **POC local validada** (jun 2026): FastAPI + Supabase CLI + MinIO (R2) — ver [docs/POC_LOCAL.md](../../docs/POC_LOCAL.md).
- **Cliente producto:** `web/` (HTML/CSS/JS). Capacitor para tiendas en fase posterior.
- Spec: [.cursor/specify/SPEC_POC_LOCAL_ARCHITECTURE.md](../specify/SPEC_POC_LOCAL_ARCHITECTURE.md).

## URLs locales (POC)

| Servicio | Host (PC) | Cliente web (PC / agentes) |
| --- | --- | --- |
| App | — | `http://localhost:8082` |
| FastAPI | `http://localhost:8080` | `http://localhost:8080` |
| Supabase API | `http://localhost:54321` | `http://localhost:54321` |
| MinIO (R2 sim) | `http://localhost:9000` · consola `:9001` | igual |

Arranque backend: `./scripts/poc-up.ps1` · App web: `./scripts/poc-web-dev.ps1` · Preview móvil PC: `./scripts/poc-web-preview.ps1` · Electron viewport 390×844.

## Documentación de agentes

Reglas Cursor, SDD y specs viven bajo `.cursor/`. Enlazar features maduras desde [CURRENT_SPECS.md](../CURRENT_SPECS.md).

## CodeGraph

Índice local en `.codegraph/` (gitignored). Inicializar o reindexar:

```powershell
codegraph init .
codegraph status .
```

El MCP `codegraph` del hub `Vibe-Coding` indexa por `projectPath` cuando el workspace multi-root está abierto. Hasta que exista código fuente (PHP, Python, TS, etc.), el índice puede estar vacío.
