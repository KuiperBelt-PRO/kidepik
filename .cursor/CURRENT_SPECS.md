# Current Specs

## Bootstrap del repositorio

- Estructura `.cursor/` alineada con el resto del workspace KuiperbeltPRO (2026-06).
- Spec de arranque: [specify/REPO_BOOTSTRAP_SPEC.md](specify/REPO_BOOTSTRAP_SPEC.md).

## Producto

- Visión y stack: [docs/kidepik.md](../docs/kidepik.md) (documento maestro).
- **POC local arquitectura (validada jun 2026):** [specify/SPEC_POC_LOCAL_ARCHITECTURE.md](specify/SPEC_POC_LOCAL_ARCHITECTURE.md) — FastAPI + Supabase local + MinIO (R2) + cliente `web/`.
- **Pivot frontend web-first (implementado jun 2026):** [specify/SPEC_WEB_FRONTEND_ARCHITECTURE.md](specify/SPEC_WEB_FRONTEND_ARCHITECTURE.md) — `web/` HTML/CSS/JS, puerto **8082**.
- **Sistema visual v3 web premium:** [specify/SPEC_APP_VISUAL_DESIGN_V3.md](specify/SPEC_APP_VISUAL_DESIGN_V3.md)
- **Pantalla Loader (splash dual mundo):** [specify/SPEC_LOADER_SCREEN.md](specify/SPEC_LOADER_SCREEN.md) — implementada jun 2026; prompts IA: [specify/LOADER_SCREEN_AI_PROMPTS.md](specify/LOADER_SCREEN_AI_PROMPTS.md)
- **Loader — lluvia de meteoritos (franja superior):** [specify/SPEC_LOADER_METEOR_SHOWER.md](specify/SPEC_LOADER_METEOR_SHOWER.md) — implementada jun 2026
- **Loader — terreno fantasía (base inferior):** [specify/SPEC_LOADER_FANTASY_TERRAIN.md](specify/SPEC_LOADER_FANTASY_TERRAIN.md) — implementada jun 2026
- **Loader — motor de elementos de fantasía (propuesta jun 2026):** arquitectura del motor procedural (castillos, aldeas, torres, bosques, cristales, megalitos, portales) con construcción progresiva y erosión.
  - Motor: [specify/SPEC_LOADER_FANTASY_ENGINE.md](specify/SPEC_LOADER_FANTASY_ENGINE.md)
  - Castillos y palacios (primer builder): [specify/SPEC_LOADER_FANTASY_CASTLE.md](specify/SPEC_LOADER_FANTASY_CASTLE.md)
  - Acantilados y rocas en bordes: [specify/SPEC_LOADER_FANTASY_CLIFFS.md](specify/SPEC_LOADER_FANTASY_CLIFFS.md)
  - **Diseño por grafos (castillos por facción):** [specify/ELEMENTS_ENGINE_SPECS.md](specify/ELEMENTS_ENGINE_SPECS.md) — fuente de verdad para implementación futura humano/enano/elfo
  - Facciones temáticas: [specify/SPEC_LOADER_FANTASY_CASTLE_FACTIONS.md](specify/SPEC_LOADER_FANTASY_CASTLE_FACTIONS.md)
  - Catálogo del resto de tipos: [specify/SPEC_LOADER_FANTASY_ELEMENTS_CATALOG.md](specify/SPEC_LOADER_FANTASY_ELEMENTS_CATALOG.md)
  - Plan de ejecución por fases: [tasks/LOADER_FANTASY_ENGINE_EXECUTION_PLAN.md](tasks/LOADER_FANTASY_ENGINE_EXECUTION_PLAN.md)
- **Preview dev móvil:** [specify/SPEC_WEB_DEV_PREVIEW.md](specify/SPEC_WEB_DEV_PREVIEW.md) — Electron 390×844 + Playwright.
- **Capacitor shell (fase posterior):** [specify/SPEC_CAPACITOR_MOBILE_SHELL.md](specify/SPEC_CAPACITOR_MOBILE_SHELL.md).
- **Plan de ejecución pivot:** [tasks/WEB_FRONTEND_PIVOT_EXECUTION_PLAN.md](tasks/WEB_FRONTEND_PIVOT_EXECUTION_PLAN.md).

## Infraestructura Oracle Cloud (en curso)

Validar VM ARM Oracle + operar MCP. **MVP hosting:** [specify/SPEC_HOSTING_FREE_TIER_STACK.md](specify/SPEC_HOSTING_FREE_TIER_STACK.md) (Supabase + R2 + Cloud Run / Oracle Micro).

**Estado OCI:** MCP OK; launch ARM `OUT_OF_CAPACITY` en MAD. **Estado MVP:** stack free-tier documentado; compute backend TBD.

| Spec | Descripción |
| --- | --- |
| [specify/SPEC_HOSTING_FREE_TIER_STACK.md](specify/SPEC_HOSTING_FREE_TIER_STACK.md) | **MVP activo:** Supabase, R2, FastAPI, Cloud Run u Oracle Micro |
| [specify/SPEC_OCI_INFRA_ALWAYS_FREE.md](specify/SPEC_OCI_INFRA_ALWAYS_FREE.md) | North star: VM ARM 1 OCPU/6 GB en `eu-madrid-1` |
| [specify/SPEC_OCI_MCP_SERVER.md](specify/SPEC_OCI_MCP_SERVER.md) | Servidor MCP FastMCP + OCI SDK (`oci-kidepik`) |

| Operativa / skill | Uso |
| --- | --- |
| [operations/OCI_ALWAYS_FREE_VALIDATION.md](operations/OCI_ALWAYS_FREE_VALIDATION.md) | Checklist prerrequisitos, smoke test, resultado |
| [skills/oci-mcp-ops/SKILL.md](skills/oci-mcp-ops/SKILL.md) | Flujo agente para aprovisionar/validar OCI |

**Secretos locales (no versionados):** `kidepik/.secrets/` — plantillas en `kidepik/.secrets.sample/`.

**Auth OCI:** `oci.env` + `oci.config` en `.secrets/`.

**Pendiente:** par SSH en `.secrets/ssh/kidepik_oci`.

---

Añadir filas a este índice cuando una feature tenga spec en `.cursor/specify/`.
