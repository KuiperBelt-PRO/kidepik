# Spec: FX mágicos en cristales (piloto loader fantasía)

> Estado: **propuesta** (jul 2026) — pendiente de aprobación del usuario  
> Motor FX: [SPEC_LOADER_FX_ENGINE.md](SPEC_LOADER_FX_ENGINE.md)  
> Host: [SPEC_LOADER_FANTASY_CRYSTALS.md](SPEC_LOADER_FANTASY_CRYSTALS.md) (implementado)  
> Fase: **FX-1** del [plan de ejecución](../tasks/LOADER_FX_EXECUTION_PLAN.md)

## 1. Contexto

Los cristales del loader son siluetas blancas procedurales con animación de **cristalización** (overshoot) y erosión tipo **sublimación**. La spec del host ya menciona un micro-brillo opcional en holding; este documento define el **primer piloto** del motor FX: efectos mágicos verde–dorado que refuercen la lectura de «cristal encantado» sin romper el lenguaje blanco del motor.

## 2. Objetivo

Al montar un `FantasyElement` con `kind === 'crystals'`, añadir una capa de FX que:

1. Celebre el **fin de la construcción** con un destello breve.
2. Mantenga **vida mágica** durante `holding` (brillo en aristas + motas).
3. Acompañe la **erosión** con chispas que se desprenden hacia arriba.

## 3. Principios visuales

| Principio | Decisión |
| --- | --- |
| Paleta | Verde primario `#3DDB7E`, dorado `#F0C14A`, blanco puro en núcleos de chispa |
| Intensidad | Media-baja: visible en 390×844 sin saturar el clúster |
| Estilo | «Polvo de hadas» + destellos en **aristas** (no aura blob genérica) |
| Coherencia | Misma semilla → mismos puntos de spawn y ritmos |
| Logo | Partículas no se acumulan sobre el anillo central (clip/máscara del host) |

### Wire ASCII (vista lateral del clúster en hold)

```
        ✦     ✦          ← sparkles en puntas
       ╱╲ ✧ ╱╲
      ╱  ╲╱  ╲    ·  ·   ← motes flotantes
     ╱    ╳    ╲  ·
    ▔▔▔▔▔▔▔▔▔▔▔▔
   ──≈≈ shimmer ≈≈──     ← líneas de borde (stroke glow muy fino)
```

## 4. Catálogo de efectos (receta `crystals`)

| ID | Tipo | Fase | Descripción |
| --- | --- | --- | --- |
| `cryst_burst` | `burst` | `building_end` | 8–14 micro-chispas radiales desde centroides de prismas; duración 280–420 ms |
| `cryst_shimmer` | `edge_shimmer` | `holding` | Stroke glow alternando verde/dorado en aristas largas; ciclo 2,4–3,6 s |
| `cryst_motes` | `mote` | `holding` | 6–12 motas lentas ascendentes ±15 px; respawn al salir del bbox |
| `cryst_scatter` | `scatter` | `eroding` | 12–20 chispas con drift vertical negativo; fade con progreso de erosión |

### 4.1 `cryst_burst` (cristalización)

- **Trigger:** último frame de fase `building` del host (callback `building_end`).
- Spawn en **puntas** de cada `FantasyPart` con `role === 'crystal'` (vértice con `y` mínimo en viewBox).
- Velocidad radial: 24–48 u/s en espacio viewBox; desaceleración exponencial.
- Opacidad: pico 0.9 → 0 en `durationMs`.
- Sin sonido (FX-D5).

### 4.2 `cryst_shimmer` (holding)

- Para cada cristal: extraer el **segmento largo** (arista entre dos vértices no adyacentes al suelo con longitud máxima).
- Path duplicado en capa `.loader-fx-layer` con:
  - `stroke: var(--fx-fantasy-primary)` / `var(--fx-fantasy-secondary)` alternado por `seed`.
  - `stroke-width: 0.35–0.6` u viewBox; `vector-effect: non-scaling-stroke` en pantalla.
  - Opacidad pulsada: 0.15–0.45 (`sin` lento).
- No aplicar shimmer a la roca (`rock_base` / masa de anclaje si existe como part separada).

### 4.3 `cryst_motes` (holding)

- Partículas circulares 1,5–2,5 px (CSS) o `r=0.4` u (SVG).
- Color: 70 % verde, 30 % dorado por seed.
- Movimiento: deriva vertical −6..−14 px/s + jitter horizontal ±4 px/s.
- Respawn en borde inferior del bbox del clúster cuando `y` sale por arriba.
- Opacidad base 0.25–0.55 con parpadeo lento.

### 4.4 `cryst_scatter` (erosión)

- Al entrar en `eroding`, spawn continuo throttled (cada 40–70 ms) hasta `t > 0.85` de erosión.
- Origen: puntos aleatorios sobre aristas (misma fuente que shimmer), ponderados por `weight`.
- Velocidad inicial hacia arriba (−y): 20–40 u/s; dispersión lateral.
- Opacidad ligada a `(1 - erosionThreshold)` del host para que desaparezcan con la silueta.

## 5. Anclas

### 5.1 Derivación automática (FX-D3)

Módulo `loader-fx-crystals.js` exporta:

```js
/**
 * @param {import('./loader-fantasy-element.js').FantasyElement} element
 * @returns {import('./loader-fx-anchors.js').FxAnchor[]}
 */
export function extractCrystalFxAnchors(element);
```

Reglas:

| Anchor `role` | Origen |
| --- | --- |
| `crystal_tip` | Vértice superior de cada part `crystal` |
| `crystal_edge` | Segmento largo del prisma (para shimmer/scatter) |
| `cluster_core` | Centroide de tips; peso 0.5 (burst secundario opcional) |

Mínimo: **1 tip por cristal**; en seeds con cristales secundarios, tips de secundarios incluidos.

### 5.2 Validación

- Tips dentro de `[0,100]×[0,100]` tras normalización.
- Distancia tip–tip > 2 u (evitar duplicados por jitter numérico).

## 6. Receta y API

```js
/**
 * @param {import('./loader-fantasy-element.js').FantasyElement} element
 * @param {number} seed
 * @param {{ intensity?: number }} [opts]
 * @returns {import('./loader-fx-engine.js').FxRecipe}
 */
export function planCrystalMagicFx(element, seed, opts);
```

Valores por defecto (`intensity = 1`):

| Efecto | `particleBudget` | `intensity` escala |
| --- | --- | --- |
| `cryst_burst` | 12 | cuenta de chispas |
| `cryst_motes` | 10 | cuenta + opacidad |
| `cryst_scatter` | 18 | tasa de spawn |
| `cryst_shimmer` | n/a (paths) | opacidad stroke |

`FantasyElement.meta.fxProfile`:

| Valor | Comportamiento |
| --- | --- |
| omitido / `'default'` | Receta completa |
| `'subtle'` | `intensity 0.55`; sin burst |
| `'none'` | Sin FX |

## 7. Integración en render

En `mountFantasyElement` (`loader-fantasy-render.js`):

1. Tras `createElementSvg`, si `FX_RECIPE_BUILDERS.crystals` y `meta.fxProfile !== 'none'`:
   ```js
   const fx = mountFxBundle(el, svg, planCrystalMagicFx(element, element.seed), { reducedMotion });
   ```
2. Al completar build (antes de `setTimeout` de hold): `fx?.onPhase('building_end')`; `fx?.onPhase('holding')`.
3. En `startEroding`: `fx?.onPhase('eroding')`.
4. En `destroy`: `fx?.destroy()`.

Capa DOM:

```
.loader-fantasy-el
  ├── svg.loader-fantasy-el__svg   (silueta blanca)
  └── svg.loader-fx-layer          (partículas + shimmer; pointer-events: none)
```

## 8. CSS (tokens)

En `loader.css`:

```css
.loader-fantasy-el {
  --fx-fantasy-primary: #3ddb7e;
  --fx-fantasy-secondary: #f0c14a;
  --fx-fantasy-glow: rgba(61, 219, 126, 0.4);
  --fx-pulse: 0.35;
}
```

Animación `@keyframes loader-fx-pulse` para `--fx-pulse` (holding).

## 9. Variación por `style` de cristales

| `style` | Matiz FX |
| --- | --- |
| `shard` | Burst más intenso (+15 % chispas); shimmer más contrastado |
| `geode` | Más motes (+3); burst más corto |
| `floatingShards` | Motes con drift vertical un poco mayor (cristales elevados) |

## 10. Ciclo de vida temporal (orientativo)

| Evento | Offset desde inicio host |
| --- | --- |
| `building_end` / burst | t = fin build (~1,3–2,1 s) |
| `holding` / shimmer+motes | inmediato tras burst → `holdMs` (2,5–4,5 s) |
| `eroding` / scatter | `holdMs` → `holdMs + erodeMs` |

Sin solapar burst con el último overshoot de escala (esperar `allDone` del build).

## 11. Tests (`node --test`)

Archivo: `web/tests/loader-fx-crystals.test.js`

1. **Determinismo:** misma seed + mismo element → misma `FxRecipe`.
2. **Anclas:** 30 seeds de `generateCrystals` → ≥ 4 tips (mínimo cristales primarios).
3. **Presupuesto:** suma `particleBudget` ≤ 32.
4. **Estilos:** `shard` vs `geode` cambian al menos un parámetro de receta.
5. **`fxProfile: 'none'`** → `planCrystalMagicFx` devuelve `null` o receta vacía.
6. **Segmentos:** cada `crystal_edge` longitud > 3 u.

## 12. Validación navegador

| Caso | URL / pasos | Esperado |
| --- | --- | --- |
| Feliz | `?fantasyDev=crystals&fantasySeed=42&fxDev=1` | Burst al terminar build; shimmer visible en hold |
| Erosión | Esperar ciclo completo | Chispas ascendentes durante erode |
| Reduced motion | `prefers-reduced-motion: reduce` | Sin capa `.loader-fx-layer` |
| Rendimiento | 3 ciclos seguidos | Sin warning consola; FPS estable |

Capturas:

- `tmp/playwright-output/loader-fx-crystals-hold.png`
- `tmp/playwright-output/loader-fx-crystals-erode.png`

## 13. Criterios de aceptación

- [ ] Efectos legibles en móvil 390×844 sin tapar el logo.
- [ ] Paleta verde–dorado coherente con fantasía (no azul space).
- [ ] Sincronización correcta build → hold → erode.
- [ ] Determinismo y tests en verde.
- [ ] `destroy()` sin nodos `.loader-fx-*` residuales.
- [ ] **Visto bueno del usuario** tras revisión visual.

## 14. Fuera de alcance (este piloto)

- FX en cristales de **space opera** (cristales de energía sci-fi) → receta futura `planCrystalSciFiFx` en FX-2.
- Cambiar geometría o color de relleno de `loader-fantasy-crystals.js`.
- Partículas **dentro** del volumen del prisma (solo superficie/aristas).

## 15. Aprobación

- [ ] Usuario aprueba catálogo de efectos (burst, shimmer, motes, scatter).
- [ ] Usuario aprueba intensidad y paleta.
- [ ] OK para implementar **FX-1** tras **FX-0** (o FX-0+1 en un solo gate si se prefiere).
