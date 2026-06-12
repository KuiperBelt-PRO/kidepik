# Project Overview

Repositorio **kidepik** — producto en fase de arranque bajo la org GitHub `KuiperBelt-PRO`.

## Estado actual

- Ramas: `master` (release), `develop` (integración).
- Contenido inicial: `README.md` y documentación de agentes en `.cursor/`.
- Stack de aplicación: **por definir** en la primera spec de producto (`.cursor/specify/`).

## URLs locales (UI)

Documentar aquí la URL o puerto de desarrollo cuando exista runtime local (Docker Compose, `vite`, etc.). Hasta entonces, las pruebas de navegador MCP no aplican a rutas concretas de este repo.

## Documentación de agentes

Reglas Cursor, SDD y specs viven bajo `.cursor/`. Enlazar features maduras desde [CURRENT_SPECS.md](../CURRENT_SPECS.md).

## CodeGraph

Índice local en `.codegraph/` (gitignored). Inicializar o reindexar:

```powershell
codegraph init .
codegraph status .
```

El MCP `codegraph` del hub `Vibe-Coding` indexa por `projectPath` cuando el workspace multi-root está abierto. Hasta que exista código fuente (PHP, Python, TS, etc.), el índice puede estar vacío.
