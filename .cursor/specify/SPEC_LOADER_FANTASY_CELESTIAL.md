# Spec: Sol y luna — cielo fantasía del loader

> Estado: **implementada** (jul 2026)  
> Relacionado: [SPEC_LOADER_FANTASY_CLOUDS.md](SPEC_LOADER_FANTASY_CLOUDS.md), [SPEC_LOADER_SCREEN.md](SPEC_LOADER_SCREEN.md)

## Objetivo

**Sol** y **luna** recorren el cielo de la mitad fantasía en un **arco** (amanecer → mediodía → atardecer), entrando por la derecha y poniéndose por la izquierda. Van **alternados** (sol, luna, sol…); nunca simultáneos. Con la luna aparecen **estrellas** y **constelaciones** (segmentos sin cruzarse). La luna avanza de **fase** en cada aparición (ciclo de **3 fases**). El sol lleva **rayos artísticos** (cúspides triangulares + wisps curvos).

## Principios

| Principio | Decisión |
| --- | --- |
| Trayectoria | Arco parabólico: horizonte derecho (amanecer) → cénit → horizonte izquierdo (atardecer) |
| Logo | El centro del cuerpo **no entra** en el disco del logo (empuje radial + máscara de capa) |
| Alternancia | Siempre empieza el **sol**; al terminar, pausa breve y sale la **luna**; luego sol… |
| Estrellas | Solo visibles durante el tránsito de la **luna** (fade con la animación) |
| Constelaciones | 2–4 grupos; 3–5 estrellas unidas en cadena; **sin cruces** entre segmentos |
| Fases lunares | 2 fases alternadas: **creciente muy fina**, **menguante muy fina** (sin luna llena); `phaseIndex` +1 mod 2 |
| Rayos sol | 14–18 cúspides cortas + wisps; rotación lenta (~96 s) y pulso de opacidad (brillo) |
| Duración arco | 22–32 s por tránsito |
| Capa | `.loader-layer--fantasy-celestial`, z-index **1** (como nubes), máscara logo |
| Reduced motion | Capa desactivada |

## API (`loader-fantasy-celestial.js`)

- `celestialArcPoseAt(t, layerW, layerH)` — posición en el arco
- `constrainOutsideLogo(x, y, layerW, layerH, bodyR)` — evita solapar logo
- `generateStarField(rng)` / `buildConstellationEdges(stars, rng)`
- `moonShadowMaskCx(phaseIndex, cx, r)` / `nextMoonPhaseIndex(i)` / `MOON_PHASE_COUNT` (3)
- `planSunRayCounts(rng)` / `appendSunArtistry(svg, rng)`

## Dev

- `?celestialDemo=1` — ciclos más rápidos (~8 s por arco).
