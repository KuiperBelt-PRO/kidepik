# Spec: Motor de generación de elementos de fantasía (loader)

> Estado: **propuesta** (jun 2026) — pendiente de aprobación del usuario
> Relacionado: [SPEC_LOADER_SCREEN.md](SPEC_LOADER_SCREEN.md), [SPEC_LOADER_FANTASY_TERRAIN.md](SPEC_LOADER_FANTASY_TERRAIN.md), [SPEC_LOADER_FANTASY_CASTLE.md](SPEC_LOADER_FANTASY_CASTLE.md), [SPEC_LOADER_FANTASY_ELEMENTS_CATALOG.md](SPEC_LOADER_FANTASY_ELEMENTS_CATALOG.md)
> Plan por fases: [tasks/LOADER_FANTASY_ENGINE_EXECUTION_PLAN.md](../tasks/LOADER_FANTASY_ENGINE_EXECUTION_PLAN.md)

## 0. Resumen ejecutivo

Motor procedural que **genera, construye y erosiona** elementos de fantasía blancos sobre el suelo de la mitad fantasía del loader: castillos, palacios, aldeas, pueblos, posadas, torres, bosques, formaciones de cristal mágico, círculos de piedra, dólmenes, menhires y portales mágicos.

Este documento define la **arquitectura compartida** (contrato de datos, geometría, render, máquina de estados del ciclo de vida y director de escena). Cada **tipo de elemento** se especifica aparte:

- Castillos/palacios → [SPEC_LOADER_FANTASY_CASTLE.md](SPEC_LOADER_FANTASY_CASTLE.md) (primer builder).
- Resto de tipos → [SPEC_LOADER_FANTASY_ELEMENTS_CATALOG.md](SPEC_LOADER_FANTASY_ELEMENTS_CATALOG.md).

El motor **reutiliza** el lenguaje visual y los patrones ya probados en `loader-ship-procedural.js` (RNG determinista, capas de polígonos, normalización a `viewBox 100×100`, relleno `#fff`).

## 1. Objetivos y no objetivos

### Objetivos

1. Un **contrato único** `generateFantasyElement(kind, options)` que devuelve una estructura de partes determinista por semilla.
2. Un **runner de ciclo de vida** común: construcción progresiva de abajo a arriba → reposo → erosión global → desaparición.
3. Un **director de escena** que secuencia elementos sobre el terreno mientras el loader está activo.
4. **Variación aleatoria** real entre montajes: ningún elemento idéntico en dos recargas.
5. **Determinismo por semilla**: misma semilla → mismo elemento (testeable sin DOM).
6. Estilo **blanco sólido, detallado, asimétrico, imperfecto**.
7. Respeto a `prefers-reduced-motion` y rendimiento móvil (perfil de referencia **iPhone 13** — 390×844, DPR 3).

### No objetivos (v1 del motor)

- Color, texturas raster, sombreado o iluminación (solo silueta blanca + sustracciones).
- Físicas, colisiones o interacción del usuario con los elementos.
- 3D real (es 2D vectorial; la "profundidad" es solo solapamiento de siluetas).
- Persistencia entre sesiones de los elementos generados.

## 2. Lenguaje visual (común a todos los tipos)

| Principio | Decisión |
| --- | --- |
| Color | **Blanco sólido `#fff`** (igual que planetas, naves y terreno) |
| Fondo | El de la escena loader; las **sustracciones** (ventanas/puertas/arcos) dejan ver el fondo |
| Detalle | Muchas piezas pequeñas (almenas, ventanas, remates, greebles) — densidad alta pero legible a tamaño móvil |
| Asimetría | Eje central desplazado, alturas/anchos desiguales, conteos impares, lados distintos |
| Imperfección | Jitter por vértice, ligera inclinación de algunas piezas, bordes no perfectamente rectos |
| Apoyo | Todos los elementos "nacen" del borde superior del terreno (baseline de suelo) |
| Coherencia | Mismo grosor de detalle relativo entre tipos para que convivan en la escena |

## 3. Sistema de coordenadas y geometría

### 3.1 Espacio local del elemento

Cada builder trabaja en un **espacio local con el suelo en `y = 0` y crecimiento hacia arriba** (y-up). La conversión a SVG (y-down) y la normalización a `viewBox` cuadrado se hace en el pipeline común, reutilizando el patrón de `loader-ship-procedural.js`:

- `normalizeGroups(groups)` → reescala y centra todas las partes en `0..100`.
- `pointsToPath(points, closed)` → genera `d` SVG.
- `boundsOfPoints(groups)` → ancho/alto efectivos.

> Decisión: extraer estos helpers a un módulo compartido `loader-fantasy-geom.js` (copia adaptada, no se modifica el módulo de naves para no arriesgar regresiones). Se reutiliza el RNG existente de `loader-ship-rng.js` (`createRng`, `hashSeed`, `randRange`, `randPick`).

### 3.2 Primitivas geométricas del motor

`loader-fantasy-geom.js` expone (cada una devuelve un anillo de puntos `{x,y}` en espacio local y-up, salvo helpers de path):

| Primitiva | Uso |
| --- | --- |
| `rect(x, y, w, h, opts?)` | Bloques, muros, torres rectangulares (con jitter opcional por vértice) |
| `gableRoof(x, y, w, h, opts?)` | Tejado a dos aguas (triángulo / trapecio con cumbrera) |
| `dome(cx, baseY, rx, ry, segments)` | Bóveda / cúpula (semielipse poligonalizada) |
| `merlons(x, topY, w, count, opts?)` | Almenas (dientes rectangulares con huecos) — devuelve varios anillos |
| `arch(cx, baseY, w, h, kind)` | Arco como **hueco** (sustracción): `gothic` (ojival), `romanesque` (medio punto), `flat`, `trefoil` |
| `aperture(x, y, w, h, kind)` | Ventana/puerta/saetera como **hueco** de sustracción |
| `finial(cx, baseY, h, kind)` | Remate decorativo (aguja, cruz, esfera, banderín) |
| `polygon(points)` | Forma libre (cristales, rocas, copas de árbol) |
| `jitterRing(points, rng, amount)` | Aplica imperfección controlada a cualquier anillo |

### 3.3 Sustracción (ventanas, puertas, arcos)

Las siluetas son blancas sólidas; para "restar" huecos se usa **fill-rule `evenodd` por parte**:

- Cada **parte** se renderiza como un único `<g>` con un `<path>` cuyo `d` concatena:
  - El **anillo exterior** (forma de la pieza), sentido horario.
  - Cero o más **anillos de hueco** (ventanas, puertas, arcos), sentido antihorario.
- Con `fill-rule="evenodd"` los huecos dejan ver el fondo.

> Ventaja: la sustracción **viaja con su pieza**. Al animar el `<g>` de una pieza durante la construcción, sus huecos escalan con ella (coherencia "se construye con sus ventanas"). Evita una máscara global y simplifica el render por componente.

## 4. Contrato de datos (modelo de elemento)

### 4.1 Tipos

```js
/** @typedef {'castle' | 'palace' | 'village' | 'town' | 'inn' | 'tower'
 *   | 'forest' | 'crystals' | 'stoneCircle' | 'dolmen' | 'menhir' | 'portal'} FantasyKind */

/** @typedef {{ x:number; y:number }} Point */

/**
 * Una pieza independiente del elemento (se construye y anima por separado).
 * @typedef {{
 *   id: string;            // único dentro del elemento
 *   role: string;          // 'base' | 'tower' | 'block' | 'roof' | 'battlement'
 *                          // | 'dome' | 'decoration' | 'trunk' | 'canopy' | 'crystal' | ...
 *   d: string;             // path SVG ya en espacio normalizado (con huecos evenodd)
 *   baseY: number;         // 0..100 en SVG (mayor = más abajo): para orden de construcción
 *   centerX: number;       // 0..100: para origen de escalado y desempates
 *   buildOrder: number;    // entero; menor = se construye antes
 *   tiltDeg?: number;      // imperfección: leve inclinación al asentar (default 0)
 * }} FantasyPart */

/**
 * @typedef {{
 *   kind: FantasyKind;
 *   style: string;         // variante interna del builder
 *   seed: number;
 *   viewBox: string;       // '0 0 100 100'
 *   parts: FantasyPart[];  // ordenadas por buildOrder asc
 *   width: number;         // ancho efectivo normalizado
 *   height: number;        // alto efectivo normalizado
 *   footprint: number;     // ancho relativo del apoyo en el suelo (para el director)
 *   meta: Record<string, unknown>; // datos de variación (nº torres, arcos, etc.)
 * }} FantasyElement */
```

### 4.2 API de generación

```js
/**
 * @param {FantasyKind} kind
 * @param {{ seed:number; style?:string; sizeHint?:number; imperfection?:number }} options
 * @returns {FantasyElement}
 */
export function generateFantasyElement(kind, options);
```

- Cada `kind` registra un builder en un **registry** (`FANTASY_BUILDERS[kind]`).
- `imperfection ∈ [0,1]` (default ~0.5) escala el jitter y la asimetría.
- El builder devuelve **partes ya normalizadas** y ordenadas por `buildOrder`.
- Función `isValidFantasyElement(el)` (análoga a `isValidGeneratedShip`) para los tests.

## 5. Máquina de estados del ciclo de vida

Común a **todos** los tipos. Una instancia montada pasa por:

```
seeded ──▶ building ──▶ holding ──▶ eroding ──▶ gone
              │ (abajo→arriba,        │ (reposo)   │ (máscara de ruido
              │  escalado por pieza)  │            │  top→bottom)
              ▼                       ▼            ▼
        cada FantasyPart        elemento entero  elemento entero
```

### 5.1 Parámetros de tiempo (defaults, aleatorizados por instancia)

| Fase | Rango | Notas |
| --- | --- | --- |
| `building` | 1800–3200 ms | Suma del escalonado de todas las piezas |
| Escalado por pieza | 220–420 ms | Ease-out con leve *overshoot* (asentamiento imperfecto) |
| Solape entre piezas | 35–70 % de la pieza previa | Construcción fluida, no estrictamente secuencial |
| `holding` | 2500–5000 ms | Estado finalizado visible |
| `eroding` | 1600–2800 ms | Disolución global de arriba a abajo |
| Gap entre elementos | 400–1200 ms | El director espera antes del siguiente |

### 5.2 Construcción (building)

- **Orden**: las piezas se construyen por `buildOrder` ascendente, derivado de `baseY` (más abajo primero) y desempate por `centerX` y área. Una torre se eleva **después** de su bloque base; los remates/almenas, **después** de su torre.
- **Animación por pieza**: cada `<g>` de pieza se anima con **Web Animations API (WAAPI)** `transform: scale()` de `0`→`1` con `transform-origin` en la **base** de la pieza (`centerX`, su `baseY`), de modo que "crece desde el suelo / desde su apoyo".
  - Curva: `cubic-bezier` con leve overshoot (p. ej. `(0.34, 1.3, 0.64, 1)`), opcional micro-rebote final.
  - `tiltDeg` aplica una rotación residual pequeña (±1–2°) para imperfección.
- Las sustracciones (huecos `evenodd`) ya están en el `d`: escalan con su pieza.

### 5.3 Reposo (holding)

- Elemento completo, sin animación (o micro-parallax opcional desactivado en v1).

### 5.4 Erosión (eroding)

- **Se erosiona el conjunto, no pieza a pieza.** Se aplica una **máscara de disolución** sobre el `<g>` raíz del elemento:
  - `feTurbulence` (`type="fractalNoise"`, `baseFrequency` ~0.9–1.4, 2 octavas) genera ruido.
  - Un **gradiente vertical** cuyo umbral se desplaza de **arriba a abajo** define el frente de erosión.
  - El ruido perturba ese frente (`feDisplacementMap` o combinación con `feComponentTransfer`/`feColorMatrix` para un borde **dentado**), produciendo un desmoronamiento irregular.
  - Se anima una variable (offset del gradiente, vía CSS var o atributo) de `0` (intacto) a `1` (desaparecido) durante `eroding`.
- Resultado: el elemento se "come" desde la cima hacia la base con borde de ruido, hasta opacidad/área 0.

### 5.5 `prefers-reduced-motion` y *fallbacks*

- **Reduced motion**: sin escalado por pieza ni filtro de ruido. Aparición por `opacity` (fade-in), reposo, y desaparición por `opacity` (fade-out). Mismo `kind`/seed, sin coste de filtro.
- **Sin soporte de filtros SVG** (detección): degradar erosión a `opacity` fade-out con `mask` lineal simple.
- El motor nunca bloquea el loader: si algo falla, el elemento se retira limpio (`destroy()`), el director continúa.

## 6. Renderizado y montaje DOM

Módulo `loader-fantasy-render.js`:

```js
/**
 * Monta una instancia y ejecuta su ciclo de vida una vez.
 * @param {HTMLElement} container
 * @param {FantasyElement} element
 * @param {{ reducedMotion?:boolean; xPercent:number; heightPx:number;
 *           onGone?:()=>void; timing?:Partial<LifecycleTiming> }} opts
 * @returns {{ destroy: () => void }}
 */
export function mountFantasyElement(container, element, opts);
```

Estructura DOM por instancia:

```
.loader-fantasy-el                  (posición absoluta sobre el terreno; left:xPercent; bottom alineado al suelo)
  └── svg.loader-fantasy-el__svg    (viewBox 0 0 100 100; filtro de erosión en <defs>)
       ├── g.loader-fantasy-el__parts  (raíz que recibe la máscara de disolución)
       │    ├── g.part (role=base)      ← path evenodd blanco, animado por WAAPI
       │    ├── g.part (role=tower)
       │    └── … (una <g> por FantasyPart)
       └── defs (feTurbulence + gradiente animado de erosión)
```

- `width/height` en pantalla derivados de `heightPx` (altura objetivo) y el aspect del elemento (patrón `computeDisplaySize` de naves).
- Las piezas comparten color `#fff` (atributo `fill="#fff"`, `fill-rule="evenodd"`).

## 7. Director de escena (`loader-fantasy-scene.js`)

Orquesta qué elementos aparecen y cuándo, sobre el terreno de la mitad fantasía.

```js
/**
 * @param {HTMLElement} container  (la capa de terreno/fantasía)
 * @param {{ reducedMotion?:boolean; rng?:()=>number;
 *           kinds?:FantasyKind[]; maxConcurrent?:number }} [opts]
 * @returns {{ destroy: () => void }}
 */
export function mountFantasyScene(container, opts);
```

Responsabilidades:

1. Mantener una **cola/selección ponderada** de `kind` a generar (evitar repetir el mismo dos veces seguidas).
2. Elegir **posición X** sobre el terreno (asimétrica, en cualquier punto del ancho) y **altura objetivo** según el tipo, con un **tope de altura** (ver §7.1): la cima de la silueta nunca alcanza el anillo del logo. Al no invadir la zona central, **no se necesita máscara de exclusión central**.
3. Generar (`generateFantasyElement`) con semilla de sesión + slot, montar (`mountFantasyElement`) y, en `onGone`, programar el siguiente tras el *gap*.
4. Respetar `maxConcurrent`: **v1 = 1**; en la Fase 8 (pulido) podrá subir a **2–3** siluetas simultáneas (decisión D1 = *ramp*).
5. `destroy()` limpio: cancela timers/animaciones y retira nodos.

> El director **no** se acopla al `kind`: solo conoce el contrato. Añadir un tipo nuevo = registrar su builder + (opcional) su peso/altura en la tabla del director.

### 7.1 Tope de altura (restricción clave)

Los elementos **no deben llegar en altura hasta el anillo del logo central**. El director calcula una **altura máxima de silueta** (`maxElementTopPx`) = distancia desde el suelo hasta un margen de seguridad **por debajo** del borde inferior del anillo (`--loader-ring-size`), y escala cada elemento para que su cima quede por debajo de ese límite.

Consecuencias:

- **Prominencia "media"** (decisión de usuario): elementos claramente visibles pero secundarios al logo.
- **Sin exclusión central**: como ninguna silueta sube hasta el logo, los elementos pueden ubicarse en cualquier X del suelo, incluido el centro, sin solaparse con el anillo/logo.
- El **suelo** (terreno) sigue siendo la base de apoyo; la altura objetivo por tipo se recorta a `maxElementTopPx`.

## 8. Integración en el loader

- `loader-chrome.js` monta el director **una vez**, después del terreno:
  ```js
  let fantasySceneTeardown = mountFantasyScene(layers, { reducedMotion });
  ```
  y lo libera en `destroy()` junto al resto de capas.
- Capa propia `.loader-layer--fantasy-scene` (z-index entre terreno `1` y chrome `2`; debajo del anillo/logo). Apoyada en la base; sin exclusión central (los elementos no llegan al logo por el tope de altura §7.1).
- Sin assets nuevos: todo vectorial generado en runtime.

## 9. Ficheros (planificados)

| Fichero | Responsabilidad | Fase |
| --- | --- | --- |
| `web/js/components/loader-fantasy-geom.js` | Primitivas geométricas + normalización + sustracción evenodd | 0 |
| `web/js/components/loader-fantasy-element.js` | Tipos, registry de builders, `generateFantasyElement`, `isValidFantasyElement`, planificación de ciclo de vida (orden, timings, mapeo de erosión) | 0 |
| `web/js/components/loader-fantasy-render.js` | `mountFantasyElement`, animación WAAPI, máscara/filtro de erosión, reduced-motion | 0 |
| `web/js/components/loader-fantasy-scene.js` | Director de escena | 0 (esqueleto) → 8 (pulido) |
| `web/js/components/loader-fantasy-castle.js` | Builder castillos/palacios | 1 |
| `web/js/components/loader-fantasy-*.js` | Un builder por familia de elemento | 2–7 |
| `web/css/scenes/loader.css` | Estilos `.loader-fantasy-*`, keyframes/vars de erosión | 0+ |
| `web/tests/loader-fantasy-*.test.js` | Tests de geometría, generación y planificación de lifecycle | 0+ |
| `web/js/components/loader-chrome.js` | Montaje/desmontaje del director | 0 |

## 10. Estrategia de tests

`node --test` (sin DOM) cubre la **lógica pura**:

- **Geometría**: cada primitiva devuelve anillos válidos; `arch`/`aperture` producen anillos de hueco con orientación correcta para `evenodd`; `jitterRing` acotado por `amount`.
- **Generación**: determinismo (misma seed → mismos `parts`), variación (seeds distintas → distintos), validez (`isValidFantasyElement`), invariantes por tipo (p. ej. castillo: ≥1 torre, cada torre con remate ∈ {tejado, almenas, bóveda}, ≥1 sustracción, métrica de asimetría > umbral).
- **Ciclo de vida (pura)**: `planBuildOrder` monótono por `baseY`; `planLifecycleTiming` dentro de rangos y determinista por seed; `erosionThresholdAt(t)` monótona 0→1 con frente top→bottom.

La capa **DOM/WAAPI/filtros** (construcción, erosión visible) se valida con **MCP Playwright** en el perfil **iPhone 13** (390×844, DPR 3) (capturas en `tmp/playwright-output/`), por fase.

## 11. Rendimiento

- Un solo elemento activo en v1; SVG ligero (decenas de paths).
- `feTurbulence` solo durante `eroding` (no permanente); se elimina el filtro al pasar a `gone`.
- `will-change: transform, opacity` solo en piezas en construcción; se limpia tras construir.
- Sin reflow por frame: animaciones vía `transform`/`opacity` (compositor).

## 12. Criterios de aceptación del motor (Fase 0)

1. `generateFantasyElement('block', {seed})` (elemento mínimo de prueba) es determinista y válido.
2. El runner ejecuta `building → holding → eroding → gone` con `onGone` invocado una vez.
3. La construcción es **de abajo a arriba** (verificable por orden de `buildOrder`/baseY).
4. La erosión es **global** mediante máscara de ruido top→bottom (visual Playwright).
5. `reducedMotion` evita escalado por pieza y filtro; usa fades.
6. `destroy()` no deja nodos, timers ni animaciones colgando; sin errores de consola.
7. Director monta el elemento sobre el terreno respetando el **tope de altura** (§7.1: la cima no llega al anillo del logo) y encadena el siguiente.

## 13. Decisiones (resueltas con el usuario, jun 2026)

- **D1.** Concurrencia → **ramp**: v1 = 1 elemento a la vez; subir a 2–3 en la Fase 8.
- **D2.** Erosión → **`feTurbulence`** con *fallback* a gradiente dentado si el rendimiento en iPhone 13 lo exige.
- **D3.** Posición → **sin exclusión central**: los elementos no alcanzan el logo gracias al **tope de altura** (§7.1); se pueden ubicar en cualquier X del suelo. Prominencia **media**.
- **D4/D7.** Megalitos → **una sola fase** (menhir + dolmen + círculo) con gate único.
- **D5.** Piezas despegadas del suelo (cristales flotantes, runas) → **permitidas** como opción de pieza (escalado desde su propia base).
- **D6.** Vano del portal → **estático** (aparece a tamaño final; **no** se anima el crecimiento del hueco). Simplifica el render.
- **Estructura de arranque** → **Fase 0 (núcleo + bloque de prueba) separada** con gate propio, luego Fase 1 castillo.
- **Castillo/palacio** → **ambos** en la Fase 1 (mismo builder con sesgo de estilo).
- **Alcance** → **solo loader** por ahora (no abstraer para otras pantallas todavía).

## 14. Aprobación

- [x] Decisiones D1–D7 resueltas (ver §13).
- [ ] Usuario aprueba arquitectura del motor (contrato, lifecycle, render, director).
- [ ] OK para implementar **Fase 0** (núcleo del motor).
