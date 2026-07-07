# Spec: Horizonte de fondo fantasía — montañas y colinas persistentes

> Estado: **aprobada** (jul 2026)  
> Relacionado: [SPEC_LOADER_FANTASY_TERRAIN.md](SPEC_LOADER_FANTASY_TERRAIN.md), [SPEC_LOADER_FANTASY_CLOUDS.md](SPEC_LOADER_FANTASY_CLOUDS.md), [SPEC_LOADER_SCREEN.md](SPEC_LOADER_SCREEN.md)

## Contexto

El terreno blanco inferior ancla castillos y bosques al suelo. Falta **profundidad atmosférica**: un horizonte lejano (colinas o montañas) que permanezca durante toda la sesión del loader, detrás de nubes, cielo, escena y suelo.

## Objetivo

Capa **persistente** (como el terreno) con siluetas procedurales de **todo el ancho**, **baja opacidad**, **detrás de todo** en la mitad fantasía.

## Principios de diseño

| Principio | Decisión |
| --- | --- |
| Persistencia | Una silueta por montaje de loader; no ciclo de vida como castillos |
| Cobertura | Ancho completo del viewport (mitad fantasía) |
| Opacidad | Baja: capas 0,06–0,18 (blanco `#fff`) |
| Capa | `z-index: 0` en mitad fantasía; debajo de terreno (`1`), nubes y escena (`2`) |
| Variación | Tipo y forma distintos en cada recarga (semilla de sesión) |
| Tipos | `rolling_hills`, `layered_hills`, `distant_peaks`, `serrated_range`, `mesa_horizon` |
| Animación | Estático (`prefers-reduced-motion` sin cambio) |
| Rendimiento | SVG + paths rellenos; `ResizeObserver` |

## Tipos de horizonte

| Tipo | Descripción |
| --- | --- |
| `rolling_hills` | Colinas redondeadas, ondulación suave |
| `layered_hills` | 3 planos superpuestos (lejano → cercano) |
| `distant_peaks` | Picos triangulares lejanos (relieve ~50 % del original) |
| `serrated_range` | Cordillera dentada ancha (relieve ~50 % del original) |
| `mesa_horizon` | Mesetas con tapas planas (relieve ~50 % del original) |

## Comportamiento

- Perfil normalizado `x: 0..1`, `y: 0..1` (0 = cielo, 1 = línea de horizonte inferior del layer).
- Picos entre **38 % y 52 %** de la altura del layer (horizonte bajo, no invade el logo).
- Valles entre **78 % y 94 %**.
- `pickBackdropKind(rng)` elige tipo con pesos equilibrados.
- Query dev opcional: `?backdropKind=rolling_hills` fuerza tipo en desarrollo.

## Integración

| Fichero | Rol |
| --- | --- |
| `web/js/components/loader-fantasy-backdrop.js` | Generación + `mountFantasyBackdropLayer` |
| `web/css/scenes/loader.css` | `.loader-layer--fantasy-backdrop` |
| `web/js/components/loader-chrome.js` | Montar antes del terreno |
| `web/tests/loader-fantasy-backdrop.test.js` | Tests unitarios |

## Criterios de aceptación

1. Capa visible en 390×844 con opacidad sutil.
2. Silueta distinta entre recargas.
3. Cinco tipos generan paths válidos y distintos.
4. `destroy()` limpia DOM y observer.
5. Tests pasan.

## Fuera de alcance

- Parallax o animación del horizonte.
- Colores distintos del blanco (v1).
- Horizonte en mitad space.

## Aprobación

- [x] Usuario solicita implementación vía SDD kidepik.
- [x] OK para implementar.
