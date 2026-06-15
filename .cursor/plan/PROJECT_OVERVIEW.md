# Project Overview

Repositorio **kidepik** — producto en fase de arranque bajo la org GitHub `KuiperBelt-PRO`.

## Estado actual

- Ramas: `master` (release), `develop` (integración).
- **POC local validada** (jun 2026): FastAPI + Supabase CLI + MinIO (R2) + Expo Go (SDK 54) — ver [docs/POC_LOCAL.md](../../docs/POC_LOCAL.md).
- Spec: [.cursor/specify/SPEC_POC_LOCAL_ARCHITECTURE.md](../specify/SPEC_POC_LOCAL_ARCHITECTURE.md).

## URLs locales (POC)

| Servicio | Host (PC) | Móvil físico (Expo Go) | Emulador Android |
| --- | --- | --- | --- |
| FastAPI | `http://localhost:8080` | `http://<IP-LAN>:8080` | `http://10.0.2.2:8080` |
| Supabase API | `http://localhost:54321` | `http://<IP-LAN>:54321` | `http://10.0.2.2:54321` |
| MinIO (R2 sim) | `http://localhost:9000` · consola `:9001` | `http://<IP-LAN>:9000` | `http://10.0.2.2:9000` |
| Expo Metro | — | `exp://<IP-LAN>:8081` | `exp://10.0.2.2:8081` |

Arranque backend: `./scripts/poc-up.ps1` · App móvil: `./scripts/poc-expo-go.ps1` (genera QR en `tmp/expo-go-qr.png`).

## Documentación de agentes

Reglas Cursor, SDD y specs viven bajo `.cursor/`. Enlazar features maduras desde [CURRENT_SPECS.md](../CURRENT_SPECS.md).

## CodeGraph

Índice local en `.codegraph/` (gitignored). Inicializar o reindexar:

```powershell
codegraph init .
codegraph status .
```

El MCP `codegraph` del hub `Vibe-Coding` indexa por `projectPath` cuando el workspace multi-root está abierto. Hasta que exista código fuente (PHP, Python, TS, etc.), el índice puede estar vacío.
