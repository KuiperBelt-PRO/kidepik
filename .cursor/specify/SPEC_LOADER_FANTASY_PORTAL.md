# Spec: Portales mágicos — dolmen, arco románico y anillo circular + FX

> Estado: **aprobado e implementado** (jul 2026, v2 estilos)  
> Motor: [SPEC_LOADER_FANTASY_ENGINE.md](SPEC_LOADER_FANTASY_ENGINE.md)  
> FX: [SPEC_LOADER_FX_ENGINE.md](SPEC_LOADER_FX_ENGINE.md)  
> Fase: **7** del [plan de ejecución](../tasks/LOADER_FANTASY_ENGINE_EXECUTION_PLAN.md)

## 1. Alcance (tres estilos)

`planPortalStyle(seed)` elige de forma determinista uno de:

| Estilo | Silueta | Piezas |
| --- | --- | --- |
| **`dolmen`** | Dos rocas verticales + losa horizontal | 3 |
| **`romanesque`** | Dos columnas de piedra + arco de medio punto formado por **5–8 dovelas** | 7–10 |
| **`circular`** | Anillo tipo *stargate*: **7–11 piedras** distintas en elipse (hueco central) | 7–11 |

Distribución aproximada por semilla: **⅓** cada estilo.

| Fase motor | Comportamiento |
| --- | --- |
| `building` | Las tres piedras se levantan (izq → der → dintel) |
| `building_end` / inicio `holding` | **FX apertura**: el vano central se ilumina y el portal se forma |
| `holding` | Breve efecto “entre dos mundos” en el centro; **se desvanece** al poco tiempo |
| `eroding` | **FX cierre**: el portal se contrae y apaga antes/durante la disolución del dolmen |

**No objetivos:** `runeRing`, `riftPortal`; interacción usuario; animar la silueta blanca de las rocas.

## 2. Geometría dolmen

```
        ┌─────────────┐
        │   lintel    │
    ┌───┤             ├───┐
    │   │   (vano)    │   │  ← hueco libre entre uprights
    │ U │             │ U │
    └───┴─────────────┴───┘
    ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔  suelo
```

| Rol | Descripción |
| --- | --- |
| `upright_left` / `upright_right` | Rocas verticales **irregulares** (polígonos dentados + jitter) |
| `lintel` | Losa horizontal **irregular** (perfil ondulado arriba/abajo) |

Orden de build: `upright_left` → `upright_right` → `lintel`.

Parámetros (espacio local y-up, normalizado a viewBox):

| Parámetro | Rango |
| --- | --- |
| Altura uprights | 34–50 u |
| Ancho cada upright | 5–9 u |
| Ancho vano | 14–22 u |
| Altura lintel | 4–7 u |
| `imperfection` | 0.58–0.88 | Aristas muy irregulares |
| `scale` (`planPortalScale`) | 0.76–1.22 | Variación de tamaño por semilla |

`meta.aperture`: `{ cx, cy, w, h }` en coordenadas viewBox para anclas FX.

## 2b. Geometría arco románico (`romanesque`)

```
              ╭─○─○─○─╮   ← dovelas (arco de medio punto)
          ┌───┤       ├───┐
          │ U │ (vano)  │ U │
          └───┴─────────┴───┘
```

| Rol | Descripción |
| --- | --- |
| `upright_left` / `upright_right` | Columnas verticales irregulares (misma familia que dolmen) |
| `voussoir_0` … `voussoir_N` | Dovelas trapezoidales a lo largo del semicírculo superior |

Orden de build: columnas → dovelas de izquierda a derecha (ángulo π → 0).

| Parámetro | Rango |
| --- | --- |
| Altura columnas | 32–46 u |
| Ancho vano | 14–20 u |
| Dovelas | 5–8 |
| Grosor arco (radio ext. − int.) | 4–7 u |
| `imperfection` | 0.42–0.62 |

## 2c. Geometría anillo circular (`circular`)

Anillo elíptico tipo *stargate*: piedras verticales de tamaños distintos, hueco central para el FX.

| Rol | Descripción |
| --- | --- |
| `ring_stone_0` … `ring_stone_N` | Cuñas radiales irregulares entre radios interior y exterior |

| Parámetro | Rango |
| --- | --- |
| Piedras | 7–11 (impar ~65 % seeds) |
| Radio interior | 9–13 u |
| Grosor radial piedra | 3.5–6.5 u |
| Elipse | eje Y ≈ 0.62–0.78 × eje X |
| Hueco inferior | ~22–32° sin piedra (entrada visual) |

Orden de build: fondo del anillo → frente (por `sin(θ)` ascendente).

`meta.aperture`: centro del hueco elíptico interior.

## 3. FX portal (`loader-fx-portal.js`)

Receta `portal` en `FX_RECIPE_BUILDERS`:

| Efecto | Fase | Comportamiento |
| --- | --- | --- |
| `portal_rift` | `building_end` + `holding` | Apertura blanca semitransparente; **vertical alargado** (~1,4–1,6×); fade-out lento (~3,2–5,2 s) |
| `portal_rift` | `eroding` | Cierre: contracción + apagado (~0,9–1,4 s) |

Paleta FX: **blanco** con opacidad baja–media (sin verde/dorado en el vano).

`prefers-reduced-motion`: sin FX (noop bundle).

## 4. API

```js
export function generatePortal(options);
export function planPortalStyle(seed); // 'dolmen' | 'romanesque' | 'circular'
export const PORTAL_STYLES;
export function computePortalAperture(element);
```

Registro: `FANTASY_BUILDERS.portal = generatePortal`.

## 5. Dev y escena

- `?fantasyDev=portal&fantasySeed=N` — spawn centrado, hold extendido.
- Integración escena aleatoria: fase posterior (Fase 8).

## 6. Tests

- Determinismo y variación (30+ seeds).
- `isValidFantasyElement`.
- Dolmen: 3 piezas; uprights antes que lintel.
- Romanesque: columnas + ≥5 dovelas; columnas antes que dovelas.
- Circular: ≥7 `ring_stone_*`; build order por profundidad.
- `computePortalAperture` con área > 0 en los tres estilos.
- Receta FX válida y determinista para cada estilo.

## 7. Criterios de aceptación

- [x] Dolmen visible (2 verticales + 1 horizontal).
- [x] Arco románico: 2 columnas + varias dovelas en semicírculo.
- [x] Anillo circular: piedras distintas en elipse con vano central.
- [x] FX apertura al terminar build.
- [x] Efecto central que se forma y se desvanece en holding.
- [x] FX cierre en erosión.
- [x] Dev flag y tests en verde.
