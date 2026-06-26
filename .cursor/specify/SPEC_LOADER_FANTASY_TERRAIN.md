# Spec: Terreno fantasía — base inferior del loader

> Estado: **aprobada** (jun 2026)  
> Relacionado: [SPEC_LOADER_SCREEN.md](SPEC_LOADER_SCREEN.md), capa space (`loader-space-orbit.js`)

## Contexto

La mitad inferior del loader es la zona **fantasía** (bosque, runas). La franja superior concentra el space opera (órbitas, meteoritos, naves). Falta un ancla visual en la base de fantasía que refuerce el suelo del mundo encantado sin competir con el logo central.

## Objetivo

Añadir un **suelo procedural** blanco sólido en la base de la mitad fantasía: terreno llano con silueta ligeramente irregular que **abarca todo el ancho** y **cambia en cada recarga**.

## Principios de diseño

| Principio | Decisión |
| --- | --- |
| Estética | Mismo lenguaje que planetas y naves: **blanco sólido `#fff`** |
| Forma | Franja de suelo; borde superior **casi plano** con ondulación suave (no montañas) |
| Cobertura | De borde izquierdo a borde derecho del viewport |
| Variación | Silueta distinta en cada montaje (semilla aleatoria por sesión de loader) |
| Capa | Base de la mitad fantasía (`bottom 0`, altura ~12–16 % viewport) |
| Accesibilidad | Estático; visible también con `prefers-reduced-motion` |
| Rendimiento | Un SVG + un `path` relleno; sin canvas ni assets raster |

## Composición (wire ASCII)

Vista mitad inferior fantasía:

```
  ·  ✦  runas / bosque (arte de fondo)
  ·        ·
  ═══════════════════════════════  ← borde superior terreno (irregular suave)
  ████████████████████████████████  ← relleno blanco sólido
  ████████████████████████████████
                    ( logo — zona central, encima )
```

## Comportamiento

### Generación procedural

| Parámetro | Valor |
| --- | --- |
| Segmentos horizontales | **10–18** (aleatorio) |
| Altura de franja | **12–16 %** del viewport (`clamp`) |
| Cresta (borde superior) | Entre **35 % y 65 %** de la altura de la franja |
| Rugosidad vertical | **6–22 %** de la altura de la franja (jitter por punto) |
| Suavizado | Polilínea; sin picos agudos tipo sierra |

El path SVG cierra: esquina inferior izquierda → cresta izq→der → esquina inferior derecha.

### RNG

Reutilizar `loader-ship-rng.js` (`createRng`, `randRange`). Semilla por defecto: `Date.now()` mezclado con `Math.random()` al montar.

### Redimensionado

`ResizeObserver` sobre la capa: regenerar `viewBox` y `d` del path (misma semilla → misma forma relativa; al cambiar ancho se reescala).

## Integración técnica

### Ficheros

| Fichero | Responsabilidad |
| --- | --- |
| `web/js/components/loader-fantasy-terrain.js` | `buildTerrainPath`, `mountFantasyTerrainLayer`, `destroy()` |
| `web/css/scenes/loader.css` | `.loader-layer--fantasy-terrain`, `.loader-fantasy-terrain__svg`, `.loader-fantasy-terrain__fill` |
| `web/js/components/loader-chrome.js` | Invocar `mountFantasyTerrainLayer(layers)` |
| `web/tests/loader-fantasy-terrain.test.js` | Tests del generador de path |

### Montaje DOM

```
.loader-layers
  ├── .loader-layer--bg
  ├── .loader-layer--accent (fantasy / space)
  ├── .loader-layer--space-orbit
  ├── .loader-layer--meteor-shower
  ├── .loader-layer--fantasy-terrain (nuevo, z-index 1, bottom)
  └── …
```

### API

```js
/**
 * @param {HTMLElement} container
 * @param {{ rng?: () => number }} [options]
 * @returns {{ destroy: () => void }}
 */
export function mountFantasyTerrainLayer(container, options);
```

## Criterios de aceptación

1. Viewport **390×844**: franja blanca visible en la base de la pantalla.
2. El terreno **cubre todo el ancho** (sin huecos laterales).
3. Silueta **distinta** entre dos recargas completas (smoke visual).
4. Borde superior **predominantemente llano** (variación ≤ ~22 % de la franja).
5. Sin errores consola al montar / destruir loader.
6. `destroy()` elimina capa y desconecta observer.
7. Tests en `web/tests/loader-fantasy-terrain.test.js` pasan.

## Fuera de alcance

- Árboles, castillos o props encima del terreno.
- Parallax o animación del suelo.
- Colores verde/dorado (solo blanco sólido en v1).
- Terreno en la mitad space.

## Aprobación

- [x] Usuario aprueba estilo blanco sólido y variación por recarga.
- [x] OK para implementar.
