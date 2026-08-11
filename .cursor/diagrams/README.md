# Diagramas de orientación (agentes)

Mapa visual canónico de **KidepiK** para agentes de IA. No sustituye las specs: las **orienta**.

| Precedencia | Fuente |
| --- | --- |
| Contrato de producto | [`.cursor/specify/`](../specify/) + [CURRENT_SPECS.md](../CURRENT_SPECS.md) |
| Visión / pedagogía | [`docs/kidepik.md`](../../docs/kidepik.md) |
| Orientación rápida | **Esta carpeta** |
| Código indexado | `.codegraph/` local — `codegraph index .` desde la raíz de **kidepik** |

**Nota MCP:** el servidor `codegraph` del hub Vibe-Coding puede indexar otro root del workspace multi-root. Para kidepik, confiar en el índice local (`codegraph status .` → debe listar `web/`, `backend/`).

**Stack canónico (dev local):** Docker `:8082` + Supabase + FastAPI. Media: `web/media/`. Ledger: `data/journey/`.

## Orden de lectura sugerido

1. [01-system-context.md](01-system-context.md) — actores, hosting, límites MVP  
2. [02-repo-layout.md](02-repo-layout.md) — carpetas: qué tocar / qué no  
3. [03-runtime-local.md](03-runtime-local.md) — Docker, puertos, scripts  
4. [06-frontend-architecture.md](06-frontend-architecture.md) + [07-routing-navigation.md](07-routing-navigation.md)  
5. [09-loader-gate-auth.md](09-loader-gate-auth.md) — puerta de entrada  
6. Según la tarea: backend [04](04-backend-fastapi.md), datos [05](05-data-auth-model.md) + [17](17-storage-decision-tree.md), mundo [08](08-world-layers-themes.md) + [18](18-parallel-worlds.md), tutor [10](10-parent-surfaces.md), aventura [11](11-child-adventure-pipeline.md) + [16](16-journey-mechanics-flows.md), IA agentes [15](15-ai-orchestrator-agents.md), media [12](12-media-storage.md), tests [13](13-dev-test-validate.md)  
7. Siempre útil: [14-cursor-doc-routing.md](14-cursor-doc-routing.md)

## Inventario

| # | Fichero | Aspecto |
| --- | --- | --- |
| 01 | [01-system-context.md](01-system-context.md) | Contexto de sistema |
| 02 | [02-repo-layout.md](02-repo-layout.md) | Layout del repo |
| 03 | [03-runtime-local.md](03-runtime-local.md) | Runtime local |
| 04 | [04-backend-fastapi.md](04-backend-fastapi.md) | API FastAPI (routers, servicios) |
| 05 | [05-data-auth-model.md](05-data-auth-model.md) | Auth + modelo de datos |
| 06 | [06-frontend-architecture.md](06-frontend-architecture.md) | Cliente `web/` |
| 07 | [07-routing-navigation.md](07-routing-navigation.md) | Hash routes + shell |
| 08 | [08-world-layers-themes.md](08-world-layers-themes.md) | Mundo dual + temas UI |
| 09 | [09-loader-gate-auth.md](09-loader-gate-auth.md) | Loader → gate → Google |
| 10 | [10-parent-surfaces.md](10-parent-surfaces.md) | Cuenta / Ajustes / Tripulación / Legal |
| 11 | [11-child-adventure-pipeline.md](11-child-adventure-pipeline.md) | Play / examen / diálogo (mapa) |
| 12 | [12-media-storage.md](12-media-storage.md) | Media filesystem |
| 13 | [13-dev-test-validate.md](13-dev-test-validate.md) | Tests y validación UI |
| 14 | [14-cursor-doc-routing.md](14-cursor-doc-routing.md) | Qué skill/spec abrir (agente Cursor) |
| 15 | [15-ai-orchestrator-agents.md](15-ai-orchestrator-agents.md) | Orquestador + agentes play + decisión de rol |
| 16 | [16-journey-mechanics-flows.md](16-journey-mechanics-flows.md) | Flujos/decisiones mecánicas de viaje |
| 17 | [17-storage-decision-tree.md](17-storage-decision-tree.md) | Dónde guardar (PG / archivos / DuckDB) |
| 18 | [18-parallel-worlds.md](18-parallel-worlds.md) | Mundos fantasy/sci-fi en paralelo |
| 19 | [19-rewards-inventory.md](19-rewards-inventory.md) | Recompensas, moneda, equipaje, HUD nivel play |

## Convención de mantenimiento

Al cambiar un **contrato HTTP**, **ruta hash**, **tabla** o **flujo de entrada**, actualizar el diagrama enlazado y, si aplica, [CURRENT_SPECS.md](../CURRENT_SPECS.md).

Flujo completo (descubrimiento antes de proponer, cuándo crear vs ampliar, cierre por fase): [skills/spec-driven-dev-kidepik/SKILL.md](../skills/spec-driven-dev-kidepik/SKILL.md) § Inventario documental y § Mantenimiento vivo.

Detalle visual de controles glass (tutor): [DESIGN.md](../DESIGN.md) — no duplicado aquí.
