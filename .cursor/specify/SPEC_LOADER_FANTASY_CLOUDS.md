# Spec: Nubes de fantasía — mitad inferior del loader

> Estado: **implementada** (jul 2026)  
> Relacionado: [SPEC_LOADER_SCREEN.md](SPEC_LOADER_SCREEN.md), [SPEC_LOADER_FANTASY_ENGINE.md](SPEC_LOADER_FANTASY_ENGINE.md), [ELEMENTS_ENGINE_SPECS.md](ELEMENTS_ENGINE_SPECS.md)

## Contexto

La mitad fantasía del loader tiene terreno, castillos y acantilados anclados al suelo. Falta ambiente de **cielo** con nubes blancas que crucen lentamente el horizonte sin competir con el logo central ni con las siluetas del suelo.

## Objetivo

Añadir **nubes procedurales** que entren por la **derecha** y salgan por la **izquierda**, a velocidades lentas e independientes, con variación de altura, tamaño y silueta.

## Principios de diseño

| Principio | Decisión |
| --- | --- |
| Dirección | **Derecha → izquierda** (opuesto a meteoritos space) |
| Velocidad | **Lenta**; cada nube con `durationMs` propio (22–52 s de cruce) |
| Altura | Banda vertical acotada: **no** alcanzar el anillo/logo; **no** demasiado bajas (evitar terreno/castillos) |
| Tamaño | 3 clases (`small`, `medium`, `large`) con anchos 52–148 px |
| Forma | Silueta procedural (3–6 bultos semielípticos); distinta por semilla |
| Concurrencia | Spawn continuo; máx. **6** nubes simultáneas |
| Paleta | Blanco `#fff`; opacidad 0,32–0,72 |
| Capa | Mitad fantasía (`inset: 50% 0 0 0`); z-index **1** (detrás de castillos `2`) |
| Máscara | Radial en el borde superior de la capa (excluye zona del logo, como órbitas space) |
| Accesibilidad | `prefers-reduced-motion`: capa desactivada |

## Comportamiento

### Trayectoria

| Parámetro | Valor |
| --- | --- |
| Origen X | `108 %` – `118 %` del ancho del layer |
| Destino X | `-8 %` – `-18 %` |
| Origen Y | `18 %`–`50 %` de la altura del layer (desde el borde superior de la mitad fantasía) |
| Movimiento | `translate` lineal; sin rotación |

### Spawn

| Parámetro | Valor |
| --- | --- |
| Retardo inicial | 1,5–4 s |
| Intervalo entre spawns | 2,5–7 s (si hay hueco bajo el máximo) |
| Máximo concurrente | **6** |

### Clases de tamaño

| Clase | Ancho (px) | Peso |
| --- | --- | --- |
| `small` | 52–78 | 40 % |
| `medium` | 78–112 | 40 % |
| `large` | 112–148 | 20 % |

## API (`loader-fantasy-clouds.js`)

- `generateCloudPath(rng)` → `string` (path SVG)
- `createCloudParams(rng)` → `CloudParams`
- `cloudPoseAt(params, layerW, layerH, t)` → `{ x, y, opacity }`
- `mountFantasyCloudsLayer(container, opts)` → `{ destroy }`

## Integración

- `loader-chrome.js` monta la capa tras el terreno y antes de la escena de fantasía.
- Query `?cloudDemo=1` acelera spawns (desarrollo).

## Tests

`web/tests/loader-fantasy-clouds.test.js` — determinismo, bandas Y/X, opacidad, forma no vacía.
