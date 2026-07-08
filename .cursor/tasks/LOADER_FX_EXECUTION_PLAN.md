# Plan de ejecución — Motor FX del loader

> Specs: [SPEC_LOADER_FX_ENGINE.md](../specify/SPEC_LOADER_FX_ENGINE.md) · [SPEC_LOADER_FX_CRYSTALS_MAGIC.md](../specify/SPEC_LOADER_FX_CRYSTALS_MAGIC.md)  
> Método: [.cursor/SDD.md](../SDD.md) — **no implementar sin aprobación** de las specs.

## Estado global

| Fase | Nombre | Depende de | Estado |
| --- | --- | --- | --- |
| FX-0 | Núcleo FX (engine, anchors, render, palette fantasy) | Motor fantasía Fase 0 | ⏳ no iniciada |
| FX-1 | Piloto cristales mágicos | FX-0 + cristales Fase 6 | ⏳ no iniciada |
| FX-2 | Paleta space opera + primer host sci-fi (TBD) | FX-0 | ⏳ no iniciada |

Leyenda: ⏳ no iniciada · 🔧 en curso · ✅ aprobada por el usuario.

## Grafo

```
Fase 0 motor fantasía ──┬── Fase 6 cristales (host)
                        │
                        └── FX-0 (núcleo FX) ── FX-1 (cristales mágicos)
                                      │
                                      └── FX-2 (space opera, futuro)
```

---

## FX-0 — Núcleo del motor FX

**Objetivo:** `mountFxBundle`, registry, anclas genéricas, render de partículas, integración mínima en `mountFantasyElement`.

**Entregables**

- `loader-fx-engine.js`, `loader-fx-anchors.js`, `loader-fx-fantasy-palette.js`, `loader-fx-render.js`
- Hook en `loader-fantasy-render.js` (detrás de flag / `meta.fxProfile`)
- Tokens CSS `.loader-fx-*` en `loader.css`
- Tests: `loader-fx-engine.test.js`, `loader-fx-anchors.test.js`
- Receta de prueba con host `block` y 2 anclas sintéticas (sin efecto visual obligatorio en producción)

**Gate FX-0**

- [ ] Spec [SPEC_LOADER_FX_ENGINE.md](../specify/SPEC_LOADER_FX_ENGINE.md) aprobada.
- [ ] Tests en verde; `destroy()` limpio.
- [ ] Reduced motion desactiva FX.
- [ ] **Visto bueno usuario** → habilita FX-1.

---

## FX-1 — Cristales mágicos (piloto)

**Objetivo:** Receta completa burst + shimmer + motes + scatter según [SPEC_LOADER_FX_CRYSTALS_MAGIC.md](../specify/SPEC_LOADER_FX_CRYSTALS_MAGIC.md).

**Entregables**

- `loader-fx-crystals.js` (`planCrystalMagicFx`, `extractCrystalFxAnchors`)
- Registro `FX_RECIPE_BUILDERS.crystals`
- Tests `loader-fx-crystals.test.js`
- Playwright: capturas hold + erode

**Gate FX-1**

- [ ] Spec piloto aprobada.
- [ ] Tests en verde.
- [ ] Validación visual 390×844 con `?fantasyDev=crystals&fxDev=1`.
- [ ] **Visto bueno usuario**.

---

## FX-2 — Space opera (futuro)

**Objetivo:** Extender motor a mitad inferior del loader (naves, planetas). Spec detallada **pendiente** tras cerrar FX-1.

Candidatos: estela de motor en `loader-ship-procedural`, halo en órbita. Reutilizar `loader-fx-space-palette.js`.

**Gate:** nueva spec `SPEC_LOADER_FX_SPACE_*.md` + aprobación.
