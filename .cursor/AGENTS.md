# .cursor

Guía operativa para agentes en `kidepik`.

## Reglas base

- Repositorio de producto **Kidepik** del ecosistema Kuiper Belt (org `KuiperBelt-PRO`).
- No incluir secretos en git.
- Mantener trazabilidad entre spec, tareas y cambios cuando el trabajo lo merezca.
- **Stack canónico (POC local):** FastAPI (`backend/`) + nginx Docker `:8082` + Supabase + media en `web/media/` + cliente `web/` HTML/CSS/JS.

## MCP: Context7 y Engram

- **Context7** (`context7` en el hub `Vibe-Coding`): documentación **actual** de librerías, frameworks, CLI y APIs públicas cuando la respuesta dependa de la referencia oficial. No sustituye a leer el código de este repo.
- **Engram** (si está activo en el IDE): memoria persistente por proyecto; conviene **buscar** antes de repetir diagnósticos largos y **guardar** decisiones reutilizables.
- **GitHub:** MCP `github-rest` del hub (`Vibe-Coding/.cursor/mcp.json`) para operaciones de repos y ramas.
- **Supabase:** MCP `supabase-kidepik` en `.cursor/mcp.json` de este repo.

## Documentación en `.cursor/`

| Documento | Uso |
| --- | --- |
| [SDD.md](SDD.md) | Fases Specify → Plan → Task → Implement → Validate. |
| [RULES.md](RULES.md) | Índice de `.cursor/rules/` de este repo y reglas generales en `Vibe-Coding`. |
| [skills/spec-driven-dev-kidepik/SKILL.md](skills/spec-driven-dev-kidepik/SKILL.md) | SDD/TDD **solo** en este repositorio. |
| [skills/web-mobile-preview/SKILL.md](skills/web-mobile-preview/SKILL.md) | Cliente **web** en PC (`localhost:8082`), Electron y Playwright móvil. |
| Git (commit, push, stage) | Hub: `Vibe-Coding/.cursor/skills/git-workflow/SKILL.md`. |
| [COMPANY.md](COMPANY.md) | Alineación de marca con Kuiper Belt. |
| [CURRENT_SPECS.md](CURRENT_SPECS.md) | Índice de specs vigentes y enlaces a `.cursor/specify/`. |
| [plan/PROJECT_OVERVIEW.md](plan/PROJECT_OVERVIEW.md) | Contexto del repo, stack y URLs locales. |
| [diagrams/README.md](diagrams/README.md) | Mapas Mermaid de orientación para agentes (stack, rutas, auth, mundo, tutor). |
| [specify/README.md](specify/README.md) | Convención para nuevas especificaciones. |
| [operations/README.md](operations/README.md) | Convención para flujos operativos reproducibles. |
| [operations/GOOGLE_OAUTH_LOCAL_SETUP.md](operations/GOOGLE_OAUTH_LOCAL_SETUP.md) | OAuth Google local (GCP client). |

Convenciones del repo (`README.md`, dependencias, CI) viven fuera de `.cursor/`; este fichero centra la navegación **dentro** de `.cursor/`.
