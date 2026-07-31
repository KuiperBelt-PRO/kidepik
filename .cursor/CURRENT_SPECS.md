# Current Specs

## Bootstrap del repositorio

- Estructura `.cursor/` alineada con el resto del workspace KuiperbeltPRO (2026-06).
- Spec de arranque: [specify/REPO_BOOTSTRAP_SPEC.md](specify/REPO_BOOTSTRAP_SPEC.md).
- **Diagramas Mermaid para agentes (jul 2026):** [diagrams/README.md](diagrams/README.md) — mapa de sistema, repo, runtime, API, datos, front, rutas, mundo, loader/auth, tutor, aventura (contrato), media, validación y árbol de decisión.

## Producto

- Visión y stack: [docs/kidepik.md](../docs/kidepik.md) (documento maestro).
- **Pivot POC PHP + DreamHost (jul 2026):**
  - Arquitectura POC: [specify/SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md](specify/SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md) — PHP + Supabase + media local; hosting DreamHost.
  - Docker local (única vía dev): [specify/SPEC_POC_DOCKER_LOCAL_DEV.md](specify/SPEC_POC_DOCKER_LOCAL_DEV.md) — nginx + php-fpm, hot reload, puerto **8082**.
  - Backend PHP: [specify/SPEC_PHP_BACKEND_ARCHITECTURE.md](specify/SPEC_PHP_BACKEND_ARCHITECTURE.md) — estructura, contratos, hoja de ruta RAG.
  - **Media (filesystem local):** [specify/SPEC_MEDIA_STORAGE.md](specify/SPEC_MEDIA_STORAGE.md) — solo `web/media/` / `STORAGE_DRIVER=local`.
  - MVP hosting: [specify/SPEC_HOSTING_FREE_TIER_STACK.md](specify/SPEC_HOSTING_FREE_TIER_STACK.md) — DreamHost + Supabase (sin R2/OCI/Cloud Run).
- **POC FastAPI histórico (descartado):** [specify/SPEC_POC_LOCAL_ARCHITECTURE.md](specify/SPEC_POC_LOCAL_ARCHITECTURE.md) — aviso; no implementar.
- **Pivot frontend web-first (implementado jun 2026):** [specify/SPEC_WEB_FRONTEND_ARCHITECTURE.md](specify/SPEC_WEB_FRONTEND_ARCHITECTURE.md) — `web/` HTML/CSS/JS, puerto **8082**.
- **Sistema visual v3 web premium (dirección de arte; galería/mockups = futuro post-MVP):** [specify/SPEC_APP_VISUAL_DESIGN_V3.md](specify/SPEC_APP_VISUAL_DESIGN_V3.md)
- **Pantalla Loader (splash + world procedural):** [specify/SPEC_LOADER_SCREEN.md](specify/SPEC_LOADER_SCREEN.md) — runtime jul 2026; prompts IA (archivo histórico de assets): [specify/LOADER_SCREEN_AI_PROMPTS.md](specify/LOADER_SCREEN_AI_PROMPTS.md)
- **Loader → App / Auth (puerta de entrada):** [specify/SPEC_LOADER_APP_GATE.md](specify/SPEC_LOADER_APP_GATE.md) — **aprobada** jul 2026; hint **0,5 s** post-100 %, morph in-place; `#/auth` ≡ loader (sin escena auth standalone)
- **Persistencia capas mundo (fantasía + sci-fi):** [specify/SPEC_WORLD_LAYERS_PERSISTENCE.md](specify/SPEC_WORLD_LAYERS_PERSISTENCE.md) — **aprobada** jul 2026; misma instancia DOM entre loader, home, auth y legal; sin `?v=` divergente en singletons
- **Limpieza dead code loader/auth/legal (P0–P3 hecha jul 2026):** [specify/SPEC_WEB_LOADER_AUTH_LEGAL_DEAD_CODE.md](specify/SPEC_WEB_LOADER_AUTH_LEGAL_DEAD_CODE.md) — plan [tasks/LOADER_AUTH_LEGAL_DEAD_CODE_CLEANUP.md](tasks/LOADER_AUTH_LEGAL_DEAD_CODE_CLEANUP.md)
- **Auth cuenta padre/tutor (Supabase):** [specify/SPEC_APP_AUTH.md](specify/SPEC_APP_AUTH.md) — **aprobada** jul 2026; Google solamente en MVP; panel embebido en loader
- **Auth Google — spec de implementación:** [specify/SPEC_APP_AUTH_GOOGLE_IMPLEMENTATION.md](specify/SPEC_APP_AUTH_GOOGLE_IMPLEMENTATION.md) — **implementada** jul 2026; OAuth PKCE, config GCP/Supabase, `parent_accounts`, bootstrap API, tests; plan [tasks/APP_AUTH_GOOGLE_IMPLEMENTATION_PLAN.md](tasks/APP_AUTH_GOOGLE_IMPLEMENTATION_PLAN.md)
- **Shell post-login (chrome global):** [specify/SPEC_APP_SHELL_CHROME.md](specify/SPEC_APP_SHELL_CHROME.md) — **aprobada** jul 2026; FABs glass (menú / tema sci-fi↔fantasía / cuenta), drawer (Inicio, Tripulación, Legal, Ajustes, Cuenta, Cerrar sesión), tema UI padre ≠ tema mundo niño
- **Legal con sesión autenticada:** [specify/SPEC_LEGAL_AUTHENTICATED_SESSION.md](specify/SPEC_LEGAL_AUTHENTICATED_SESSION.md) — **aprobada** jul 2026; shell en Términos/Privacidad, vuelta a home sin cerrar sesión, tipografía según `uiTheme`
- **Marco de sección autenticada (bandas + glass):** [specify/SPEC_APP_SECTION_FRAME.md](specify/SPEC_APP_SECTION_FRAME.md) — **aprobada** jul 2026; bandas compactas en todas las rutas de gestión salvo home; marco glass + logo + scroll con fade
- **Sección Cuenta (padre/tutor):** [specify/SPEC_APP_ACCOUNT_SECTION.md](specify/SPEC_APP_ACCOUNT_SECTION.md) — **aprobada** jul 2026; datos Google, alias editable, eliminación con confirmación; depende del marco de sección
- **Sección Ajustes (tutor):** [specify/SPEC_APP_SETTINGS_SECTION.md](specify/SPEC_APP_SETTINGS_SECTION.md) — **aprobada** jul 2026; **Fase A gestión implementada** (tema, tipografía, defaults, resumen); `parent_accounts.settings` jsonb
- **Sección Tripulación (perfiles infantiles):** [specify/SPEC_APP_CREW_SECTION.md](specify/SPEC_APP_CREW_SECTION.md) — **aprobada** jul 2026; **Fase A gestión implementada** (plaza, lista, ficha, permisos); play/first-run pendiente
- **Fichas tripulación — cartas TCG:** [specify/SPEC_APP_CREW_MEMBER_CARDS.md](specify/SPEC_APP_CREW_MEMBER_CARDS.md) — **implementada** jul 2026; Fase A visual (lista + hero ficha)
- **Sistema IA play (aprobado jul 2026 — Fases A–E parciales):** plan [tasks/AI_ADVENTURE_SYSTEM_PLAN.md](tasks/AI_ADVENTURE_SYSTEM_PLAN.md); backlog [tasks/AI_ADVENTURE_BACKLOG.md](tasks/AI_ADVENTURE_BACKLOG.md)
  - Gateway OpenRouter **solo free** + discovery/ranking: [specify/SPEC_AI_OPENROUTER_GATEWAY.md](specify/SPEC_AI_OPENROUTER_GATEWAY.md) — **Fase A** (`shared/Ai/`, discovery en `AiGateway`)
  - Orquestación / mentor / age bands / memoria: [SPEC_AI_PLAY_ORCHESTRATION](specify/SPEC_AI_PLAY_ORCHESTRATION.md), [SPEC_APP_MENTOR](specify/SPEC_APP_MENTOR.md), [SPEC_APP_AGE_BANDS](specify/SPEC_APP_AGE_BANDS.md), [SPEC_APP_JOURNEY_MEMORY](specify/SPEC_APP_JOURNEY_MEMORY.md) — **parcial** (context pack L2/L3 + summarizer + summary + timeline tutor)
  - Diálogo API + UI `#/play/:childId`: **section-frame + mundo animado + glass** ([DESIGN.md](DESIGN.md))
  - Placement: [SPEC_APP_PLACEMENT_EXAM](specify/SPEC_APP_PLACEMENT_EXAM.md) — banco + rewrite opcional
  - Adventure: [SPEC_APP_ADVENTURE_SESSION](specify/SPEC_APP_ADVENTURE_SESSION.md) — vertical slice zona/reto
  - Timeline tutor: `GET …/journey/timeline` + «Diario del viaje» en ficha crew
- **Diálogo de aventura (IA):** [specify/SPEC_APP_ADVENTURE_DIALOGUE.md](specify/SPEC_APP_ADVENTURE_DIALOGUE.md) — **contrato** jul 2026; enlazado a orquestación/gateway
- **Primer acceso a la aventura:** [specify/SPEC_APP_PLAY_FIRST_RUN.md](specify/SPEC_APP_PLAY_FIRST_RUN.md) — **contrato** + delta `choose_character`
- **Rangos de progresión (sci-fi / fantasía):** [specify/SPEC_APP_PROGRESSION_RANKS.md](specify/SPEC_APP_PROGRESSION_RANKS.md) — **marco** jul 2026; catálogo provisional 5 tiers
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
- **Tests CI:** [specify/SPEC_DEV_TEST_CI.md](specify/SPEC_DEV_TEST_CI.md) — PHPUnit + Node + Playwright E2E, cobertura ≥90% JS.
- **Auth local Playwright:** [specify/SPEC_DEV_LOCAL_AUTH_PLAYWRIGHT.md](specify/SPEC_DEV_LOCAL_AUTH_PLAYWRIGHT.md) — **implementada** jul 2026; sesión tutor sin Google OAuth (solo dev).
- **Capacitor shell (fase posterior):** [specify/SPEC_CAPACITOR_MOBILE_SHELL.md](specify/SPEC_CAPACITOR_MOBILE_SHELL.md).
- **Plan de ejecución pivot:** [tasks/WEB_FRONTEND_PIVOT_EXECUTION_PLAN.md](tasks/WEB_FRONTEND_PIVOT_EXECUTION_PLAN.md).

## Hosting (canónico)

**Producción:** DreamHost PHP + Supabase + media local — [specify/SPEC_HOSTING_FREE_TIER_STACK.md](specify/SPEC_HOSTING_FREE_TIER_STACK.md).

**Descartado (no reabrir sin decisión explícita):** Cloudflare R2, FastAPI/`backend/`, MinIO, Oracle OCI Always Free, GCP Cloud Run como hosting de API.

**Secretos locales (no versionados):** `kidepik/.secrets/` — plantillas en `kidepik/.secrets.sample/` (GCP OAuth; **OpenRouter** `openrouter.env.sample`).

---

Añadir filas a este índice cuando una feature tenga spec en `.cursor/specify/`.
