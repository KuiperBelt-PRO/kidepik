# Spec: Persistencia de capas del mundo (fantasía + ciencia ficción)

> Estado: **aprobada** (julio 2026)  
> Relacionado: [SPEC_LOADER_SCREEN.md](SPEC_LOADER_SCREEN.md), [SPEC_LOADER_APP_GATE.md](SPEC_LOADER_APP_GATE.md), [SPEC_WEB_LOADER_AUTH_LEGAL_DEAD_CODE.md](SPEC_WEB_LOADER_AUTH_LEGAL_DEAD_CODE.md)

## Objetivo

Las capas procedurales del **mundo dual** (fantasía en la mitad inferior, ciencia ficción en la superior: terreno, bosques, cristales, órbita, meteoritos, etc.) deben ser **las mismas instancias DOM y de runtime** durante toda la sesión de la app. No puede haber salto visual, reset ni regeneración al cambiar de sección.

## Alcance de rutas

La persistencia aplica en **cualquier ruta hash** que monte el escenario de mundo:

| Ruta | Escena |
| --- | --- |
| `#/loader` | Loader / puerta auth |
| `#/home` | Home autenticado (placeholder) |
| `#/auth`, `#/auth/callback` | Auth embebida / callback |
| `#/legal/terminos`, `#/legal/privacidad` | Legal |

Cualquier **nueva sección** que reutilice el fondo dual debe integrarse en este mismo handoff (no crear capas nuevas salvo cold start).

## Principios

| Principio | Decisión |
| --- | --- |
| Una sola sesión | `world-session.js` mantiene un único `session` con `layers`, flags de montaje y teardowns |
| Handoff, no remount | Al cambiar de ruta: `detachWorldLayers()` → nueva escena → `attachWorldLayersTo()` |
| Destruir solo al salir del mundo | `destroyWorldSession()` únicamente si la **siguiente** ruta no es de mundo (`isWorldRouteHash`) |
| Sin salto visual | Misma posición/estado procedural de elementos; transiciones solo de UI (logo, paneles, texto legal) |
| Cold start | Si no hay sesión (primera visita o tras `destroyWorldSession`), montar capas una vez y `registerWorldSession` |

## API viva (`web/js/lib/world-session.js`)

| Función | Uso |
| --- | --- |
| `registerWorldSession(state)` | Registrar tras primer montaje |
| `attachWorldLayersTo(scene)` | Reutilizar capas en nueva escena; devuelve `false` si no hay sesión |
| `detachWorldLayers()` | Quitar capas del DOM sin destruir efectos |
| `syncWorldSessionFromDom(scene)` | Sincronizar flags si el DOM ya tiene capas montadas |
| `destroyWorldSession()` | Teardown completo (logout fuera del mundo, cierre de app) |
| `isWorldRouteHash(hash?)` | Decide detach vs destroy en `destroy()` de escenas |

## Flujo entre escenas

```
Escena A destroy()
  ├─ isWorldRouteHash() === true  → sync + detachWorldLayers()
  └─ false                        → destroyWorldSession()

Escena B mount()
  ├─ attachWorldLayersTo(scene) === true  → reutilizar (sin remount)
  └─ false                                → createWorldLayersDom + mountWorldLayers + register
```

Implementado en:

- `web/js/components/loader-chrome.js` (`destroy`)
- `web/js/scenes/legal.js` (`destroy` + `renderLegal`)

## Regla crítica: imports ES module (singleton)

Los módulos con **estado en módulo** (`world-session.js`, `world-transition.js`) deben importarse con **la misma URL** en todo el grafo de dependencias.

**Prohibido** usar `?v=` distinto en imports internos de estos ficheros. En el navegador, `world-session.js?v=156` y `world-session.js?v=162` son **dos módulos distintos** con dos `session` independientes → la escena destino no ve las capas → remonta y produce salto visual.

| Módulo singleton | Import permitido |
| --- | --- |
| `world-session.js` | `from "../lib/world-session.js"` (sin query) |
| `world-transition.js` | `from "../lib/world-transition.js"` (sin query) |
| `world-layers.js` | Preferir sin query entre escenas que comparten sesión |

El **cache bust** (`?v=N`) solo en el entrypoint: `index.html` → `main.js?v=N`. No propagar versiones divergentes a singletons.

## Criterios de aceptación

1. Loader → Privacidad → Volver: mismos elementos de fantasía y espacio visibles, sin parpadeo ni regeneración.
2. Loader → Términos → loader: idem.
3. Loader → auth morph → legal (enlace pie): idem.
4. Home (logueado) → legal → home: idem.
5. Logout que vuelve a loader **fuera** del flujo mundo: puede destruir sesión; al reentrar se monta de nuevo (cold start aceptable).
6. Ningún import de `world-session.js` o `world-transition.js` lleva `?v=` distinto entre archivos.

## Verificación

- Playwright móvil 390×844: `http://localhost:8082`
- Flujo feliz: loader (esperar revelado) → enlace privacidad → volver
- Caso borde: legal → términos (cambio slug) sin remount de capas
- Consola: sin doble `.loader-layer--fantasy-scene` en el mismo `document`

## Anti-patrones

- Añadir `?v=` solo en un import de `world-session.js` al tocar otro fichero.
- Llamar `mountFantasyScene` / `mountSpaceOrbitLayer` si `attachWorldLayersTo` devolvió `true`.
- `destroyWorldSession()` en destroy de escena cuando el hash destino sigue siendo ruta de mundo.
