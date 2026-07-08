# Spec: Motor de efectos FX (loader — fantasía y space opera)

> Estado: **propuesta** (jul 2026) — pendiente de aprobación del usuario  
> Relacionado: [SPEC_LOADER_SCREEN.md](SPEC_LOADER_SCREEN.md), [SPEC_LOADER_FANTASY_ENGINE.md](SPEC_LOADER_FANTASY_ENGINE.md), [SPEC_LOADER_METEOR_SHOWER.md](SPEC_LOADER_METEOR_SHOWER.md), [SPEC_APP_VISUAL_DESIGN_V3.md](SPEC_APP_VISUAL_DESIGN_V3.md)  
> Piloto v1: [SPEC_LOADER_FX_CRYSTALS_MAGIC.md](SPEC_LOADER_FX_CRYSTALS_MAGIC.md)  
> Plan: [tasks/LOADER_FX_EXECUTION_PLAN.md](../tasks/LOADER_FX_EXECUTION_PLAN.md)

## 0. Resumen ejecutivo

Capa de **efectos visuales anclados** que añaden atmósfera mágica o sci-fi **sobre o junto a** hosts procedurales del loader, sin cambiar la silueta blanca del motor de fantasía ni de las naves/planetas.

**Diferencia con capas ambientales ya existentes:**

| Capa actual | Rol | Ejemplo |
| --- | --- | --- |
| Ambiental global | Vive en toda la franja del mundo | Nubes, sol/luna, meteoritos, órbitas |
| **FX anclado (esta spec)** | Sigue a un **host** concreto y su ciclo de vida | Brillo en cristales, chispas al erosionar, glow de motor en nave |

El piloto acordado es **magia en cristales** (mitad fantasía). La misma arquitectura debe permitir después FX space opera (resplandor de propulsión, halo ionosférico en planetas, etc.).

## 1. Objetivos y no objetivos

### Objetivos

1. **Contrato único** para montar, actualizar y destruir un paquete de FX ligado a un host (`mountFxBundle`).
2. **Sincronización con fases** del host: `building` → `holding` → `eroding` → `gone` (y sub-eventos opcionales).
3. **Dos perfiles de reino**: `fantasy` (verde `#3DDB7E` + dorado `#F0C14A`) y `spaceOpera` (azul `#4DA3FF` + blanco `#FFFFFF`).
4. **Determinismo por semilla** en spawn de partículas y timings (testeable sin DOM).
5. **Rendimiento móvil** (referencia iPhone 13, 390×844): presupuesto acotado de partículas y filtros SVG.
6. **`prefers-reduced-motion`**: capa FX desactivada o degradada a fade estático (sin partículas ni pulso).

### No objetivos (v1)

- Colorizar la silueta blanca del motor de fantasía (el relleno `#fff` de las piezas **no cambia**).
- Físicas, colisiones o interacción del usuario con las partículas.
- Canvas/WebGL (v1 = DOM + SVG + CSS + `requestAnimationFrame`).
- Assets Lottie/Rive por efecto (reservado para overlays globales del loader).
- Reutilizar este motor fuera del loader (solo alcance loader por ahora).

## 2. Principios de diseño

| Principio | Decisión |
| --- | --- |
| Host primero | El FX **no** sustituye al host; desaparece cuando el host desaparece |
| Legibilidad | Efectos **secundarios** al logo central; intensidad moderada en móvil |
| Paleta por reino | Tokens de [SPEC_APP_VISUAL_DESIGN_V3.md](SPEC_APP_VISUAL_DESIGN_V3.md); opacidades bajas–medias |
| Capas | FX **encima** de la silueta del host, **debajo** del chrome del loader (anillo, barra, logo) |
| Máscara logo | Los FX respetan la misma exclusión radial que nubes/meteoritos cuando el host invade la franja central |
| Sin bloqueo | Si el FX falla, el host sigue su ciclo; `destroy()` siempre limpio |

## 3. Arquitectura de módulos

```
loader-fx-engine.js          ← registry, tipos, mountFxBundle, presupuesto global
loader-fx-anchors.js         ← extracción de puntos/líneas desde FantasyElement / hosts space
loader-fx-fantasy-palette.js   ← colores, gradientes, opacidades por efecto
loader-fx-space-palette.js     ← idem space opera (v1: stubs; piloto es fantasía)
loader-fx-crystals.js          ← recetas + anchors para cristales (piloto)
loader-fx-render.js            ← DOM/SVG partículas, rAF loop, CSS glow
```

Integración prevista:

| Punto de enganche | Cambio |
| --- | --- |
| `loader-fantasy-render.js` | Tras build completo → `fx.onPhase('holding')`; al erode → `fx.onPhase('eroding')`; en `destroy` → `fx.destroy()` |
| `loader-chrome.js` | Sin capa FX global nueva en v1; todo va colgado del host |
| `loader-space-orbit.js` / futuros | Hook equivalente cuando exista ciclo de vida en naves (fase posterior) |

## 4. Contrato de datos

### 4.1 Perfil de reino

```js
/** @typedef {'fantasy' | 'spaceOpera'} FxRealm */

/** @typedef {'building' | 'holding' | 'eroding' | 'gone'} FxPhase */
```

### 4.2 Anclas (anchors)

Puntos o segmentos en **espacio local del host** (viewBox `0 0 100 100` para fantasía), normalizados y estables por semilla.

```js
/**
 * @typedef {{
 *   id: string;
 *   kind: 'point' | 'segment';
 *   x: number; y: number;
 *   x2?: number; y2?: number;   // segment
 *   weight?: number;             // importancia para spawn (default 1)
 *   role?: string;               // p.ej. 'crystal_tip', 'facet'
 * }} FxAnchor
```

Los builders pueden emitir anclas en `FantasyElement.meta.fxAnchors`, o el módulo `loader-fx-anchors.js` las **deriva** de geometría (`parts`, roles) en montaje.

### 4.3 Receta de efecto

```js
/**
 * @typedef {{
 *   id: string;
 *   realm: FxRealm;
 *   hostKind: string;            // 'crystals' | 'ship' | ...
 *   effects: FxEffectSpec[];
 *   seed: number;
 *   anchors: FxAnchor[];
 * }} FxRecipe
 */

/**
 * @typedef {{
 *   type: 'sparkle' | 'mote' | 'edge_shimmer' | 'burst' | 'scatter';
 *   phase: FxPhase | 'building_end';
 *   intensity?: number;          // 0..1, default 0.6
 *   durationMs?: number;
 *   particleBudget?: number;
 * }} FxEffectSpec
 */
```

### 4.4 API pública

```js
/**
 * @param {HTMLElement} hostEl       contenedor del host (.loader-fantasy-el, etc.)
 * @param {SVGElement} hostSvg       SVG del host (coordenadas viewBox)
 * @param {FxRecipe} recipe
 * @param {{ reducedMotion?: boolean; displayScalePx?: number }} opts
 * @returns {{
 *   onPhase: (phase: FxPhase | 'building_end') => void;
 *   destroy: () => void;
 * }}
 */
export function mountFxBundle(hostEl, hostSvg, recipe, opts);

/** Registry: hostKind → (element, seed) => FxRecipe */
export const FX_RECIPE_BUILDERS = { ... };

/**
 * Planifica receta determinista (sin DOM).
 * @param {string} hostKind
 * @param {import('./loader-fantasy-element.js').FantasyElement | object} hostModel
 * @param {{ seed: number; realm?: FxRealm }} options
 * @returns {FxRecipe}
 */
export function planFxRecipe(hostKind, hostModel, options);
```

## 5. Ciclo de vida y sincronización

```
Host:     building ──────────▶ holding ──────▶ eroding ──▶ gone
FX:       (silencio /        sparkle +      scatter +
           burst opcional)    shimmer +      fade out
                              motes
```

| Fase host | Comportamiento FX (default) |
| --- | --- |
| `building` | Sin partículas continuas; opcional **burst** al terminar (`building_end`) |
| `holding` | Efectos de reposo: shimmer, motes flotantes, pulso suave de opacidad |
| `eroding` | Chispas que se desprenden hacia arriba; intensidad decreciente con máscara de erosión |
| `gone` | `destroy()` inmediato; sin nodos huérfanos |

En **`prefers-reduced-motion`**: no montar `mountFxBundle` (o montar vacío que solo hace `destroy`).

## 6. Render y presupuesto

| Límite | Valor v1 |
| --- | --- |
| Partículas concurrentes por host | ≤ **32** |
| Partículas concurrentes en escena (todos los hosts) | ≤ **48** |
| Filtros SVG `feGaussianBlur` activos | ≤ **2** por host |
| Loop | Un `rAF` por bundle; se cancela en `destroy` |
| Tamaño partícula | 1–4 px (micro), 4–8 px (raro) |

Implementación de partícula (v1):

- `div.loader-fx-particle` con `position:absolute` dentro del host, **o**
- `<circle>` / `<line>` en capa SVG hermana `.loader-fx-layer` (preferido para alineación con viewBox).

Glow de borde:

- Duplicado del path con `stroke` semitransparente + `filter: blur()` ligero, opacidad pulsada por CSS custom property `--fx-pulse`.

## 7. Registro y extensión

```js
FX_RECIPE_BUILDERS.crystals = planCrystalMagicFx;  // piloto
// Futuro:
// FX_RECIPE_BUILDERS.portal = planPortalMagicFx;
// FX_RECIPE_BUILDERS.ship = planShipThrusterFx;
```

Activación por host:

```js
// En mountFantasyElement, tras crear SVG:
const recipe = FX_RECIPE_BUILDERS[element.kind]?.(element, element.seed);
const fx = recipe ? mountFxBundle(el, svg, recipe, { reducedMotion }) : null;
```

`FantasyElement.meta.fxProfile` (opcional): override de intensidad o desactivar FX (`'none'`).

## 8. Dev y flags

| Query | Efecto |
| --- | --- |
| `?fantasyDev=crystals&fantasySeed=N` | Host cristales (existente) + FX si `fxDev=1` |
| `?fxDev=1` | Fuerza FX en hosts que lo soporten aunque el director esté en modo reducido de prueba |
| `?fxDev=crystals` | Solo receta cristales |
| `?fxIntensity=0.3..1.5` | Multiplicador de opacidad/cuenta (solo dev) |

## 9. Estrategia de tests

`node --test` (sin DOM):

- `planFxRecipe('crystals', element, { seed })` determinista.
- Presupuesto de partículas ≤ límites.
- Anclas: ≥ 1 por cristal en 30 seeds; tips dentro del bounding box del clúster.
- Fases: cada `FxEffectSpec` referencia una fase válida.
- `prefers-reduced-motion` simulado: `mountFxBundle` no planifica partículas (mock).

Playwright (390×844):

- Cristales con FX visibles en hold (captura `tmp/playwright-output/loader-fx-crystals-hold.png`).
- Erosión con dispersión perceptible.
- Sin errores de consola; `destroy()` al cambiar de ciclo.

## 10. Roadmap de hosts (tras piloto)

| Prioridad | Host | Reino | Efectos previstos |
| --- | --- | --- | --- |
| **P0** | `crystals` | fantasy | Magia en aristas — ver spec piloto |
| P1 | `portal` | fantasy | Pulso de runas en marco (no vano) |
| P2 | `ship` (procedural) | spaceOpera | Estela de motor, chispas de proximidad |
| P3 | `planet` (órbita) | spaceOpera | Halo atmosférico, parpadeo de ciudad |

## 11. Ficheros previstos

| Fichero | Fase |
| --- | --- |
| `web/js/components/loader-fx-engine.js` | FX-0 |
| `web/js/components/loader-fx-anchors.js` | FX-0 |
| `web/js/components/loader-fx-fantasy-palette.js` | FX-0 |
| `web/js/components/loader-fx-render.js` | FX-0 |
| `web/js/components/loader-fx-crystals.js` | FX-1 (piloto) |
| `web/js/components/loader-fx-space-palette.js` | FX-2 (stub) |
| `web/css/scenes/loader.css` | vars `.loader-fx-*` |
| `web/tests/loader-fx-*.test.js` | FX-0 / FX-1 |

## 12. Criterios de aceptación del motor (FX-0)

1. `planFxRecipe` existe y es determinista para al menos un host de prueba (`block` con anclas sintéticas).
2. `mountFxBundle` expone `onPhase` y `destroy` sin fugas (timer/rAF).
3. Presupuesto global respetado con 2 hosts simulados.
4. Integración en `mountFantasyElement` detrás de flag `meta.fxProfile !== 'none'`.
5. Reduced motion: FX no visible.
6. Tests en verde.

## 13. Decisiones propuestas (pendientes de OK usuario)

| ID | Propuesta |
| --- | --- |
| **FX-D1** | v1 solo **fantasía** en implementación; space opera queda especificado pero no codificado hasta FX-2 |
| **FX-D2** | Color en FX **sí** permitido (contraste con silueta blanca); no altera fill de piezas |
| **FX-D3** | Anclas derivadas automáticamente en cristales; builders no obligados a emitir `meta.fxAnchors` en v1 |
| **FX-D4** | Burst de cristalización al **fin del build**, no partícula continua durante build |
| **FX-D5** | Sin sonido en v1 |

## 14. Aprobación

- [ ] Usuario aprueba arquitectura FX (anclaje, ciclo de vida, presupuesto, integración en render).
- [ ] Usuario aprueba piloto cristales ([SPEC_LOADER_FX_CRYSTALS_MAGIC.md](SPEC_LOADER_FX_CRYSTALS_MAGIC.md)).
- [ ] OK para implementar **FX-0** (núcleo) + **FX-1** (cristales).
