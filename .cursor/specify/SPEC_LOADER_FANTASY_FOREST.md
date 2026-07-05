# Spec: Bosques y árboles (builder de fantasía)

> Estado: **implementado** (jul 2026)
> Motor: [SPEC_LOADER_FANTASY_ENGINE.md](SPEC_LOADER_FANTASY_ENGINE.md)
> Terreno: [SPEC_LOADER_FANTASY_TERRAIN.md](SPEC_LOADER_FANTASY_TERRAIN.md)
> Catálogo: [SPEC_LOADER_FANTASY_ELEMENTS_CATALOG.md](SPEC_LOADER_FANTASY_ELEMENTS_CATALOG.md) §4

## 1. Contexto

Familia **orgánica** de árboles compuestos por **tronco + copa**, agrupados en bosques con ciclo de vida estándar del motor (`building → holding → eroding → gone`).

## 2. Generador de árboles (`loader-fantasy-trees.js`)

### Troncos (`TrunkKind`)

| Tipo | Silueta |
| --- | --- |
| `straight` | Recto estrecho, ligera inclinación |
| `tapered` | Trapecio (grueso abajo) |
| `gnarled` | Polígono irregular con nudos |
| `slender` | Muy fino (abedul, pino joven) |
| `forked` | Bifurcación baja |

### Copas (`CanopyKind`)

| Tipo | Silueta |
| --- | --- |
| `round` | Masa lobulada (roble) |
| `lobed` | 2–3 masas superpuestas |
| `conical` | Escalones triangulares (pino) |
| `flat` | Copa ancha y baja (encina) |
| `sparse` | Pequeños grupos dispersos |

### Especies (`TreeSpecies`)

Combinación tronco + copa:

| Especie | Tronco | Copa |
| --- | --- | --- |
| `pine` | tapered | conical |
| `oak` | gnarled | lobed |
| `holm_oak` | straight | flat |
| `birch` | slender | round |
| `fir` | straight | conical |

API:

```js
export function generateTree(rng, options): { species, trunk, canopy, layout }
```

Cada árbol produce dos partes: `trunk` y `canopy` (comparten `treeIndex`). En render, **todo el árbol escala junto** desde el suelo (tronco + copas como unidad).

`TREE_SIZE_FACTOR = 0.25` — escala global respecto al generador base.

## 3. Generador de bosques (`loader-fantasy-forest.js`)

| Parámetro | `compact` | `extensive` |
| --- | --- | --- |
| Árboles | 14–20 | 26–38 |
| Anchura local | ~48–68 u | ~78–96 u |
| Solapamiento | moderado | alto |

- Un bosque incluye **1–3 especies** distintas (mezcla determinista por semilla).
- Los árboles se disponen con jitter X, escala y profundidad; **pueden solaparse**.
- Si se pasa `terrainProfile` + `forestCenterXNorm`, cada tronco ajusta su `baseY` local siguiendo la cresta del terreno.

```js
export function generateForest(options): FantasyElement
export function planForestExtent(seed): 'compact' | 'extensive'
export function planForestSpeciesMix(seed): TreeSpecies[]
```

Registrado como `FANTASY_BUILDERS.forest`.

## 4. Terreno

- `sampleTerrainCrestYNorm(profile, xNorm)` — interpola la cresta 0..1.
- `terrainCrestOffsetPx(profile, xPercent, terrainHeightPx)` — offset CSS desde el fondo del escenario.
- `mountFantasyTerrainLayer` devuelve `{ destroy, profile }`.
- `mountFantasyElement` aplica `bottom` según la cresta en `xPercent`.

## 5. Ciclo de vida

Tiempos específicos `forest` en `planLifecycleTiming`:

| Fase | Rango |
| --- | --- |
| partDurationMs | 240–420 ms |
| holdMs | 16 000–26 000 ms |
| erodeMs | 5500–9000 ms |

Construcción: cada árbol crece como unidad con **desfase** de 48 ms entre árboles (`FOREST_TREE_STAGGER_MS`).

## 6. Escena

- Spawn aleatorio ~22 % de ciclos (junto a castillos y acantilados).
- Dev: `?fantasyDev=forest&fantasySeed=N`

## 7. Criterios de aceptación

- [x] Determinismo por semilla.
- [x] `isValidFantasyElement` para 30+ semillas.
- [x] Cada árbol: exactamente 1 tronco + 1 copa.
- [x] Copas con `buildSequence` > tronco del mismo árbol.
- [x] Variación compact/extensive y mezcla de especies.
- [x] Tests en `web/tests/loader-fantasy-trees.test.js` y `loader-fantasy-forest.test.js`.
