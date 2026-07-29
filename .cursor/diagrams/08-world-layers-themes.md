# 08 — Capas de mundo y temas

**Specs:** [SPEC_WORLD_LAYERS_PERSISTENCE.md](../specify/SPEC_WORLD_LAYERS_PERSISTENCE.md), [SPEC_LOADER_SCREEN.md](../specify/SPEC_LOADER_SCREEN.md), [SPEC_LOADER_FANTASY_ENGINE.md](../specify/SPEC_LOADER_FANTASY_ENGINE.md), [SPEC_LOADER_FX_ENGINE.md](../specify/SPEC_LOADER_FX_ENGINE.md)

## Persistencia entre rutas

```mermaid
stateDiagram-v2
  [*] --> Mounted: mountWorldLayers en escena
  Mounted --> Parked: parkWorldLayersForHandoff
  Parked --> Remounted: adopt en nueva escena
  Remounted --> Mounted
  Mounted --> Destroyed: teardown sin worldHandoff
```

- Singleton de sesión: `web/js/lib/world-session.js`
- DOM capas: `web/js/components/world-layers.js` (`.loader-layers`)
- Mitad fantasía + mitad sci-fi (space) en la misma instancia

## Composición de capas (simplificado)

```mermaid
flowchart TB
  Layers[.loader-layers]
  Layers --> BG[bg + attenuate]
  Layers --> Fant[accent fantasy]
  Layers --> Space[accent space]
  Fant --> Terrain[terrain]
  Fant --> Backdrop[backdrop montañas]
  Fant --> Scene[castillos bosques cristales portales…]
  Fant --> Clouds[clouds]
  Fant --> Celestial[sol luna]
  Space --> Orbit[ships / orbit]
  Space --> Meteors[meteor shower]
  FX[loader-fx-engine] --> Hosts[anchors en hosts procedurales]
```

## Dos temas vs mundo niño

```mermaid
flowchart LR
  dataTheme["data-theme fantasy|spaceOpera\nmundo visual / loader"] 
  shellTheme["data-shell-theme fantasy|sci-fi\nUI tutor chrome"]
  childTheme["children.world_theme fantasy|sci-fi\npreferencia juego niño"]
  dataTheme -.->|independiente| shellTheme
  shellTheme -.->|independiente| childTheme
```

## Anti-errores

- No recrear capas en cada navegación legal/home (flash negro).
- No mezclar `?v=` divergente en singletons de mundo.
- Specs loader FX/fantasía: detalle fino en `specify/SPEC_LOADER_*`; este diagrama solo orienta.
