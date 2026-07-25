# Current Specs

## Bootstrap del repositorio

- Estructura `.cursor/` alineada con el resto del workspace KuiperbeltPRO (2026-06).
- Spec de arranque: [specify/REPO_BOOTSTRAP_SPEC.md](specify/REPO_BOOTSTRAP_SPEC.md).

## Producto

- Visión y stack: [docs/kidepik.md](../docs/kidepik.md) (documento maestro).
- **Pivot POC PHP + DreamHost (jul 2026):**
  - Arquitectura POC: [specify/SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md](specify/SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md) — PHP + Supabase + media local; hosting DreamHost.
  - Docker local (única vía dev): [specify/SPEC_POC_DOCKER_LOCAL_DEV.md](specify/SPEC_POC_DOCKER_LOCAL_DEV.md) — nginx + php-fpm, hot reload, puerto **8082**.
  - Backend PHP: [specify/SPEC_PHP_BACKEND_ARCHITECTURE.md](specify/SPEC_PHP_BACKEND_ARCHITECTURE.md) — estructura, contratos, hoja de ruta RAG.
  - **Media (filesystem local, migrable a R2):** [specify/SPEC_MEDIA_STORAGE.md](specify/SPEC_MEDIA_STORAGE.md) — `web/media/`, `StorageDriver`, sin Cloudflare en MVP.
  - MVP hosting: [specify/SPEC_HOSTING_FREE_TIER_STACK.md](specify/SPEC_HOSTING_FREE_TIER_STACK.md) — DreamHost + Supabase (actualizada jul 2026).
- **POC local FastAPI (histórica, superseded):** [specify/SPEC_POC_LOCAL_ARCHITECTURE.md](specify/SPEC_POC_LOCAL_ARCHITECTURE.md).
- **Pivot frontend web-first (implementado jun 2026):** [specify/SPEC_WEB_FRONTEND_ARCHITECTURE.md](specify/SPEC_WEB_FRONTEND_ARCHITECTURE.md) — `web/` HTML/CSS/JS, puerto **8082**.
- **Sistema visual v3 web premium (dirección de arte; galería/mockups = futuro post-MVP):** [specify/SPEC_APP_VISUAL_DESIGN_V3.md](specify/SPEC_APP_VISUAL_DESIGN_V3.md)
- **Pantalla Loader (splash + world procedural):** [specify/SPEC_LOADER_SCREEN.md](specify/SPEC_LOADER_SCREEN.md) — runtime jul 2026; prompts IA (archivo histórico de assets): [specify/LOADER_SCREEN_AI_PROMPTS.md](specify/LOADER_SCREEN_AI_PROMPTS.md)
- **Loader → App / Auth (puerta de entrada):** [specify/SPEC_LOADER_APP_GATE.md](specify/SPEC_LOADER_APP_GATE.md) — **aprobada** jul 2026; hint **0,5 s** post-100 %, morph in-place; `#/auth` ≡ loader (sin escena auth standalone)
- **Limpieza dead code loader/auth/legal (P0–P3 hecha jul 2026):** [specify/SPEC_WEB_LOADER_AUTH_LEGAL_DEAD_CODE.md](specify/SPEC_WEB_LOADER_AUTH_LEGAL_DEAD_CODE.md) — plan [tasks/LOADER_AUTH_LEGAL_DEAD_CODE_CLEANUP.md](tasks/LOADER_AUTH_LEGAL_DEAD_CODE_CLEANUP.md)
- **Auth cuenta padre/tutor (Supabase):** [specify/SPEC_APP_AUTH.md](specify/SPEC_APP_AUTH.md) — **aprobada** jul 2026; Google solamente en MVP; panel embebido en loader
- **Migraciones PHP + documentos legales:** [specify/SPEC_PHP_DB_MIGRATIONS_AND_LEGAL.md](specify/SPEC_PHP_DB_MIGRATIONS_AND_LEGAL.md) — **aprobada** jul 2026; auto-apply en bootstrap, historial compartido con Supabase, Términos/Privacidad versionados
- **Loader — lluvia de meteoritos (franja superior):** [specify/SPEC_LOADER_METEOR_SHOWER.md](specify/SPEC_LOADER_METEOR_SHOWER.md) — implementada jun 2026
- **Loader — terreno fantasía (base inferior):** [specify/SPEC_LOADER_FANTASY_TERRAIN.md](specify/SPEC_LOADER_FANTASY_TERRAIN.md) — implementada jun 2026
- **Loader — motor de elementos de fantasía:** arquitectura del motor procedural (castillos, aldeas, torres, bosques, cristales, megalitos, portales) con construcción progresiva y erosión.
  - Motor: [specify/SPEC_LOADER_FANTASY_ENGINE.md](specify/SPEC_LOADER_FANTASY_ENGINE.md)
  - Castillos y palacios (primer builder): [specify/SPEC_LOADER_FANTASY_CASTLE.md](specify/SPEC_LOADER_FANTASY_CASTLE.md)
  - Acantilados y rocas en bordes: [specify/SPEC_LOADER_FANTASY_CLIFFS.md](specify/SPEC_LOADER_FANTASY_CLIFFS.md)
  - **Nubes de cielo (mitad fantasía):** [specify/SPEC_LOADER_FANTASY_CLOUDS.md](specify/SPEC_LOADER_FANTASY_CLOUDS.md) — implementada jul 2026
  - **Sol, luna y constelaciones:** [specify/SPEC_LOADER_FANTASY_CELESTIAL.md](specify/SPEC_LOADER_FANTASY_CELESTIAL.md) — implementada jul 2026
  - **Bosques y árboles:** [specify/SPEC_LOADER_FANTASY_FOREST.md](specify/SPEC_LOADER_FANTASY_FOREST.md) — implementada jul 2026
  - **Horizonte de fondo (montañas / colinas):** [specify/SPEC_LOADER_FANTASY_BACKDROP.md](specify/SPEC_LOADER_FANTASY_BACKDROP.md) — implementada jul 2026
  - **Diseño por grafos (castillos por facción):** [specify/ELEMENTS_ENGINE_SPECS.md](specify/ELEMENTS_ENGINE_SPECS.md) — fuente de verdad para implementación futura humano/enano/elfo
  - Facciones temáticas: [specify/SPEC_LOADER_FANTASY_CASTLE_FACTIONS.md](specify/SPEC_LOADER_FANTASY_CASTLE_FACTIONS.md)
  - Catálogo del resto de tipos: [specify/SPEC_LOADER_FANTASY_ELEMENTS_CATALOG.md](specify/SPEC_LOADER_FANTASY_ELEMENTS_CATALOG.md)
  - **Megalitos (menhir, dolmen, círculo):** [specify/SPEC_LOADER_FANTASY_MEGALITH.md](specify/SPEC_LOADER_FANTASY_MEGALITH.md) — propuesta jul 2026 (Fase 4)
  - **Cristales mágicos:** [specify/SPEC_LOADER_FANTASY_CRYSTALS.md](specify/SPEC_LOADER_FANTASY_CRYSTALS.md) — implementada jul 2026 (Fase 6)
  - **Portales mágicos:** [specify/SPEC_LOADER_FANTASY_PORTAL.md](specify/SPEC_LOADER_FANTASY_PORTAL.md) — dolmen, arco románico, anillo circular + FX (jul 2026, Fase 7)
  - Plan de ejecución por fases: [tasks/LOADER_FANTASY_ENGINE_EXECUTION_PLAN.md](tasks/LOADER_FANTASY_ENGINE_EXECUTION_PLAN.md)
- **Loader — motor FX anclado (implementado jul 2026):** efectos mágicos / sci-fi sobre hosts procedurales (cristales como piloto), sincronizados con ciclo de vida build/hold/erode.
  - Arquitectura: [specify/SPEC_LOADER_FX_ENGINE.md](specify/SPEC_LOADER_FX_ENGINE.md)
  - Piloto cristales: [specify/SPEC_LOADER_FX_CRYSTALS_MAGIC.md](specify/SPEC_LOADER_FX_CRYSTALS_MAGIC.md)
  - Plan: [tasks/LOADER_FX_EXECUTION_PLAN.md](tasks/LOADER_FX_EXECUTION_PLAN.md)
- **Preview dev móvil:** [specify/SPEC_WEB_DEV_PREVIEW.md](specify/SPEC_WEB_DEV_PREVIEW.md) — Electron 390×844 + Playwright.
- **Capacitor shell (fase posterior):** [specify/SPEC_CAPACITOR_MOBILE_SHELL.md](specify/SPEC_CAPACITOR_MOBILE_SHELL.md).
- **Plan de ejecución pivot:** [tasks/WEB_FRONTEND_PIVOT_EXECUTION_PLAN.md](tasks/WEB_FRONTEND_PIVOT_EXECUTION_PLAN.md).

## Infraestructura Oracle Cloud (en pausa — no MVP activo jul 2026)

Validar VM ARM Oracle + operar MCP. **MVP hosting activo:** DreamHost PHP + Supabase + media local — [specify/SPEC_HOSTING_FREE_TIER_STACK.md](specify/SPEC_HOSTING_FREE_TIER_STACK.md).

**Estado OCI:** MCP OK; launch ARM `OUT_OF_CAPACITY` en MAD. **Estado MVP:** DreamHost PHP + Supabase + `web/media/`; sin Cloudflare R2 en MVP.

| Spec | Descripción |
| --- | --- |
| [specify/SPEC_HOSTING_FREE_TIER_STACK.md](specify/SPEC_HOSTING_FREE_TIER_STACK.md) | **MVP activo:** DreamHost PHP, Supabase, media local |
| [specify/SPEC_MEDIA_STORAGE.md](specify/SPEC_MEDIA_STORAGE.md) | Driver local + migración futura R2 |
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
