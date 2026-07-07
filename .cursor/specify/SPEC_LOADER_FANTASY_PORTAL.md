# Spec: Portales mágicos y círculos rúnicos (builder de fantasía)

> Estado: **propuesta** (jul 2026) — pendiente de aprobación del usuario  
> Motor: [SPEC_LOADER_FANTASY_ENGINE.md](SPEC_LOADER_FANTASY_ENGINE.md)  
> Catálogo: [SPEC_LOADER_FANTASY_ELEMENTS_CATALOG.md](SPEC_LOADER_FANTASY_ELEMENTS_CATALOG.md) §6  
> Fase: **7** del [plan de ejecución](../tasks/LOADER_FANTASY_ENGINE_EXECUTION_PLAN.md)  
> Decisión D6: **vano estático** — el hueco central no se anima; aparece a tamaño final con su pieza

## 1. Contexto

Marco de piedra o anillo rúnico con un **gran vano central** (sustracción `evenodd`) que deja ver el fondo del loader. Reinterpreta el ciclo de vida del motor:

| Fase motor | Significado en portal |
| --- | --- |
| `building` | El marco se levanta de abajo arriba; el **vano ya existe** a tamaño final en el `d` |
| `holding` | Portal “activo” y estable; micro-pulso opcional **solo del marco** |
| `eroding` | El marco colapsa por disolución global; el vano desaparece con el conjunto |

**No objetivos v1:**

- Animar el crecimiento del hueco.
- Contenido animado dentro del vano (energía, partículas).
- Interacción del usuario.

## 2. Modelo de generación

### 2.1 Anatomía

```
        ╭──────────╮
        │  runas   │     ← glifos (sustracciones finas en el marco)
     ╭──┤          ├──╮
     │  │  (vano)  │  │   ← hueco central — estático desde t=0 del build
     │  │          │  │
     ╰──┴──────────┴──╯
    ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔     ← basas / zócalo
──────────────────────────  suelo
```

| Rol (`role`) | Descripción |
| --- | --- |
| `footing` | Basas o zócalo inferior (1–2 piezas). Opcional en `runeRing`. |
| `frame` | Marco principal (arco, anillo o grieta). Incluye el vano como hueco `evenodd`. |
| `lintel` | Dintel o travesaño superior (opcional en `gateArch`) |
| `rune_stone` | Piedra pequeña del anillo (`runeRing` only) |
| `rune_glyph` | Glifos como sustracciones (pueden ir en el mismo `d` que `frame`) |

El **vano** no es una `FantasyPart` separada: es subpath hueco dentro de `frame` (o `lintel`+`frame` unidos).

### 2.2 Variantes `style`

| `style` | Silueta | Partes típicas |
| --- | --- | --- |
| `gateArch` | Arco gótico de piedra independiente (dos pilares + arco) | `footing`×2, `frame` (piernas+arco+vano), `lintel` opcional |
| `runeRing` | Círculo de piedras bajas con hueco central | 6–10 `rune_stone` + `frame` anular o piedras individuales con vano central común |
| `riftPortal` | Marco irregular tipo grieta/roca partida | 1–3 masas `frame` con borde dentado y vano central irregular |

### 2.3 Parámetros de variación

| Parámetro | Rango | Notas |
| --- | --- | --- |
| Anchura total | 28–44 u (local) | Más estrecho que castillo |
| Altura total | 38–58 u | Arco visible bajo el logo |
| Vano (ancho/alto) | 45–65 % / 55–75 % del marco | Siempre centrado-asimétrico (±5 % jitter) |
| Runas | 4–12 glifos | Líneas angulares cortas; sustracción |
| `imperfection` | 0.4–0.7 | Piedras desiguales; arco no simétrico |
| Inclinación global | `tiltDeg` 0–3° | Ligera; `riftPortal` hasta 5° |

### 2.4 Vano estático (D6)

- El contorno exterior del marco y el anillo del vano se generan juntos en el mismo `d` con `fill-rule="evenodd"`.
- Durante `building`, al escalar una pieza `frame`, **el hueco escala con ella** (comportamiento estándar del motor §3.3) — pero el vano está a **proporción final** desde el primer frame visible de la pieza (no hay fase de “apertura” posterior).
- **No** añadir lógica de interpolación de radio del vano en `loader-fantasy-render.js`.

### 2.5 Runas / glifos

- Trazos rectos o en ángulo (3–8 segmentos por glifo).
- Emitidos como huecos finos en el marco (grosor ~0.4–1.2 u local).
- Distribución irregular; nunca simétrica perfecta.

### 2.6 API

```js
/**
 * @param {{
 *   seed: number;
 *   style?: 'gateArch' | 'runeRing' | 'riftPortal';
 *   imperfection?: number;
 * }} options
 * @returns {import('./loader-fantasy-element.js').FantasyElement}
 */
export function generatePortal(options);

/** @param {number} seed @returns {'gateArch' | 'runeRing' | 'riftPortal'} */
export function planPortalStyle(seed);
```

Registro: `FANTASY_BUILDERS.portal = generatePortal`.

## 3. Orden de construcción

1. `footing` / basas (si existen) — `baseY` mínimo.
2. Pilares o piedras del anillo — de abajo arriba o fondo→frente en `runeRing`.
3. `lintel` / arco superior — tras soportes.
4. `frame` principal si se divide en secciones (en `gateArch`: piernas antes que arco).
5. Runas: mismo `buildOrder` que la pieza que las alberga (no fase separada).

En `runeRing`, las piedras pueden animarse **una a una** (buildOrder escalonado) manteniendo el vano central en la pieza anular o en la última pieza que cierra el círculo — decisión de implementación: preferir **marco anular único** con vano precortado + piedras aditivas alrededor (más simple para D6).

## 4. Ciclo de vida

Entrada en `planLifecycleTiming` para `kind === 'portal'`:

| Parámetro | Rango | Notas |
| --- | --- | --- |
| `partDurationMs` | 200–360 | |
| `holdMs` | 3000–5000 | Portal activo visible |
| `erodeMs` | 1700–2500 | |
| `gapMs` | 500–1400 | |

Build total orientativo: **1600–2400 ms**.

### Holding — micro-pulso (opcional)

- Solo sobre el `<g>` raíz del elemento o piezas `frame` (no el vano aislado — no existe como nodo).
- Transform: `scale(1)` ↔ `scale(1.02)` en 2.5–4 s, `opacity` 0.94–1.0 alternado.
- Desactivado con `prefers-reduced-motion`.

### Erosión

- Máscara global estándar; el vano desaparece **con** el marco (no antes).
- Frecuencia de ruido media (default del motor).

### Reduced motion

- Fade-in del marco completo (vano incluido desde el inicio del fade).
- Hold sin pulso.
- Fade-out.

## 5. Escena (integración futura — Fase 8)

| Aspecto | Decisión v1 |
| --- | --- |
| Zona | **Centro preferente** (pieza focal; puede ocupar ranura de edificio ocasionalmente) |
| Frecuencia | ~8–12 % de ciclos (evento especial, menos frecuente que castillo) |
| Altura | Fracción 0.26–0.38 del layer; 68–130 px |
| Anti-solapamiento | No spawn si hay castillo activo en el centro (Fase 8) |
| Dev | `?fantasyDev=portal&fantasySeed=N` |

## 6. Ficheros

| Fichero | Responsabilidad |
| --- | --- |
| `web/js/components/loader-fantasy-portal.js` | `generatePortal`, helpers arco/anillo/grieta, `planPortalStyle` |
| `web/js/components/loader-fantasy-element.js` | Registro + timings |
| `web/js/components/loader-fantasy-render.js` | (opcional) pulso en holding por `kind === 'portal'` |
| `web/tests/loader-fantasy-portal.test.js` | Tests |

Reutiliza primitivas de `loader-fantasy-geom.js`: `arch` (gótico para `gateArch`), `polygon`, `jitterRing`, `aperture` solo si el vano es rectangular (`riftPortal`).

## 7. Tests (`node --test`, sin DOM)

1. **Determinismo** y **variación** (40 seeds).
2. **Validez**: `isValidFantasyElement` en 30+ seeds.
3. **Vano presente**: al menos una pieza `frame` (o equivalente) cuyo `d` contiene regla `evenodd` verificable (≥ 2 subpaths cerrados; área interior significativa).
4. **Estilos**: los 3 estilos aparecen en 60 seeds con `planPortalStyle`.
5. **Runas**: ≥ 4 sustracciones de glifo en ≥ 70 % seeds (conteo de subpaths o meta `runeCount`).
6. **Build order**: basas antes que arco; arco/lintel después de soportes.
7. **`gateArch`**: ≥ 2 piezas con `baseY` en suelo + 1 pieza de arco con `baseY` superior.
8. **`runeRing`**: 6–10 piedras o 1 anillo con ≥ 6 protuberancias en el `d`.
9. **Proporción vano**: área del hueco / área del marco ∈ [0.25, 0.55] (estimación por bounding boxes en tests).

## 8. Criterios de aceptación

- [ ] Vano visible desde el inicio del build de la pieza que lo contiene (D6).
- [ ] Tres estilos distinguibles en capturas Playwright.
- [ ] Holding: pulso sutil del marco sin “respirar” el hueco por separado.
- [ ] Erosión colapsa marco + vano juntos.
- [ ] Reduced-motion sin pulso.
- [ ] Dev flag y tests en verde.
- [ ] **Visto bueno del usuario** → habilita pulido Fase 8.

## 9. Aprobación

- [ ] Usuario confirma D6 (vano estático) y estilos `gateArch` / `runeRing` / `riftPortal`.
- [ ] OK para implementar Fase 7.
