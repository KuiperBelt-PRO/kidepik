# Spec: Acantilados y formaciones rocosas (builder de fantasía)

> Estado: **implementado** (jul 2026)
> Motor: [SPEC_LOADER_FANTASY_ENGINE.md](SPEC_LOADER_FANTASY_ENGINE.md)
> Referencia de calidad: [SPEC_LOADER_FANTASY_CASTLE.md](SPEC_LOADER_FANTASY_CASTLE.md)

## 1. Contexto

Formaciones **estrechas y altas** que enmarcan los bordes laterales de la mitad fantasía del loader. Comparten el ciclo de vida del motor: construcción progresiva → reposo → erosión global.

Solo dos subtipos en v1:

| Subtipo | `formationType` | Construcción |
| --- | --- | --- |
| **Acantilado** | `cliff` | Una masa vertical irregular que **crece** como un solo bloque (escala desde la base). |
| **Rocas apiladas** | `rocks` | 3–6 bloques irregulares **apilados** de abajo arriba (cada bloque anima por separado). |

## 2. Colocación en escena

- **Pared al borde:** la costura en `x=0` local coincide con el borde de pantalla; la masa continúa **fuera** del viewBox (no se corta).
- **Siempre ambos extremos:** un muro izquierdo y uno derecho; como máximo **uno activo por lado** (respawn solo tras erosión).
- Anclaje: `xPercent` 0 / 100, `preserveAspectRatio` `xMinYMax` / `xMaxYMax`.
- Normalización: `normalizeMode: 'wallSeam'`.

## 3. Silueta y proporciones

| Parámetro | Rango local (pre-normalizar) | Notas |
| --- | --- | --- |
| Anchura | 10–18 u | Estrecho; relación altura/anchura ≥ 3:1 |
| Altura sobre suelo | 52–78 u | Más alto que ancho |
| Imperfección | 0.5–0.78 | Aristas rocosas; **sin tramos verticales largos** |
| Masa exterior | `WALL_BLEED` ≈ 108 u | Continúa fuera de pantalla |
| Cara del acantilado | Lado exterior (hacia el borde de pantalla) | Perfil dentado con repisas |

## 4. API

```js
/**
 * @param {{
 *   seed: number;
 *   side: 'left' | 'right';
 *   formationType?: 'cliff' | 'rocks';
 *   terrainHeightPx?: number;
 *   cliffSizePx?: number;
 * }} options
 * @returns {import('./loader-fantasy-element.js').FantasyElement}
 */
export function generateCliffs(options);

/** Disposición lateral determinista por semilla de ciclo. */
export function planCliffSides(seed): { sides: ('left'|'right')[] };
```

Registrado como `FANTASY_BUILDERS.cliffs`.

## 5. Ciclo de vida

Usa `planLifecycleTiming` del motor con tiempos ampliados para `cliffs`:

- **hold:** 9–15 s · **erosión:** 13–20 s (frente al castillo ~2–5 s / ~7–11 s).

## 6. Criterios de aceptación

- [x] Determinismo por semilla.
- [x] `isValidFantasyElement` para 30+ semillas.
- [x] `cliff`: una sola pieza maciza principal.
- [x] `rocks`: ≥3 piezas con `buildSequence` estrictamente creciente.
- [x] Anchura normalizada < 40 % de la altura.
- [x] Escena: solo bordes; opción ambos lados simultáneos.
