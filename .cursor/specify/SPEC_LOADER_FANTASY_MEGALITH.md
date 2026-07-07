# Spec: Megalitos — menhires, dólmenes y círculos de piedra

> Estado: **propuesta** (jul 2026) — pendiente de aprobación del usuario  
> Motor: [SPEC_LOADER_FANTASY_ENGINE.md](SPEC_LOADER_FANTASY_ENGINE.md)  
> Catálogo: [SPEC_LOADER_FANTASY_ELEMENTS_CATALOG.md](SPEC_LOADER_FANTASY_ELEMENTS_CATALOG.md) §3  
> Fase: **4** del [plan de ejecución](../tasks/LOADER_FANTASY_ENGINE_EXECUTION_PLAN.md)  
> Referencia estética: piedra cruda (distinta de arquitectura enana en [ELEMENTS_ENGINE_SPECS.md](ELEMENTS_ENGINE_SPECS.md))

## 1. Contexto

Familia de **piedra cruda** para la mitad fantasía del loader: bloques irregulares sin arcos, tejados ni almenas. Comparte el ciclo de vida del motor (`building → holding → eroding → gone`) pero con siluetas muy orgánicas y **máxima imperfección**.

Los tres tipos (`menhir`, `dolmen`, `stoneCircle`) viven en un único módulo `loader-fantasy-megalith.js` con helpers compartidos de roca procedural.

### Diferencia con otros elementos

| Elemento | Contraste |
| --- | --- |
| Acantilados (`cliffs`) | Muros **laterales** fijos al borde de pantalla; una sola masa vertical por lado |
| Castillo enano | Piedra **tallada** con chamfers y vanos rectangulares; arquitectura |
| Megalitos | Piedra **natural** irregular; polígonos con `jitterRing` fuerte; sin rectángulos limpios |

## 2. Lenguaje formal de roca

| Principio | Decisión |
| --- | --- |
| Silueta | `polygon` de 6–14 vértices + `jitterRing(amount: 0.45–0.85)` |
| Prohibido | `rect` sin jitter, arcos curvos, tejados, almenas |
| Orientación | Piezas verticales ligeramente inclinadas (`tiltDeg` ±2–6°) |
| Base | `baseY = 0` en espacio local; parte inferior **hundida** bajo el suelo (seam overlap como castillos) |
| Sustracciones | Solo grabados finos en menhir (líneas/espirales como `evenodd`); resto macizo |
| Color | Blanco `#fff` (motor estándar) |

### Roles (`role`)

| Rol | Uso |
| --- | --- |
| `menhir_body` | Cuerpo del menhir (1 pieza) |
| `engraving` | Grabados opcionales (sustracción sobre el menhir o pieza separada con huecos) |
| `orthostat` | Pata vertical de dolmen o piedra del círculo |
| `capstone` | Losa horizontal del dolmen |
| `lintel` | Dintel opcional en círculo de piedras (trilito) |
| `rock_base` | Base rocosa irregular bajo un círculo (opcional, 0–1) |

## 3. Tipos y generación

### 3.1 Menhir (`menhir`)

Monolito vertical alto, asimétrico, ligeramente inclinado.

| Parámetro | Rango local (pre-normalizar) | Notas |
| --- | --- | --- |
| Anchura | 8–16 u | Estrecho |
| Altura | 42–72 u | Muy vertical; relación altura/anchura ≥ 4:1 |
| Inclinación global | `tiltDeg` 2–8° | Hacia izquierda o derecha |
| Grabados | 0–3 trazos | 40 % de seeds sin grabado |

**Variantes `style`**

| `style` | Descripción |
| --- | --- |
| `standing` | Monolito clásico, perfil dentado |
| `leaning` | Inclinación marcada (≥ 5°) |
| `carved` | Grabados visibles (espirales o líneas paralelas como sustracción fina) |
| `weathered` | Silueta más rota en la cima (menos vértices superiores) |

**Partes:** 1 (`menhir_body`) + 0–1 (`engraving` fusionado en el mismo `d` o pieza auxiliar con `buildOrder` igual).

### 3.2 Dolmen (`dolmen`)

Forma de **mesa**: ortostatos + cobertera.

| Parámetro | Rango | Notas |
| --- | --- | --- |
| Ortostatos | 2–3 | Alturas y grosores desiguales |
| Cobertera | 1 losa | Más ancha que el vano; asimétrica |
| Anchura total | 22–38 u | |
| Altura total | 28–48 u | Bajo y ancho respecto al menhir |

**Variantes `style`**

| `style` | Descripción |
| --- | --- |
| `classic` | 3 patas + losa |
| `asymmetric` | 2 patas de alturas muy distintas + losa inclinada |
| `low` | Dolmen bajo y ancho (cobertura casi al suelo) |

**Orden de construcción (obligatorio):**

1. Ortostatos por `baseY` ascendente (emergen del suelo).
2. **Cobertera al final** — `buildOrder` máximo; debe ser la última pieza en animarse.

### 3.3 Círculo de piedras (`stoneCircle`)

Anillo de piedras verticales en **perspectiva elíptica** (fondo más pequeño/alto en pantalla, frente más grande).

| Parámetro | Rango | Notas |
| --- | --- | --- |
| Piedras | 5–9 | Conteo impar preferente (~70 % seeds) |
| Dinteles (`lintel`) | 0–2 | Opcional; solo entre piedras adyacentes del frente |
| Anchura elipse | 36–58 u | Eje mayor horizontal |
| Profundidad | 0.55–0.75× eje menor | Compresión vertical de la elipse |
| `rock_base` | 50 % seeds | Masa baja irregular bajo el anillo |

**Variantes `style`**

| `style` | Descripción |
| --- | --- |
| `openRing` | Anillo incompleto (1–2 huecos en el arco) |
| `trilithon` | 1–2 pares con dintel visible |
| `ancient` | Piedras muy desiguales; una caída (más baja, inclinada) |

**Orden de construcción:**

- Piedras emergen **una a una**.
- Orden por **profundidad**: fondo → frente (piedras traseras primero) **o** orden aleatorio determinista por seed (~30 % seeds).
- Dinteles: **después** de las dos ortostatos que soportan cada uno.
- `rock_base` (si existe): **primera** pieza (`buildOrder` mínimo).

**Perspectiva (implementación):**

- Ángulo θᵢ uniforme en [0, 2π) con jitter irregular.
- Escala por piedra: `scale = 0.55 + 0.45 × ((sin(θ) + 1) / 2)` (frente = mayor).
- `baseY` jitter leve por profundidad (fondo ligeramente más alto en pantalla).

## 4. API

```js
/**
 * Router por kind.
 * @param {{
 *   seed: number;
 *   kind: 'menhir' | 'dolmen' | 'stoneCircle';
 *   style?: string;
 *   imperfection?: number;
 *   terrainHeightPx?: number;
 * }} options
 * @returns {import('./loader-fantasy-element.js').FantasyElement}
 */
export function generateMegalith(options);

/** @param {number} seed @returns {import('./loader-fantasy-element.js').FantasyElement} */
export function generateMenhir(seed, options?);

/** @param {number} seed @returns {import('./loader-fantasy-element.js').FantasyElement} */
export function generateDolmen(seed, options?);

/** @param {number} seed @returns {import('./loader-fantasy-element.js').FantasyElement} */
export function generateStoneCircle(seed, options?);

/**
 * Elige kind de megalito para el director (Fase 8).
 * @param {number} seed
 * @returns {'menhir' | 'dolmen' | 'stoneCircle'}
 */
export function planMegalithKind(seed);
```

Registro en el motor:

```js
FANTASY_BUILDERS.menhir = (seed, opts) => generateMegalith({ ...opts, seed, kind: 'menhir' });
FANTASY_BUILDERS.dolmen = (seed, opts) => generateMegalith({ ...opts, seed, kind: 'dolmen' });
FANTASY_BUILDERS.stoneCircle = (seed, opts) => generateMegalith({ ...opts, seed, kind: 'stoneCircle' });
```

### Helpers internos (mismo fichero)

```js
/** Polígono de roca vertical irregular. */
export function rockOrthostat(rng, cx, baseY, w, h, opts?): Point[];

/** Losa horizontal irregular. */
export function rockCapstone(rng, cx, baseY, w, h, tiltDeg?): Point[];

/** Grabado fino (líneas/espiral) como anillos de sustracción. */
export function rockEngravings(rng, bounds, count): Point[][];
```

## 5. Ciclo de vida

Usa `planLifecycleTiming` con entradas **nuevas** por kind (añadir en `loader-fantasy-element.js` en implementación):

| Kind | `partDurationMs` | `holdMs` | `erodeMs` | Notas build total |
| --- | --- | --- | --- | --- |
| `menhir` | 180–300 | 2500–4500 | 1300–1900 | 1 pieza → ~900–1500 ms |
| `dolmen` | 220–380 | 2500–4500 | 1500–2200 | 3–4 piezas → ~1400–2200 ms |
| `stoneCircle` | 200–340 | 3000–5000 | 1800–2600 | 5–11 piezas → ~2000–3000 ms |

### Construcción

- Escalado desde la **base de cada pieza** (WAAPI estándar del motor).
- Sensación de **emergencia del suelo** (no “construcción arquitectónica”).
- Dolmen: cobertera con overshoot leve al asentar (~1.08) — opcional en render.

### Erosión

- Disolución **global** del conjunto (máscara única).
- Ruido **más grueso** que castillos: en implementación, extender `erosionMaskNoiseParams(seed, kind)` para megalitos con `baseFrequency` ~40–55 % del default (bloques que se desmoronan, no polvo fino).
- Frente top→bottom estándar.

### Reduced motion

Fade-in del conjunto → hold → fade-out. Sin escalado por pieza ni pulso de cobertera.

## 6. Escena (integración futura — Fase 8)

Hasta que el director mezcle todos los tipos, comportamiento previsto:

| Aspecto | Decisión v1 |
| --- | --- |
| Zona | Centro de la mitad fantasía (misma franja que bosque/castillo), evitando logo |
| Frecuencia spawn | ~12–18 % de ciclos (menor que bosque; pieza narrativa puntual) |
| `maxConcurrent` | 1 (un megalito a la vez) |
| Dev flags | `?fantasyDev=menhir`, `dolmen`, `stoneCircle` + `&fantasySeed=N` |

Ajuste de altura en escena (orientativo, como castillo):

| Kind | Fracción altura layer | Altura px |
| --- | --- | --- |
| `menhir` | 0.28–0.42 | 72–140 |
| `dolmen` | 0.20–0.32 | 56–110 |
| `stoneCircle` | 0.22–0.36 | 60–120 |

## 7. Ficheros

| Fichero | Responsabilidad |
| --- | --- |
| `web/js/components/loader-fantasy-megalith.js` | Builders, helpers de roca, `planMegalithKind` |
| `web/js/components/loader-fantasy-element.js` | Registrar los 3 kinds; timings en `planLifecycleTiming` |
| `web/js/components/loader-fantasy-render.js` | (opcional) `erosionMaskNoiseParams` por kind |
| `web/tests/loader-fantasy-megalith.test.js` | Tests del builder |

## 8. Tests (`node --test`, sin DOM)

Archivo: `web/tests/loader-fantasy-megalith.test.js`

### Comunes (×3 kinds)

1. **Determinismo**: misma `seed` → mismos `parts` (`d` idénticos).
2. **Variación**: 40 seeds distintas → ≥ 30 siluetas distintas (hash de `d` combinados).
3. **Validez**: `isValidFantasyElement` OK en 30+ seeds por kind.
4. **Build order**: monótono con `baseY`; sin `buildOrder` duplicados conflictivos.
5. **Proporción**: anchura normalizada < 45 % de altura en menhir; dolmen más ancho que alto (footprint ≥ 1.1× altura).

### Menhir

- Exactamente **1** pieza principal (`menhir_body` o equivalente).
- Altura/anchura ≥ 3.5:1 tras normalizar.
- `tiltDeg` ≠ 0 en ≥ 60 % de seeds.

### Dolmen

- **2–3** ortostatos + **1** capstone.
- `capstone` tiene el `buildOrder` **máximo** del elemento.
- Cobertera más ancha que la separación entre patas exteriores (invariante geométrica).

### Círculo de piedras

- **5–9** ortostatos.
- Dispersión angular: desviación estándar de ángulos > umbral (no equiespaciado perfecto).
- Si hay dinteles: cada `lintel` con `buildOrder` > ambos ortostatos que une.

## 9. Criterios de aceptación

- [ ] Los 3 kinds registrados y `generateFantasyElement` devuelve elemento válido.
- [ ] Dolmen: cobertera anima **después** de las patas (validación visual Playwright).
- [ ] Círculo: sensación de profundidad (piedras delanteras mayores).
- [ ] Erosión con textura gruesa perceptible vs castillo.
- [ ] `?fantasyDev=menhir|dolmen|stoneCircle` operativo.
- [ ] Suite `loader-fantasy-megalith.test.js` en verde.
- [ ] Validación MCP Playwright (iPhone 13, 390×844); capturas en `tmp/playwright-output/`.
- [ ] **Visto bueno del usuario** → habilita Fase 6 (cristales) en paralelo o siguiente según prioridad.

## 10. Aprobación

- [ ] Usuario aprueba diseño de los tres tipos y tiempos de vida.
- [ ] OK para implementar Fase 4 (sin mezclar aún en director completo salvo dev flags).
