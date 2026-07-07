# Spec: Cristales mágicos (builder de fantasía)

> Estado: **implementada** (jul 2026) — pendiente visto bueno visual  
> Motor: [SPEC_LOADER_FANTASY_ENGINE.md](SPEC_LOADER_FANTASY_ENGINE.md)  
> Catálogo: [SPEC_LOADER_FANTASY_ELEMENTS_CATALOG.md](SPEC_LOADER_FANTASY_ELEMENTS_CATALOG.md) §5  
> Fase: **6** del [plan de ejecución](../tasks/LOADER_FANTASY_ENGINE_EXECUTION_PLAN.md)  
> Decisión D5: partes con `baseY` despegado del suelo **permitidas** (cristales flotantes)

## 1. Contexto

Racimo de **prismas afilados** que emergen de una base rocosa común. Estética geométrica “brillante” expresada solo con silueta blanca y **facetas** como sustracciones finas (`evenodd`).

Primer elemento del motor con:

- Formas **afiladas** (no bloques arquitectónicos).
- Posible **levitación** parcial (`baseY` > suelo del clúster).
- Animación de build con **overshoot** más marcado (“cristalización”).

## 2. Modelo de generación

### 2.1 Anatomía

```
        ╱╲   ╱╲
       ╱  ╲ ╱  ╲     ← prismas (cristales)
      ╱    ╳    ╲
     ╱   ╱ ╲     ╲
    ▔▔▔▔▔▔▔▔▔▔▔▔▔    ← base rocosa común (rock_base)
──────────────────────  suelo (terreno)
```

| Rol (`role`) | Descripción |
| --- | --- |
| `rock_base` | Masa irregular baja que ancla el clúster al suelo. Obligatoria. |
| `crystal` | Prisma alargado con punta. 4–9 por clúster. |
| `facet` | (Opcional) Sustracción fina dentro del `d` del cristal — línea/plano de faceta |
| `fallen_shard` | Cristal pequeño tumbado en la base (opcional, 0–3) |

Cada cristal = un `FantasyPart` con `d` que concatena contorno exterior + 0–2 facetas internas como huecos.

### 2.2 Parámetros de variación

| Parámetro | Rango | Efecto |
| --- | --- | --- |
| Nº prismas | 4–9 | Densidad del racimo |
| Altura prismas | 0.35–1.0 × altura del clúster | Skyline irregular |
| Ángulo | ±15–55° respecto a vertical | Abanico asimétrico |
| `imperfection` | 0.35–0.75 (default ~0.55) | Irregularidad de punta y anchura |
| Cristales flotantes | 0–2 por clúster | `baseY` local > `rock_base` top; permitido por D5 |
| `fallen_shard` | 0–3 | Pequeños, casi horizontales, en la base |

### 2.3 Variantes `style`

| `style` | Descripción | Sesgos |
| --- | --- | --- |
| `shard` | Afilados altos, pocos prismas grandes | Altura máxima, ángulos amplios |
| `geode` | Agrupación compacta tipo geoda abierta | Más prismas (7–9), base más ancha, alturas medias |
| `floatingShards` | Algunos prismas elevados | 1–2 `crystal` con `baseY` despegado; 40 %+ seeds |

### 2.4 Geometría de prisma

Helper en `loader-fantasy-crystals.js` (usa `polygon` + `jitterRing` ligero en la punta):

```js
/**
 * Prisma con punta en espacio local y-up.
 * @returns {{ outer: Point[]; facets: Point[][] }}
 */
export function crystalPrism(rng, cx, baseY, height, width, tiltDeg, facetCount): ...;
```

- Contorno: trapecio inferior + dos aristas convergentes a punta (o punta truncada con jitter).
- Facetas: 1–2 segmentos internos como polígonos huecos muy finos (ancho < 8 % del prisma).
- **Prohibido**: curvas suaves tipo cúpula; solo facetas planas.

### 2.5 Disposición

- Abanico asimétrico alrededor de `cx ≈ 50` (local).
- Cristal **dominante** (el más alto) desplazado del centro (~60 % seeds hacia un lado).
- Solapamiento permitido entre prismas (profundidad por orden de pintado = `buildOrder`).

### 2.6 API

```js
/**
 * @param {{
 *   seed: number;
 *   style?: 'shard' | 'geode' | 'floatingShards';
 *   imperfection?: number;
 * }} options
 * @returns {import('./loader-fantasy-element.js').FantasyElement}
 */
export function generateCrystals(options);

/** @param {number} seed @returns {'shard' | 'geode' | 'floatingShards'} */
export function planCrystalStyle(seed);
```

Registro: `FANTASY_BUILDERS.crystals = generateCrystals`.

`kind` del elemento: `'crystals'` (singular en registry, plural en nombre de archivo).

## 3. Orden de construcción

1. `rock_base` — primera pieza (asienta el clúster).
2. `fallen_shard` (si hay) — junto al suelo, antes o en paralelo con prismas bajos.
3. `crystal` por `baseY` ascendente; a igual `baseY`, por altura creciente.
4. Cristales flotantes: mismo criterio; el escalado nace de **su propia base** (D5), no del suelo global.

**Animación (matiz respecto al motor):**

- Overshoot de escala en build: `cubic-bezier` con pico ~1.12–1.18 (vs ~1.05 castillo).
- Implementación: easing por kind en `mountFantasyElement` o meta `buildOvershoot: 1.15` en `FantasyElement.meta`.

## 4. Ciclo de vida

Entrada en `planLifecycleTiming` para `kind === 'crystals'`:

| Parámetro | Rango |
| --- | --- |
| `partDurationMs` | 160–280 |
| `holdMs` | 2500–4500 |
| `erodeMs` | 1400–2000 |
| `gapMs` | 400–1200 |

Build total orientativo: **1300–2100 ms**.

### Erosión

- Disolución global estándar.
- Variante preferente: **sublimación** — `baseFrequency` más **alta** que castillos (~1.3–1.6× default) para borde más fino/polvoriento.
- Implementación: `erosionMaskNoiseParams(seed, 'crystals')` o flag en `meta.erosionProfile: 'fine'`.

### Holding

- Sin pulso obligatorio en v1.
- Opcional: micro-brillo de opacidad 0.92–1.0 en el clúster completo (solo si no impacta rendimiento).

### Reduced motion

Fade-in → hold → fade-out; sin overshoot ni pulso.

## 5. Escena (integración futura — Fase 8)

| Aspecto | Decisión v1 |
| --- | --- |
| Zona | Centro (ranura alternativa a bosque/edificio/megalito) |
| Frecuencia spawn | ~10–15 % de ciclos |
| Altura en pantalla | Fracción 0.18–0.30 del layer; 52–115 px |
| Dev | `?fantasyDev=crystals&fantasySeed=N` |

Convive bien con bosques (contraste geométrico vs orgánico) y megalitos (piedra natural vs cristal).

## 6. Ficheros

| Fichero | Responsabilidad |
| --- | --- |
| `web/js/components/loader-fantasy-crystals.js` | `generateCrystals`, `crystalPrism`, `planCrystalStyle` |
| `web/js/components/loader-fantasy-element.js` | Registro + timings |
| `web/js/components/loader-fantasy-render.js` | (opcional) overshoot y erosión fina por kind |
| `web/tests/loader-fantasy-crystals.test.js` | Tests |

## 7. Tests (`node --test`, sin DOM)

1. **Determinismo** y **variación** (40 seeds).
2. **Validez**: `isValidFantasyElement` en 30+ seeds.
3. **Invariantes**:
   - Exactamente **1** `rock_base`.
   - **4–9** piezas con `role === 'crystal'`.
   - Cada cristal: `d` con ≥ 1 subpath (contorno válido).
   - ≥ 50 % de seeds con al menos 1 faceta (subpath extra o meta).
4. **Estilos**: `planCrystalStyle` distribuye los 3 estilos en 60 seeds (ninguno < 10 %).
5. **`floatingShards`**: cuando `style === 'floatingShards'`, ≥ 1 cristal con `baseY` > `rock_base` top + ε.
6. **Build order**: `rock_base` primero; prismas por `baseY` ascendente.
7. **Asimetría**: centroide de prismas desplazado > 5 % del ancho en ≥ 70 % seeds.

## 8. Criterios de aceptación

- [ ] Clúster reconocible como cristales afilados en móvil 390×844.
- [ ] Animación de “cristalización” (overshoot visible, no exagerado).
- [ ] `floatingShards` muestra levitación sin atravesar el logo.
- [ ] Erosión fina/sublimación perceptible.
- [ ] Dev flag y tests en verde.
- [ ] Playwright: build → hold → erode en `tmp/playwright-output/`.
- [ ] **Visto bueno del usuario**.

## 9. Aprobación

- [ ] Usuario aprueba estilos y regla D5 (flotantes).
- [ ] OK para implementar Fase 6.
