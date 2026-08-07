# 02 — Layout del repositorio

**Specs:** [PROJECT_OVERVIEW.md](../plan/PROJECT_OVERVIEW.md), [SPEC_WEB_FRONTEND_ARCHITECTURE.md](../specify/SPEC_WEB_FRONTEND_ARCHITECTURE.md), [SPEC_FASTAPI_BACKEND_MIGRATION.md](../specify/SPEC_FASTAPI_BACKEND_MIGRATION.md)

```mermaid
flowchart LR
  subgraph touch [Tocar en producto]
    web["web/ cliente"]
    backend["backend/ FastAPI"]
    data["data/ journey ledger"]
    supabase["supabase/ migrations"]
    docker["docker/ compose nginx+api"]
    scripts["scripts/ poc-up / preview"]
  end

  subgraph docs [Documentación agentes]
    cursor[".cursor/ specs skills rules"]
    diagrams[".cursor/diagrams/"]
    docsmd["docs/"]
  end

  subgraph later [Fase posterior / no MVP]
    mobile["mobile/ Capacitor futuro"]
    secrets[".secrets/ no git"]
  end
```

## Carpetas (hechos)

| Ruta | Rol |
| --- | --- |
| `web/` | Cliente producto: `index.html`, `css/`, `js/`, `media/`, `logs/` |
| `backend/` | FastAPI: `app/main.py`, routers, services, agents, pytest |
| `data/` | Ledger de viaje (`journey/`), glosarios JSONL, frases de espera |
| `supabase/` | Migraciones SQL + Auth/DB locales |
| `docker/` | `compose.yaml` nginx:8082 + servicio `api` (uvicorn) |
| `scripts/` | `poc-up.ps1`, `poc-down.ps1`, `poc-web-preview.ps1`, OAuth helpers |
| `tools/preview-electron/` | Shell Electron 390×844 |
| `.cursor/` | Specs, tasks, skills, rules, diagramas |
| `tmp/` | Salidas Playwright (gitignore) |

**Eliminado del repo (ago 2026):** `api/` PHP, `shared/` PHP, `docker/php/`, servicio php-fpm.

## Anti-errores

- No reintroducir PHP API, R2, MinIO u OCI sin decisión explícita del usuario.
- No meter capturas fuera de `tmp/playwright-output/`.
- Secretos solo en `.secrets/` / `.env.poc` (no versionar).
