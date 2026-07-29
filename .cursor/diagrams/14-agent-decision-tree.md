# 14 — Árbol de decisión para agentes

```mermaid
flowchart TB
  Q[¿Qué pide el usuario?] --> Prod{¿Feature producto kidepik?}
  Prod -->|sí| SDD[Leer spec-driven-dev-kidepik\n+ skill hub SDD]
  Prod -->|UI web observable| WebPrev[web-mobile-preview +\ndiagramas 06-10]
  Prod -->|API/DB| BE[diagramas 04-05 +\nspecify PHP/migrations]
  Prod -->|Solo commit/push| Git[Vibe-Coding git-workflow]
  Prod -->|Review sin implementar| Review[code-review hub]
  Prod -->|Orientación rápida| Diag[Este .cursor/diagrams/]
```

## Matriz rápida

| Pedido | Leer primero | Diagramas |
| --- | --- | --- |
| Loader / gate / auth Google | SPEC_LOADER_APP_GATE, SPEC_APP_AUTH* | 08, 09 |
| Shell / drawer / FABs | SPEC_APP_SHELL_CHROME | 07, 10 |
| Cuenta / ajustes / crew | SPEC_APP_*_SECTION | 10, 05 |
| Play / examen / diálogo | SPEC_APP_PLAY_* / DIALOGUE / SESSION | 11 (contrato) |
| Ruta API nueva | SPEC_PHP_BACKEND + Router.php | 04 |
| Migración SQL | supabase/migrations + MigrationRunner | 05, 03 |
| Media / upload | SPEC_MEDIA_STORAGE | 12 |
| Docker / puerto | SPEC_POC_DOCKER_LOCAL_DEV | 03 |
| Diseño controles tutor | DESIGN.md | 06, 10 |
| Codegraph desfasado | `codegraph index .` en kidepik | README |

## Precedencia documental

1. Spec aprobada en `.cursor/specify/`  
2. Código actual (`web/`, `api/`) si la spec dice “implementada”  
3. Diagramas (mapa, no contrato)  
4. Engram (decisiones previas)

## Anti-errores globales

- URL producto = `:8082`.
- Stack = PHP + Supabase + `web/media/` — **no** FastAPI, R2, MinIO, OCI, Cloud Run.
- No inventar `#/play` como ya implementado.
- MCP codegraph del hub ≠ índice kidepik salvo root correcto.
