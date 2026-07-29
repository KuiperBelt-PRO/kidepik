# Project Overview

Repositorio **kidepik** — producto en fase de arranque bajo la org GitHub `KuiperBelt-PRO`.

## Estado actual

- Ramas: `master` (release), `develop` (integración).
- **Stack canónico:** PHP + DreamHost (prod) + Docker local (dev) + Supabase + media en `web/media/` — [specify/SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md](../specify/SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md).
- **Cliente producto:** `web/` (HTML/CSS/JS). Capacitor para tiendas en fase posterior.
- **Backend:** `api/` + `shared/` (PHP). Sin FastAPI, R2, MinIO, OCI ni Cloud Run como parte del producto.

## URLs locales (POC Docker)

| Servicio | Host (PC) | Notas |
| --- | --- | --- |
| **App (web + API PHP)** | `http://localhost:8082` | nginx Docker — **única URL de producto** |
| Media | `http://localhost:8082/media/...` | Ficheros en `web/media/` |
| Supabase API | `http://localhost:54321` | Contenedores vía `supabase start` |

Arranque: `./scripts/poc-up.ps1` · Preview móvil PC: `./scripts/poc-web-preview.ps1` · Electron viewport 390×844.

## Documentación de agentes

Reglas Cursor, SDD y specs viven bajo `.cursor/`. Enlazar features maduras desde [CURRENT_SPECS.md](../CURRENT_SPECS.md).

**Mapas Mermaid (orientación rápida):** [.cursor/diagrams/README.md](../diagrams/README.md) — no sustituyen specs; reducen errores de agentes (puertos, flujos).

## CodeGraph

Índice local en `.codegraph/` (gitignored), **por repo**. Inicializar o reindexar desde la raíz de **kidepik**:

```powershell
codegraph init .          # solo la primera vez
codegraph index .         # reindex completo (usar tras gaps grandes)
codegraph sync .          # incremental
codegraph status .        # debe listar web/, api/, shared/ (PHP+JS)
```

El MCP `codegraph` del hub `Vibe-Coding` puede estar anclado a otro root del workspace multi-root; no asumir que refleja kidepik. Confirmar con `codegraph status .` en este directorio.
