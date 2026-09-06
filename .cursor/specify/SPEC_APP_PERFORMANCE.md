# Spec: rendimiento global de la app (auditoría y mejoras sin pérdida de features)

> Estado: **parcialmente implementada** (ago 2026) — hechos puntos **2–4**; tier mundo (punto 1) **pospuesto**  
> Plan de ejecución: [tasks/PERFORMANCE_OPTIMIZATION_PLAN.md](../tasks/PERFORMANCE_OPTIMIZATION_PLAN.md)  
> Relaciona: [SPEC_WORLD_LAYERS_PERSISTENCE.md](SPEC_WORLD_LAYERS_PERSISTENCE.md), [SPEC_LOADER_FANTASY_ENGINE.md](SPEC_LOADER_FANTASY_ENGINE.md) §11, [SPEC_LOADER_FX_ENGINE.md](SPEC_LOADER_FX_ENGINE.md), [SPEC_APP_FILE_LOGGING.md](SPEC_APP_FILE_LOGGING.md), [SPEC_APP_VISUAL_DESIGN_V3.md](SPEC_APP_VISUAL_DESIGN_V3.md) §criterios Lighthouse, [SPEC_AI_JOURNEY_FILE_LEDGER.md](SPEC_AI_JOURNEY_FILE_LEDGER.md), [SPEC_APP_ADVENTURE_DIALOGUE_HISTORY.md](SPEC_APP_ADVENTURE_DIALOGUE_HISTORY.md)

## Objetivo

Reducir la **lentitud percibida y el coste de CPU/GPU/I/O** en el POC local (`:8082`) y en dispositivos móvil de referencia (**390×844**, iPhone 13 / DPR 3), **sin eliminar** capacidades de producto ya implementadas (mundo procedural persistente, play con LLM, logging de depuración, glass UI, historial paginado, etc.).

## Contexto del problema

Tras sesiones prolongadas en rutas autenticadas (tripulación, ajustes, play, cuenta), la app puede sentirse lenta en:

- scroll y pulsaciones en paneles glass;
- navegación entre secciones del shell;
- turnos de play (latencia servidor + UI);
- arranque y transiciones con el mundo animado detrás del marco.

La auditoría de código (ago 2026) identifica causas **acumulativas** en cliente, servidor y observabilidad — no un único bug.

## Principios (no negociables)

| Principio | Decisión |
| --- | --- |
| Mismo mundo visible | [SPEC_WORLD_LAYERS_PERSISTENCE](SPEC_WORLD_LAYERS_PERSISTENCE.md): **no** destruir ni regenerar capas al cambiar de ruta shell; optimizar con **tiers de runtime**, no con remount |
| Features intactas | LLM, ledger, historial, debug IA, toasts, equipaje, FX cristales/portales, meteoritos, etc. siguen disponibles |
| Degradación elegante | En modo `ambient` / `frozen` el mundo **sigue visible**; se reduce frecuencia de trabajo, no se sustituye por fondo estático salvo `prefers-reduced-motion` |
| Medir antes y después | Cada fase del plan incluye presupuesto y checklist de regresión (§6) |
| Local ≠ prod | El logging en disco es valioso en dev; en prod el coste debe ser acotado (ver delta en [SPEC_APP_FILE_LOGGING](SPEC_APP_FILE_LOGGING.md) §rendimiento) |

## Hallazgos de auditoría (priorizados)

### P0 — Cliente: mundo procedural siempre activo

**Síntoma:** CPU/GPU elevados en `#/crew`, `#/settings`, `#/account`, `#/play/…` y legal compacto, no solo en loader/home expandido.

**Causa:**

- `isWorldRouteHash()` incluye la mayoría de rutas shell; las capas persisten con todos los suscriptores al bucle unificado `subscribeLoaderAnimationFrame` (nubes, celestiales, órbita, meteoritos, bosques build/erode, FX anclados, naves).
- `compactSection` / `is-world-band-legal` **solo** ajustan CSS (overflow, bandas); **no** pausan ni reducen el trabajo del runtime procedural.
- Play también monta `mountLoaderChrome({ compactSection: true })` con el mismo mundo detrás.

**Archivos clave:** `web/js/lib/world-session.js`, `web/js/components/world-layers.js`, `web/js/components/loader-fantasy-scene.js`, `loader-fantasy-render.js`, `loader-fx-render.js`, `loader-space-orbit.js`, `loader-meteor-shower.js`, `loader-fantasy-clouds.js`, `loader-fantasy-celestial.js`.

**Dirección de mejora:** introducir **tiers de runtime del mundo** (§3.1) coordinados con `shouldCompressWorldBands()` y `document.visibilityState`.

---

### P0 — Cliente: observadores globales en cascada

**Síntoma:** Cada burbuja de play, fila de tripulación o toast dispara trabajo de layout sincronizado.

**Causas:**

1. **`watchNoSpellcheck(document.documentElement)`** en `main.js` — `MutationObserver` con `{ subtree: true }` sobre **todo** el documento. `section-frame.js` ya monta otro observer local; el global es redundante y costoso.
2. **`shell-frame.js`** — `MutationObserver` en `#app` `{ childList: true }` llama a `scheduleShellFrameSync()` (hasta **tres** `requestAnimationFrame` + `getBoundingClientRect`) en **cada** mutación de hijos de `#app`.
3. **`loader-logo-mask.js`** — `ResizeObserver` en escena + focal + `resize`; cada tick hace `querySelectorAll` de 4 capas y `getBoundingClientRect` por capa.

**Dirección:** debounce/coalesce (p. ej. 1 rAF por frame), acotar alcance de observers, eliminar duplicados.

---

### P1 — Observabilidad: logging síncrono en caliente

**Síntoma:** En local con `LOG_TO_FILES=true` y/o `APP_DEBUG_AI=true`, la app se degrada con el uso (más requests, más JSONL).

**Causas (backend `app/logging_/AppLogger`):**

- `open()` + `write()` + `close()` **por cada línea** de log.
- `get_settings()` y `mkdir` en cada evento.
- Middleware HTTP registra **todos** los requests en canal `api` (incl. estáticos, health, ingest de logs del cliente).

**Causas (cliente `app-logger.js`):**

- `flush` cada 2 s con `getValidSession()` (import dinámico de Supabase).
- Listener global de `click` en fase capture cuando el umbral efectivo es `debug` (`APP_DEBUG_AI` activo en tutor).

**Dirección:** buffer por canal, flush periódico/async, muestreo de `http_request` en local, caché de sesión para ingest, documentar perfil «debug sin penalizar UI».

---

### P1 — Backend: lecturas repetidas del ledger JSONL

**Síntoma:** Turnos de play y resolución de capítulo/caminos más lentos conforme crece `events.jsonl`.

**Causa:** `JourneyLedger.read_events()` lee **todo** el fichero, parsea cada línea, ordena por `seq` y solo entonces aplica `limit` (cola). `dialogue.py` invoca `read_events` / `_ledger_events_for_session` **múltiples veces** por flujo (≥4–11 puntos en el mismo servicio).

**Archivos:** `backend/app/ai/journey/ledger.py`, `backend/app/services/dialogue.py`.

**Dirección:** lectura tail O(1) con offset/índice, memoización por request en `DialogueService`, límites explícitos en llamadas que solo necesitan el último `path_pack` / progreso.

---

### P2 — Cliente: play y paneles con DOM pesado

**Síntoma:** Scroll del diálogo y render de historial se vuelven pesados con muchas burbujas.

**Causas:**

- `play.js`: `innerHTML` / reconstrucción de nodos; `logEl.innerHTML = ""` al recargar; `renderDialogueMarkdown` por burbuja sin reutilización.
- Múltiples capas `backdrop-filter: blur()` (shell, section-frame, glass, toast) compiten en GPU.
- `crew-panel.js`: plantillas grandes con `innerHTML` en listas y pestañas.

**Dirección:** nodos incrementales, `content-visibility: auto` en burbujas antiguas, evitar full clear del log, revisar blur en bandas compactas (mantener legibilidad).

---

### P2 — Boot y red

**Síntoma:** Primera carga y cambios de ruta algo lentos.

**Causas:**

- Seis familias Google Fonts en `index.html` (bloqueo de render).
- Todo el CSS de producto cargado en el primer paint (aceptable en POC; optimizable).
- `initAppLogger` hace `fetch` a `/architecture/config` en cada cold start.

**Dirección:** subset de fuentes / `font-display: swap`, diferir CSS no crítico si no rompe FOUC, cachear config de logging en `sessionStorage` con TTL corto.

---

### P3 — Backend: round-trips SQL en play

**Síntoma:** Latencia base en `open_session` / `submit_turn` antes del LLM.

**Causa:** Varias consultas secuenciales (`_child`, sesión, `max(sequence)`, `_last_mentor`, `_recent`, `_history`, baggage…) sin batching.

**Dirección:** consolidar lecturas en una pasada donde sea seguro; **no** refactorizar el monolito `dialogue.py` en esta iniciativa salvo memoización/ledger acotado.

---

## Contrato propuesto: tiers de runtime del mundo

### 3.1 Niveles

| Tier | Cuándo | Comportamiento mínimo |
| --- | --- | --- |
| `full` | Loader/home expandido (`!shouldCompressWorldBands`) | Comportamiento actual: spawn/erode/FX a presupuesto SPEC_LOADER_* |
| `ambient` | Rutas compactas shell + play (`shouldCompressWorldBands`) | Mismo DOM y estado procedural; **reducir** frecuencia de ticks (p. ej. 30→15 fps efectivos), pausar spawn de nuevos elementos fantasy, FX a presupuesto reducido, meteoritos/órbita a cadencia menor |
| `frozen` | Pestaña oculta (`document.hidden`) o drawer shell abierto >300 ms (opcional fase 2) | Pausar bucle unificado (ya parcial en `loader-animation-frame.js`); mantener último frame pintado |

API viva propuesta en `web/js/lib/world-runtime-tier.js` (nuevo):

```js
export function getWorldRuntimeTier() { /* full | ambient | frozen */ }
export function setWorldRuntimeTier(tier) { /* notifica suscriptores */ }
export function subscribeWorldRuntimeTier(fn) { /* unsubscribe */ }
```

Los módulos que usan `subscribeLoaderAnimationFrame` consultan el tier en `tick` y **retornan pronto** si `frozen`, o acumulan `dt` en `ambient` para no ejecutar cada frame.

### 3.2 Criterios de aceptación (mundo)

1. Loader → home expandido: **sin** cambio visual respecto al comportamiento actual (tier `full`).
2. Home → tripulación compacta: mismo paisaje visible detrás del marco; **sin** salto ni regeneración; CPU mediana ≤ **−40 %** vs baseline en 60 s de idle (perfil §6).
3. Play con mundo compacto: animación de fondo perceptible pero menos costosa; turnos y scroll del log no empeoran.
4. Cambiar de pestaña del navegador: animación se detiene (`frozen`); al volver, retoma en ≤1 s sin glitch.
5. `prefers-reduced-motion: reduce` sigue mandando sobre tiers (estático / fade).

---

## Contrato propuesto: observadores y layout

| Cambio | Regla |
| --- | --- |
| Spellcheck | **Eliminar** observer global en `main.js`; mantener solo `watchNoSpellcheck` en raíz de `section-frame` / paneles con inputs |
| Shell frame | Coalescer `scheduleShellFrameSync` a **un** rAF; ignorar mutaciones si el shell no está montado |
| Logo mask | Debounce 100 ms; no recalcular si `getBoundingClientRect` del focal no cambió >1 px |

**Criterio:** en play, escribir 10 mensajes seguidos no debe disparar >**15** lecturas de layout del shell por segundo (medición `performance.measure` o contador de test).

---

## Contrato propuesto: logging (delta sobre SPEC_APP_FILE_LOGGING)

| Área | Mejora |
| --- | --- |
| Backend | Buffer en memoria por canal (tamaño o tiempo configurable); flush async; reutilizar handle de fichero por día |
| HTTP | En `APP_ENV=local`, muestrear `http_request` success 2xx estáticos/media (p. ej. 1 de cada 20) salvo status ≥400 |
| Debug IA | Con `APP_DEBUG_AI=true`, **no** bajar automáticamente el umbral del canal `client` a `debug` (solo `api`/`ai`/`compose`) |
| Cliente | Caché de token 60 s para flush; no llamar `getValidSession` si el batch solo tiene `info` y no hay token en memoria |

**Criterio:** con logging activo, tiempo p95 de `GET /api/v1/health` ≤ **50 ms** en local (sin LLM).

---

## Contrato propuesto: ledger

| Mejora | Detalle |
| --- | --- |
| Tail read | Si `limit` está definido, leer desde el final del fichero sin cargar líneas antiguas innecesarias |
| Índice opcional | `events.idx.json` con `line_offset` por bloques de seq (fase 2 si tail no basta) |
| Memo request | `DialogueService` guarda `_events_cache` invalidado al `append_event` de la misma sesión |

**Criterio:** sesión de prueba con `events.jsonl` de **5 000** líneas: `_ledger_events_for_session` ≤ **50 ms** p95 en contenedor `api` (sin LLM).

---

## Contrato propuesto: play UI

| Mejora | Detalle |
| --- | --- |
| Burbujas | Append incremental; no `logEl.innerHTML = ""` salvo reset explícito |
| Historial | `content-visibility: auto` + altura mínima en burbujas fuera del viewport |
| Markdown | Cache por `turn_id` + hash de texto |

**Criterio:** historial de **48** burbujas visibles: scroll de log fluido (sin long tasks > **50 ms** en 10 scrolls consecutivos en perfil §6).

---

## Presupuestos de rendimiento (referencia)

| Superficie | Métrica | Objetivo post-optimización |
| --- | --- | --- |
| Cliente idle (crew compacto, 60 s) | Main thread busy | ≤ **25 %** mediana (Performance panel) |
| Cliente | Long tasks (>50 ms) | ≤ **2** por minuto en navegación shell sin play |
| Play | Tiempo hasta pintar burbuja explorador tras respuesta API | ≤ **100 ms** client-side (excl. red/LLM) |
| API | `open_session` sin LLM | p95 ≤ **300 ms** |
| API | `submit_turn` sin LLM (fase placement local) | p95 ≤ **400 ms** |
| Lighthouse (build estático optimizado) | Performance | ≥ **85** ([SPEC_APP_VISUAL_DESIGN_V3](SPEC_APP_VISUAL_DESIGN_V3.md)) |

---

## Validación y no regresión

### Perfil de medición

- Viewport **390×844**, DPR 3 (Playwright MCP o Electron preview).
- Stack: `./scripts/poc-up.ps1`, `http://localhost:8082`.
- Flujos obligatorios:
  1. Loader → auth local / sesión → home → crew → ficha → play (1 turno) → volver.
  2. Legal compacto → volver sin salto de mundo.
  3. Play: cargar historial (botón «Ver anteriores») con sesión seed si existe.
  4. `APP_DEBUG_AI=true` + navegación shell 2 min (comprobar que UI sigue usable).

### Tests automatizados (añadir con la implementación)

| Área | Tipo |
| --- | --- |
| `world-runtime-tier` | Unit JS: transiciones full↔ambient↔frozen |
| `ledger.read_events` tail | Unit pytest con fichero grande sintético |
| `AppLogger` buffer | Unit pytest: no abre fichero por línea |
| E2E smoke | Playwright: mismos screenshots de handoff mundo que baseline (tolerancia visual acotada) |

Capturas en `tmp/playwright-output/` únicamente.

---

## Fuera de alcance (esta iniciativa)

- Sustituir el motor procedural por vídeo/Rive ([SPEC_APP_VISUAL_DESIGN_V3](SPEC_APP_VISUAL_DESIGN_V3.md) roadmap).
- Partir `dialogue.py` en microservicios.
- CDN / code-splitting agresivo del bundle (fase posterior).
- Reducir calidad pedagógica del LLM o eliminar paralelismo de compose ([SPEC_APP_PATH_COMPOSER_PARALLEL_REUSE](SPEC_APP_PATH_COMPOSER_PARALLEL_REUSE.md)).

---

## Aprobación

- [x] Usuario aprueba hallazgos; **implementar ahora** puntos 2 (observers), 3 (logging), 4 (ledger).
- [ ] **Pospuesto:** tiers de runtime del mundo (punto 1) — sin cambios de código hasta nueva decisión.
- [x] Usuario aprueba deltas de logging (muestreo local + buffer).
- [x] Plan acotado en [PERFORMANCE_OPTIMIZATION_PLAN.md](../tasks/PERFORMANCE_OPTIMIZATION_PLAN.md) (fases 2–3 de observers/logging/ledger).
