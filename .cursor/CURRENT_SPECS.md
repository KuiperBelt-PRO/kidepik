# Current Specs

## Bootstrap del repositorio

- Estructura `.cursor/` alineada con el resto del workspace KuiperbeltPRO (2026-06).
- Spec de arranque: [specify/REPO_BOOTSTRAP_SPEC.md](specify/REPO_BOOTSTRAP_SPEC.md).
- **Diagramas Mermaid para agentes (jul 2026 + ago 2026):** [diagrams/README.md](diagrams/README.md) — mapa de sistema, repo, runtime, API, datos, front, rutas, mundo, loader/auth, tutor, aventura, media, validación, árbol Cursor, **orquestador IA (15)**, **mecánicas viaje (16)**, **storage (17)**, **mundos paralelos (18)**.

## Producto

- Visión y stack: [docs/kidepik.md](../docs/kidepik.md) (documento maestro).
- **Backend FastAPI (ago 2026 — migración cerrada):** [specify/SPEC_FASTAPI_BACKEND_MIGRATION.md](specify/SPEC_FASTAPI_BACKEND_MIGRATION.md) — nginx `:8082`: **toda** `/api/v1/*` → FastAPI; `api/` y `shared/` PHP retirados del repo.
- **Capas de datos (aprobada ago 2026):** [specify/SPEC_DATA_STORAGE_LAYERS.md](specify/SPEC_DATA_STORAGE_LAYERS.md) — Supabase = producto; archivos = viaje/examen; DuckDB = tools; sin PlacementBank; `traveler.md` sustituye `child_traits`.
- **Mecánicas de viaje (aprobada ago 2026):** [specify/SPEC_APP_JOURNEY_MECHANICS.md](specify/SPEC_APP_JOURNEY_MECHANICS.md) — flujos espera / first-run / prueba / caminos / rangos.
- **Orquestador central (aprobada ago 2026 — cableado en play):** [specify/SPEC_AI_CENTRAL_ORCHESTRATOR.md](specify/SPEC_AI_CENTRAL_ORCHESTRATOR.md) — subagentes desde `.md` + tools.
- **Glosarios mundo (aprobada — seed + tool):** [specify/SPEC_APP_WORLD_GLOSSARY.md](specify/SPEC_APP_WORLD_GLOSSARY.md) — JSONL + DuckDB `glossary_search`.
- **Glosario en capas y composición (aprobada ago 2026 — implementada):** [specify/SPEC_APP_GLOSSARY_LAYERED_COMPOSITION.md](specify/SPEC_APP_GLOSSARY_LAYERED_COMPOSITION.md) — ingredientes L1 + referencias L2; `glossary_compose`; flag `GLOSSARY_COMPOSE_ENABLED`.
- **Frases de espera (JSONL — implementado):** [specify/SPEC_APP_WAITING_PHRASES.md](specify/SPEC_APP_WAITING_PHRASES.md) — `data/waiting/*.jsonl`; rotación 8 s; **no** PG.
- **Backlog UI/mecánicas (aprobado — en curso):** [specify/SPEC_APP_PRODUCT_BACKLOG_AGO2026.md](specify/SPEC_APP_PRODUCT_BACKLOG_AGO2026.md) — ficha 3 tabs, PIN, informes, play polish; **sin** Parquet/ETL.
- Plan: [tasks/PRODUCT_BACKLOG_AGO2026_PLAN.md](tasks/PRODUCT_BACKLOG_AGO2026_PLAN.md)
- **Mundos en paralelo (aprobada — ledger worlds/ + child_world_progress):** [specify/SPEC_APP_PARALLEL_WORLDS.md](specify/SPEC_APP_PARALLEL_WORLDS.md) — fantasy + sci-fi por viajero.
- **Vocabulario canónico (aprobada — PlacementBank eliminado):** [specify/SPEC_APP_CANONICAL_VOCABULARY.md](specify/SPEC_APP_CANONICAL_VOCABULARY.md) — AgeBand + SubjectCatalog; `ProgressionRanks`.
- Plan corte (**sprint cerrado**): [tasks/DATA_ORCHESTRATOR_IMPLEMENTATION_PLAN.md](tasks/DATA_ORCHESTRATOR_IMPLEMENTATION_PLAN.md)
- **IA agentic FastAPI (canónica):** Gemini free + Pydantic AI + skills + ledger `data/journey/` (`dialogue.jsonl`, `summary.md`, `traveler.md`). Plan: [tasks/AI_FASTAPI_AGENTIC_PLAN.md](tasks/AI_FASTAPI_AGENTIC_PLAN.md).
  - Gateway: [specify/SPEC_AI_GEMINI_GATEWAY.md](specify/SPEC_AI_GEMINI_GATEWAY.md)
  - Agentes / roles: [specify/SPEC_AI_PYDANTIC_AGENTS.md](specify/SPEC_AI_PYDANTIC_AGENTS.md)
  - Skills: [specify/SPEC_AI_AGENT_SKILLS.md](specify/SPEC_AI_AGENT_SKILLS.md)
  - Ledger: [specify/SPEC_AI_JOURNEY_FILE_LEDGER.md](specify/SPEC_AI_JOURNEY_FILE_LEDGER.md)
  - Semántica L1/L2/L3: [SPEC_APP_JOURNEY_MEMORY](specify/SPEC_APP_JOURNEY_MEMORY.md)
- **Stack POC local (canónico):**
  - Docker local (única vía dev): [specify/SPEC_POC_DOCKER_LOCAL_DEV.md](specify/SPEC_POC_DOCKER_LOCAL_DEV.md) — nginx + FastAPI (`api`), hot reload, puerto **8082**.
  - **Media (filesystem local):** [specify/SPEC_MEDIA_STORAGE.md](specify/SPEC_MEDIA_STORAGE.md) — solo `web/media/` / `STORAGE_DRIVER=local`.
  - MVP hosting prod: [specify/SPEC_HOSTING_FREE_TIER_STACK.md](specify/SPEC_HOSTING_FREE_TIER_STACK.md) — **pendiente revisión** (DreamHost PHP vs FastAPI en VPS/PaaS).
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
- **Marco de sección autenticada (bandas + glass):** [specify/SPEC_APP_SECTION_FRAME.md](specify/SPEC_APP_SECTION_FRAME.md) — **aprobada** jul 2026; bandas compactas en gestión salvo home; marco glass + título fijo (§2.4c) + skeleton logo (§2.4d) + scroll con fade; **§2.2c por proporción**: paisaje siempre tope; retrato completo hasta ratio ≥ 4/5 (`#app` full-bleed)
- **Sección Cuenta (padre/tutor):** [specify/SPEC_APP_ACCOUNT_SECTION.md](specify/SPEC_APP_ACCOUNT_SECTION.md) — **aprobada** jul 2026; datos Google, alias editable, eliminación con confirmación; depende del marco de sección
- **Sección Ajustes (tutor):** [specify/SPEC_APP_SETTINGS_SECTION.md](specify/SPEC_APP_SETTINGS_SECTION.md) — **aprobada** jul 2026; **Fase A gestión implementada** (tema, tipografía, defaults, resumen); `parent_accounts.settings` jsonb
- **Sección Tripulación (perfiles infantiles):** [specify/SPEC_APP_CREW_SECTION.md](specify/SPEC_APP_CREW_SECTION.md) — **aprobada** jul 2026; Fase A implementada
- **Ficha tripulante v2 (propuesta ago 2026):** [specify/SPEC_APP_CREW_MEMBER_DETAIL.md](specify/SPEC_APP_CREW_MEMBER_DETAIL.md), [specify/SPEC_APP_CREW_PROGRESS.md](specify/SPEC_APP_CREW_PROGRESS.md), [specify/SPEC_APP_CREW_MEMBER_SETTINGS.md](specify/SPEC_APP_CREW_MEMBER_SETTINGS.md)
- **Ficha tripulante v2 (propuesta ago 2026):** [specify/SPEC_APP_CREW_MEMBER_DETAIL.md](specify/SPEC_APP_CREW_MEMBER_DETAIL.md) (pestañas Viaje/Ajustes), [specify/SPEC_APP_CREW_PROGRESS.md](specify/SPEC_APP_CREW_PROGRESS.md) (niveles y barras tutor), [specify/SPEC_APP_CREW_MEMBER_SETTINGS.md](specify/SPEC_APP_CREW_MEMBER_SETTINGS.md)
- **Fichas tripulación — cartas TCG:** [specify/SPEC_APP_CREW_MEMBER_CARDS.md](specify/SPEC_APP_CREW_MEMBER_CARDS.md) — **implementada** jul 2026; Fase A visual (lista + hero ficha)
- **Sistema IA play (aprobado jul 2026 — Fases A–E parciales):** plan [tasks/AI_ADVENTURE_SYSTEM_PLAN.md](tasks/AI_ADVENTURE_SYSTEM_PLAN.md); backlog [tasks/AI_ADVENTURE_BACKLOG.md](tasks/AI_ADVENTURE_BACKLOG.md)
  - Gateway Gemini (canónico): [specify/SPEC_AI_GEMINI_GATEWAY.md](specify/SPEC_AI_GEMINI_GATEWAY.md) — Pydantic AI + Google AI Studio
  - Orquestación / mentor / age bands / memoria: [SPEC_AI_PLAY_ORCHESTRATION](specify/SPEC_AI_PLAY_ORCHESTRATION.md), [SPEC_APP_MENTOR](specify/SPEC_APP_MENTOR.md), [SPEC_APP_AGE_BANDS](specify/SPEC_APP_AGE_BANDS.md), [SPEC_APP_JOURNEY_MEMORY](specify/SPEC_APP_JOURNEY_MEMORY.md) — **parcial** (context pack L2/L3 + summarizer + summary + timeline tutor); **§1.4 orden diario implementada** (ago 2026); mentor: **El Guía** pre-mundo + nombres completos + markdown en burbujas (ago 2026)
  - **Capítulos del viaje (implementada ago 2026):** [specify/SPEC_APP_JOURNEY_CHAPTERS.md](specify/SPEC_APP_JOURNEY_CHAPTERS.md) — umbral → rito → aventura; rótulo fijo bajo logo; API `chapter`; catálogo por mundo + título LLM del camino
  - Diálogo API + UI `#/play/:childId`: **section-frame + mundo animado + glass** ([DESIGN.md](DESIGN.md)); **cajetín más alto** ([SPEC_APP_SECTION_FRAME](specify/SPEC_APP_SECTION_FRAME.md) §2.2b) + claridad de input
  - Placement: [SPEC_APP_PLACEMENT_EXAM](specify/SPEC_APP_PLACEMENT_EXAM.md) — **deprecada** (persistencia JSONL; ver JOURNEY_MECHANICS + DATA_STORAGE_LAYERS)
  - Adventure: [SPEC_APP_ADVENTURE_SESSION](specify/SPEC_APP_ADVENTURE_SESSION.md) — vertical slice zona/reto
  - **Riqueza narrativa del viaje (implementada parcialmente ago 2026):** [specify/SPEC_APP_ADVENTURE_STORY_RICHNESS.md](specify/SPEC_APP_ADVENTURE_STORY_RICHNESS.md) — pitches de zona, arco multi-reto (3), planificador anti-hueco, dificultad alineada, cierres motivados
  - **Narrativa aventura por LLM (aprobada 2 ago 2026 — P0):** [specify/SPEC_APP_ADVENTURE_LLM_NARRATIVE.md](specify/SPEC_APP_ADVENTURE_LLM_NARRATIVE.md) — pitches variados, escenas/NPCs, retos vestidos, esperas servidor; **cero plantillas**; fallo → `compose_failed`; plan [tasks/AI_ADVENTURE_LLM_NARRATIVE_PLAN.md](tasks/AI_ADVENTURE_LLM_NARRATIVE_PLAN.md)
  - **Coherencia por zona + empaquetado de turnos (propuesta ago 2026):** [specify/SPEC_APP_ADVENTURE_ZONE_BIBLE.md](specify/SPEC_APP_ADVENTURE_ZONE_BIBLE.md), [specify/SPEC_APP_ADVENTURE_TURN_PACKAGING.md](specify/SPEC_APP_ADVENTURE_TURN_PACKAGING.md), [specify/SPEC_APP_MENTOR_PROSE_CLARITY.md](specify/SPEC_APP_MENTOR_PROSE_CLARITY.md) — biblia como constraint LLM; corrige bosque-en-espejos, 1 burbuja llegada, eco de descartadas, zonas superadas
  - Timeline tutor: `GET …/journey/timeline` + «Diario del viaje» en ficha crew
  - Canon zonas: [SPEC_APP_WORLD_JOURNEY_CANON](specify/SPEC_APP_WORLD_JOURNEY_CANON.md) — **delta §3.1 pitches** (ago 2026)
- **Diálogo de aventura (IA):** [specify/SPEC_APP_ADVENTURE_DIALOGUE.md](specify/SPEC_APP_ADVENTURE_DIALOGUE.md) — **implementada** jul 2026; toast, burbujas con icono, compose chat, tema por mundo
- **Historial paginado en play (scroll arriba):** [specify/SPEC_APP_ADVENTURE_DIALOGUE_HISTORY.md](specify/SPEC_APP_ADVENTURE_DIALOGUE_HISTORY.md) — **implementada** 2 ago 2026; botón explícito; copy aleatorio por mundo×banda; `GET …/dialogue/history`; `page_size` 24
- **Catálogo de materias (14 áreas):** [specify/SPEC_APP_SUBJECT_CATALOG.md](specify/SPEC_APP_SUBJECT_CATALOG.md) — **implementada** 31 jul 2026; `reading` separada; base por banda; activación por tripulante en ficha
- **Placement adaptativo + prosa mentor:** [specify/SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE.md](specify/SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE.md) — **implementada** 31 jul 2026; **A1** (1 ago 2026): examen solo agente, sin banco seed; castellano ES; fallo → reintento
  - Colas LLM por purpose en BD: `ai_purpose_model_queues` (legado OpenRouter; ver [SPEC_AI_GEMINI_GATEWAY](specify/SPEC_AI_GEMINI_GATEWAY.md)) — **B1**
  - **A2 (implementada 1 ago 2026):** compose en lotes paralelos (≤4 slots, concurrency 3, sticky winner) + priorización por éxito ([§A2](specify/SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE.md#a2--compose-paralelo-por-lotes--priorización-de-modelos-1-ago-2026)); gateway §4.6; copy espera sin «armar»/«examen», rotación ≥ 8 s, variantes por `age_band` + mundo
- **Modo debug IA (tutor / local):** [specify/SPEC_APP_DEBUG_MODE.md](specify/SPEC_APP_DEBUG_MODE.md) — **implementada** 1 ago 2026; traza de fallback OpenRouter + panel UI; delta gateway §9
- **Rebobinado de viaje en debug (implementada ago 2026):** [specify/SPEC_APP_DEBUG_JOURNEY_REWIND.md](specify/SPEC_APP_DEBUG_JOURNEY_REWIND.md) — icono ↺ en burbujas play; trunca turnos/ledger posteriores; solo tutor + local
- **Logs en disco (web/logs):** [specify/SPEC_APP_FILE_LOGGING.md](specify/SPEC_APP_FILE_LOGGING.md) — **implementada** 1 ago 2026; JSONL por canal/nivel; más detalle con `APP_DEBUG_AI`
- **Notificaciones glass:** [specify/SPEC_APP_GLASS_TOAST.md](specify/SPEC_APP_GLASS_TOAST.md) — **implementada** jul 2026; errores/warnings/success/info reutilizables
- **Modales glass:** [specify/SPEC_APP_GLASS_MODAL.md](specify/SPEC_APP_GLASS_MODAL.md) — **implementada** jul 2026; alerta y confirmación reutilizables; tripulación y cuenta
- **Primer acceso a la aventura:** [specify/SPEC_APP_PLAY_FIRST_RUN.md](specify/SPEC_APP_PLAY_FIRST_RUN.md) — **contrato** + delta `choose_character` + **`choose_gender`**
- **Sexo del explorador (implementada ago 2026):** [specify/SPEC_APP_EXPLORER_GENDER.md](specify/SPEC_APP_EXPLORER_GENDER.md) — paso `choose_gender` tras edad; binario POC; legacy→masculino; editable en ficha tutor
- **Rangos de progresión (sci-fi / fantasía):** [specify/SPEC_APP_PROGRESSION_RANKS.md](specify/SPEC_APP_PROGRESSION_RANKS.md) — **marco** jul 2026; catálogo provisional 5 tiers
- **Migraciones Supabase + documentos legales:** `supabase/migrations/` — Términos/Privacidad versionados en Postgres; bootstrap FastAPI aplica estado vía `GET /api/v1/migrations/status`
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
- **Tests CI:** [specify/SPEC_DEV_TEST_CI.md](specify/SPEC_DEV_TEST_CI.md) — pytest FastAPI + Node + Playwright E2E.
- **pytest FastAPI (fase 0 hecha):** [specify/SPEC_DEV_FASTAPI_PYTEST.md](specify/SPEC_DEV_FASTAPI_PYTEST.md) — conftest, markers, unit/contract, respx.
- **Auth local Playwright:** [specify/SPEC_DEV_LOCAL_AUTH_PLAYWRIGHT.md](specify/SPEC_DEV_LOCAL_AUTH_PLAYWRIGHT.md) — **implementada** jul 2026; sesión tutor sin Google OAuth (solo dev).
- **Capacitor shell (fase posterior):** [specify/SPEC_CAPACITOR_MOBILE_SHELL.md](specify/SPEC_CAPACITOR_MOBILE_SHELL.md).
- **Plan de ejecución pivot:** [tasks/WEB_FRONTEND_PIVOT_EXECUTION_PLAN.md](tasks/WEB_FRONTEND_PIVOT_EXECUTION_PLAN.md).

## Hosting

**Dev local (canónico):** Docker `:8082` + FastAPI + Supabase — [specify/SPEC_POC_DOCKER_LOCAL_DEV.md](specify/SPEC_POC_DOCKER_LOCAL_DEV.md).

**Producción:** pendiente de decisión — [specify/SPEC_HOSTING_FREE_TIER_STACK.md](specify/SPEC_HOSTING_FREE_TIER_STACK.md) (DreamHost PHP histórico vs FastAPI en VPS/PaaS).

**Descartado (no reabrir sin decisión explícita):** Cloudflare R2, MinIO, Oracle OCI Always Free, GCP Cloud Run como hosting de API.

**Secretos locales (no versionados):** `kidepik/.secrets/` — plantillas en `kidepik/.secrets.sample/` (GCP OAuth; **OpenRouter** `openrouter.env.sample`).

---

Añadir filas a este índice cuando una feature tenga spec en `.cursor/specify/`.
