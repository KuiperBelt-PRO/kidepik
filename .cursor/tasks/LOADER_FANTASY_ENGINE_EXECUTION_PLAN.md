# Plan de ejecución por fases — Motor de elementos de fantasía (loader)

> Specs: [SPEC_LOADER_FANTASY_ENGINE.md](../specify/SPEC_LOADER_FANTASY_ENGINE.md) · [SPEC_LOADER_FANTASY_CASTLE.md](../specify/SPEC_LOADER_FANTASY_CASTLE.md) · [SPEC_LOADER_FANTASY_ELEMENTS_CATALOG.md](../specify/SPEC_LOADER_FANTASY_ELEMENTS_CATALOG.md)
> Método: [.cursor/SDD.md](../SDD.md) (Specify → Plan → Task → Implement → Validate) + TDD por fase.

## Cómo usar este plan

- **Cada fase es un gate.** No se implementa la fase N+1 hasta que el usuario da el **visto bueno** a la fase N (implementada, validada en navegador y con tests en verde).
- **Una fase = un ciclo SDD/TDD**: tests primero (lógica pura), implementación mínima, refactor, validación visual con MCP Playwright (perfil **iPhone 13** — 390×844, DPR 3).
- Marca el estado de cada fase en la tabla y en su checklist de gate.
- **Decisiones D1–D7: resueltas** (jun 2026): D1 concurrencia *ramp* (v1=1 → 2–3 en Fase 8); D2 erosión `feTurbulence` + fallback; D3 sin exclusión central (tope de altura §7.1 del motor, prominencia media); D4/D7 megalitos en una fase; D5 piezas flotantes permitidas; D6 vano del portal estático; arranque con Fase 0 separada; castillo+palacio juntos en Fase 1; alcance solo loader.

## Estado global

| Fase | Nombre | Depende de | `kind`(s) | Estado |
| --- | --- | --- | --- | --- |
| 0 | Núcleo del motor | — | (`block` de prueba) | ✅ aprobada |
| 1 | Castillos y palacios | 0 | `castle`, `palace` | 🔧 implementada (pendiente visto bueno) |
| 2 | Torres aisladas | 1 | `tower` | ⏳ no iniciada |
| 3 | Aldeas, pueblos, posadas | 1 | `village`, `town`, `inn` | ⏳ no iniciada |
| 4 | Megalitos | 0 | `menhir`, `dolmen`, `stoneCircle` | ⏳ no iniciada |
| 5 | Bosques | 0 | `forest` | ⏳ no iniciada |
| 6 | Cristales mágicos | 0 | `crystals` | ⏳ no iniciada |
| 7 | Portales mágicos | 0 (+ D6) | `portal` | ⏳ no iniciada |
| 8 | Director: secuenciación y pulido | 1–7 | (todos) | ⏳ no iniciada |

Leyenda estado: ⏳ no iniciada · 🔧 en curso · ✅ aprobada por el usuario.

## Grafo de dependencias

```
            ┌────────────── Fase 0 (núcleo) ──────────────┐
            │        │        │        │        │         │
         Fase 1   Fase 4   Fase 5   Fase 6   Fase 7   (geom/render/lifecycle)
        castillo  megalit. bosque  cristal  portal
          │  └──────┬───────┘
       Fase 2    (independientes entre sí, requieren solo el núcleo)
       torre
          │
       Fase 3
      aldeas
            └───────────── Fase 8 (director, integra todo) ──────────────
```

- Fase 1 (castillo) es prioritaria por requisito del usuario y valida el motor con un caso rico.
- Fases 4–7 dependen **solo del núcleo** (Fase 0): pueden reordenarse según prioridad del usuario.
- Fases 2 y 3 reutilizan helpers del castillo (torres, casas) → dependen de Fase 1.
- Fase 8 pule el director cuando ya hay varios tipos.

---

## Fase 0 — Núcleo del motor

**Objetivo:** infraestructura compartida que permita construir, sostener y erosionar **cualquier** elemento, validada con un elemento mínimo de prueba (`block`).

**Alcance / entregables**
- `web/js/components/loader-fantasy-geom.js`: `rect`, `gableRoof`, `dome`, `merlons`, `arch`, `aperture`, `finial`, `polygon`, `jitterRing`, `normalizeGroups`, `pointsToPath`, `boundsOfPoints` (sustracción `evenodd`).
- `web/js/components/loader-fantasy-element.js`: tipos, `FANTASY_BUILDERS` (registry), `generateFantasyElement`, `isValidFantasyElement`, `planBuildOrder`, `planLifecycleTiming`, `erosionThresholdAt`. Builder `block` (1 rectángulo con 1 ventana) solo para pruebas/dev.
- `web/js/components/loader-fantasy-render.js`: `mountFantasyElement` (DOM/SVG, WAAPI por pieza, máscara/filtro de erosión `feTurbulence` + gradiente animado, reduced-motion, `destroy`).
- `web/js/components/loader-fantasy-scene.js`: director **esqueleto** (monta un solo `block`, encadena tras `onGone`, **tope de altura** para no alcanzar el logo §7.1, `destroy`).
- `web/css/scenes/loader.css`: `.loader-layer--fantasy-scene`, `.loader-fantasy-el*`, vars/keyframes de erosión.
- `web/js/components/loader-chrome.js`: montar/destruir el director.
- Dev flag `?fantasyDev=block` (o similar) para forzar el elemento de prueba.

**Tests (node --test)** — `web/tests/loader-fantasy-geom.test.js`, `web/tests/loader-fantasy-element.test.js`:
- Primitivas: anillos válidos; `arch`/`aperture` orientados para evenodd; `jitterRing` acotado.
- `generateFantasyElement('block')` determinista y válido.
- `planBuildOrder` monótono por `baseY`; `planLifecycleTiming` en rango y determinista; `erosionThresholdAt(t)` monótona 0→1.

**Validación navegador (Playwright, perfil iPhone 13 — 390×844, DPR 3)**
- `?fantasyDev=block`: ver build→hold→erode→gone del bloque sobre el terreno; reduced-motion; sin errores consola; capturas en `tmp/playwright-output/`.

**Gate de aprobación — Fase 0**
- [x] D1–D7 resueltas.
- [ ] Tests de geom + element en verde.
- [ ] Ciclo de vida visible y correcto con `block`.
- [ ] `destroy()` limpio; reduced-motion OK.
- [ ] **Visto bueno del usuario** → habilita Fase 1.

---

## Fase 1 — Castillos y palacios

**Objetivo:** primer builder real (showcase). Detalle en [SPEC_LOADER_FANTASY_CASTLE.md](../specify/SPEC_LOADER_FANTASY_CASTLE.md).

**Entregables**
- `web/js/components/loader-fantasy-castle.js` (`generateCastle`, helpers torres/arcos/almenas).
- Registro `castle`/`palace` en `loader-fantasy-element.js`.
- Director: incluir `castle`/`palace` en su selección.

**Tests** — `web/tests/loader-fantasy-castle.test.js`: determinismo, variación, validez, invariantes (1 base, 2–5 torres con remate, ≥1 puerta + ventanas, arcos del estilo), build order, palace vs castle.

**Validación navegador:** castillo distinto por recarga; build ascendente; erosión global; palacio más señorial.

**Gate — Fase 1**
- [x] Tests en verde + validación visual. (`loader-fantasy-castle.test.js` 21/21; suite fantasy 85/85; Playwright iPhone 13 390×844: catálogo de 6 castillos y 6 palacios, build ascendente, erosión global de arriba a abajo, anclaje al suelo).
- [x] Cumple criterios de aceptación de la spec del castillo (base + 2–5 torres con remates variados, puertas/ventanas como sustracción, arcos redondeados, almenas, cúpulas, pináculos, asimetría e imperfección por `tiltDeg`).
- [ ] **Visto bueno del usuario** → habilita Fases 2 y 3.

---

## Fase 2 — Torres aisladas

**Objetivo:** `tower` reutilizando helpers de torre del castillo.
**Entregables:** `web/js/components/loader-fantasy-tower.js` + registro + integración director.
**Tests:** `web/tests/loader-fantasy-tower.test.js` (determinismo, variación, validez, 1 fuste + 1 remate, saeteras/puerta, variantes `style`, inclinación en `wizardTower`).
**Validación:** torres variadas, muy verticales en build; erosión top→bottom.
**Gate:** tests verdes + visual + **visto bueno** → habilita continuar.

---

## Fase 3 — Aldeas, pueblos, posadas

**Objetivo:** `village`, `town`, `inn` (conjuntos de casas como una unidad).
**Entregables:** `web/js/components/loader-fantasy-settlement.js` + registro + director.
**Tests:** `web/tests/loader-fantasy-settlement.test.js` (conteos por tipo, casas con muros+tejado, chimeneas/anexos según tipo, asimetría de disposición, build por casa, erosión del grupo como unidad).
**Validación:** pueblo se levanta casa a casa y se disuelve en bloque; `inn` con edificio principal + cartel.
**Gate:** tests verdes + visual + **visto bueno**.

---

## Fase 4 — Megalitos (menhir, dolmen, círculo de piedra)

**Objetivo:** familia de piedra cruda (depende solo del núcleo).
**Entregables:** `web/js/components/loader-fantasy-megalith.js` (3 builders) + registro + director.
**Tests:** `web/tests/loader-fantasy-megalith.test.js` (por tipo: determinismo, variación, validez; dolmen = patas + cobertera con cobertera última en build; círculo = 5–9 piedras en perspectiva; rocas con jitter fuerte).
**Validación:** piedras emergen del suelo; cobertera del dolmen asienta al final; erosión gruesa.
**Gate:** tests verdes + visual + **visto bueno**.

---

## Fase 5 — Bosques

**Objetivo:** `forest` (orgánico).
**Entregables:** `web/js/components/loader-fantasy-forest.js` + registro + director.
**Tests:** `web/tests/loader-fantasy-forest.test.js` (3–9 árboles, tronco+copa por árbol, variantes `style`, asimetría de copas, build: copas brotan tras troncos).
**Validación:** sensación de "crecimiento"; follaje se erosiona antes que troncos.
**Gate:** tests verdes + visual + **visto bueno**.

---

## Fase 6 — Cristales mágicos

**Objetivo:** `crystals` (prismas).
**Entregables:** `web/js/components/loader-fantasy-crystals.js` + registro + director.
**Tests:** `web/tests/loader-fantasy-crystals.test.js` (4–9 prismas, facetas como sustracción, base común, variantes `style`, asimetría de ángulos/longitudes).
**Validación:** "cristalización" en build (overshoot); disolución/sublimación en erode.
**Gate:** tests verdes + visual + **visto bueno**.

---

## Fase 7 — Portales mágicos

**Objetivo:** `portal` con marco erosionable y **vano estático** (D6 = sin animación de hueco).
**Entregables:** `web/js/components/loader-fantasy-portal.js` + registro + director. (No requiere soporte de vano animado en el render.)
**Tests:** `web/tests/loader-fantasy-portal.test.js` (marco + vano central como sustracción `evenodd` + runas; variantes `style`; vano a tamaño final desde el build).
**Validación:** marco se levanta de abajo a arriba con el vano ya abierto, reposa (micro-pulso opcional del marco), colapsa por erosión.
**Gate:** tests verdes + visual + **visto bueno**.

---

## Fase 8 — Director: secuenciación, mezcla y pulido

**Objetivo:** experiencia final de escena con todos los tipos.
**Entregables**
- Selección ponderada por tipo, anti-repetición, biomas/coherencia.
- Posiciones X y alturas por tipo (respetando el tope de altura §7.1); subir `maxConcurrent` a **2–3** (D1 = *ramp*) repartiendo siluetas por el ancho sin solaparse en exceso.
- Ajuste fino de tiempos globales, densidad y `prefers-reduced-motion`.
- Auditoría de rendimiento (un filtro de erosión activo máx., limpieza de `will-change`).
**Tests:** `web/tests/loader-fantasy-scene.test.js` (selección determinista por seed, no repetición inmediata, tope de altura respetado, respeto a `maxConcurrent`).
**Validación:** sesión larga del loader sin fugas de memoria/nodos; mezcla agradable de elementos; móvil fluido.
**Gate:** tests verdes + visual + **visto bueno** → motor completo.

---

## Cierre por fase (checklist repetible)

Al cerrar cada fase:
1. `cd web && node --test tests/loader-fantasy-*.test.js` en verde.
2. Validación MCP Playwright — perfil **iPhone 13** (390×844, DPR 3), capturas en `tmp/playwright-output/`.
3. Actualizar este plan (estado de la fase) y, si cambia comportamiento, [CURRENT_SPECS.md](../CURRENT_SPECS.md).
4. Guardar decisión/lección reutilizable en Engram si aplica.
5. Esperar **visto bueno explícito** del usuario antes de la siguiente fase.
