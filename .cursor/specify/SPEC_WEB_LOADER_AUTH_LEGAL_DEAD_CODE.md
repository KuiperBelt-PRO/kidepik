# Spec: Limpieza de código muerto — Loader / Auth / Legal

**Estado:** P0+P1 implementados y verificados (jul 2026); P2–P3 pendientes  
**Ámbito:** `web/` (cliente), docs/specs obsoletas relacionadas.  
**Fuera de alcance:** motor procedural fantasy/space en uso, API PHP, Docker, migraciones SQL, `backend/` FastAPI (legacy separado).

## Objetivo

Reducir ruido para agentes de IA y mantenibilidad humana eliminando restos del POC galería/mockups y dead code en el flujo:

`#/loader` → auth embebido → `#/legal/{terminos|privacidad}` ↔ `#/loader` → `#/home` / `#/auth/callback`.

## Flujo activo (no tocar comportamiento)

| Ruta | Escena / montaje |
| --- | --- |
| `#/loader` | `loader-chrome` + gate + auth embebido |
| `#/legal/terminos`, `#/legal/privacidad` | `legal.js` + world-session/transition |
| `#/auth/callback` | OAuth Supabase |
| `#/home` | Placeholder post-login |
| `#/auth` | Tras P1: redirige a `#/loader` (auth standalone eliminado) |

## Inventario de candidatos

### P0 — Muerto seguro / assets / CSS galería

| Ítem | Motivo |
| --- | --- |
| `world-session`: `stashWorldLogo`, `consumeWorldLogo`, `isWorldSessionActive`, `handoffWorldLayers` | Exportados sin callers |
| `world-transition`: `flipFromRect` | Exportado sin callers |
| `theme.js`: `setThemeId`, `getLabels`, `getLoaderPhrases`, `THEME_LABELS`, `LOADER_PHRASES` | Solo `initTheme`/`getThemeId` en uso |
| Alias `@deprecated` `CRYSTAL_*` en `loader-fantasy-scene.js` | Alias no referenciados |
| `AUTH_COPY.legal` | Texto legal hardcodeado en HTML |
| Re-export de constantes desde `loader-gate.js` | Nadie importa desde ese módulo |
| Export público `parseWorldLayerQuery` | Solo uso interno |
| Slots manifest: `loader.bg.dual`, `loader.logo.alt`, `loader.particles.*`, `loader.ring` | Sin `assetUrl` en runtime |
| Fichero `loader-bg-dual.png`, `wordmark-ambigram-dark.png` | Solo referenciados por slots muertos |
| Slots accent fantasy/space (webp inexistentes) | Intentos de carga fallidos en silencio |
| Casi todo `css/components.css` (wordmark, theme-toggle, cards, mockups, poc-*) | Galería POC; ninguna escena actual usa esas clases |
| `.legal-body__title` en CSS | `markdown.js` no genera esa clase |

### P1 — Consolidación (comportamiento preservado)

| Ítem | Motivo / acción |
| --- | --- |
| `scenes/auth.js` + estilos `.scene-auth*` | Auth real es embebido en loader; `#/auth` solo en fallo OAuth → redirigir a `#/loader` |
| Duplicado `.auth-panel*` en `auth.css` vs `loader.css` | Una sola fuente en `loader.css`; `auth.css` queda para callback/home |
| `loader-fx-fantasy-palette.js` | Solo tests; runtime no lo importa → eliminar módulo + ajustar tests |
| Duplicación chrome ↔ `world-layers` (query parse, mount optional image, montaje fantasy/space) | Extraer helpers compartidos; legal sigue usando `mountWorldLayers` |

### P2 — Pulido (fase posterior, no en esta entrega)

| Ítem | Nota |
| --- | --- |
| Exports de `loader-world-arrows` solo usados en tests | Valorar API mínima pública |
| Query params `gateDemo` / `fantasyDev` / … | Documentar o concentrar en un módulo |
| Specs que aún citan `#/gallery` / `poc-web-dev` | Actualizar docs |

### P3 — Documentación / tooling

| Ítem | Nota |
| --- | --- |
| `scripts/poc-web-dev.ps1` stub | Ya deprecado |
| `web/package.json` scripts `serve` | Stack canónico es Docker |
| Comentario `mockup/:id` en `router.js` | Actualizar |

## Criterios de aceptación (P0+P1)

1. Suite `web` (`pnpm test` / `node --test tests/*.test.js`) verde.
2. Flujo feliz Playwright: loader → tap → auth → legal → volver a loader/auth.
3. Deep-link `#/auth` termina en loader (auth embebido o gate), no en escena standalone.
4. Sin regresiones visibles en capas fantasy/space ni en handoff legal.
5. No tocar API, Docker, migraciones ni motor procedural salvo eliminación de dead code listado.

## No eliminar

- Cadena fantasy/space procedural (castillo, bosque, cristales, portal, FX, naves…).
- `world-session` / `world-transition` (API viva salvo exports muertos).
- `legal.js`, `markdown.js`, `LegalController`, seeds legales.
- `auth-panel`, `loader-gate`, `loader-auth-morph`.
- Infra Docker / `api/` / `supabase/migrations/`.
