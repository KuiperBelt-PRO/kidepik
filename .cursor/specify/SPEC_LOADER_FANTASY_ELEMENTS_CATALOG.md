# Spec: Catálogo de elementos de fantasía (generación + tiempo de vida)

> Estado: **propuesta** (jun 2026) — pendiente de aprobación del usuario
> Motor: [SPEC_LOADER_FANTASY_ENGINE.md](SPEC_LOADER_FANTASY_ENGINE.md)
> Castillo (detalle aparte): [SPEC_LOADER_FANTASY_CASTLE.md](SPEC_LOADER_FANTASY_CASTLE.md)
> Plan por fases: [tasks/LOADER_FANTASY_ENGINE_EXECUTION_PLAN.md](../tasks/LOADER_FANTASY_ENGINE_EXECUTION_PLAN.md)

## 0. Propósito

Diseño de **todos los tipos de elemento** del motor (excepto castillo/palacio, ya detallado). Cada tipo respeta el **mismo contrato** (`FantasyElement`, partes con `buildOrder`/`baseY`) y la **misma máquina de estados** (`building → holding → eroding → gone`), variando solo:

- **Modelo de generación**: qué partes y variaciones produce el builder.
- **Modelo de tiempo de vida**: matices de ritmo de construcción y erosión.

Todos: **blanco sólido, detallado, asimétrico, imperfecto**; nacen del suelo; sustracciones por `evenodd`.

> Convención de tabla de tiempos: valores orientativos; el motor aleatoriza por instancia dentro de cada rango. "Build" = construcción ascendente por pieza; "Erode" = disolución global con máscara de ruido top→bottom salvo nota.

---

## 1. Torres aisladas (`tower`) — Fase 2

Pieza única vertical; reaprovecha helpers de torres del castillo.

**Generación**
- 1 fuste (`tower`) alto y estrecho, base ligeramente más ancha (talud).
- Remate aleatorio: `roof` cónico/agudo, `battlement` (almenas) o `dome`.
- Sustracciones: saeteras verticales escalonadas + 1 puerta baja + ventanas pequeñas.
- Variantes `style`: `watchtower` (esbelta), `wizardTower` (inclinada, irregular, remate aguja), `bastion` (recia con almenas), `brokenTower` (cima rota de origen).
- Asimetría: ligera inclinación global (`wizardTower`), ancho no constante por tramos.

**Tiempo de vida**

| Build | Hold | Erode |
| --- | --- | --- |
| 1400–2200 ms | 2500–4500 ms | 1500–2200 ms |

- Build muy marcado de abajo a arriba (es vertical): el remate aparece al final.
- Erosión top→bottom natural (la aguja/almenas caen primero).

---

## 2. Aldeas / pueblos / posadas (`village`, `town`, `inn`) — Fase 3

Composición de **varias casas** pequeñas: primera vez que un `FantasyElement` agrupa muchas piezas que forman un "conjunto". El conjunto se construye y erosiona **como una unidad** (una sola máscara de erosión sobre el grupo).

**Generación**
- N casas (`house` como `block` con `roof` a dos aguas) dispuestas en línea irregular sobre el suelo, con solapamientos y alturas distintas.
- `village`: 3–6 casas pequeñas, dispersas, una con chimenea (`decoration`).
- `town`: 6–12 casas + algún edificio mayor (2 plantas) + quizá un campanario corto (`tower` bajo). Más densidad.
- `inn`: 1 edificio principal ancho de 2 plantas + cobertizo/anexo + cartel colgante (`decoration` lateral) + chimenea. Tejado grande dominante.
- Sustracciones: puertas + ventanas en rejilla por casa (irregular).
- Asimetría: posiciones X jitter, alturas y anchos desiguales, tejados a distinta cota; nada alineado.

**Tiempo de vida**

| Tipo | Build | Hold | Erode |
| --- | --- | --- | --- |
| village | 1800–2600 ms | 2500–4500 ms | 1500–2200 ms |
| town | 2400–3400 ms | 3000–5000 ms | 1900–2700 ms |
| inn | 1800–2600 ms | 2500–4500 ms | 1600–2300 ms |

- Build de abajo a arriba **y de fuera hacia dentro/azar**: las casas se levantan escalonadas (cada casa: muros → tejado → chimenea).
- Erosión global del conjunto (el pueblo entero se disuelve a la vez, no casa por casa).
- `maxConcurrent` del director puede mantenerse en 1 (el conjunto ya es múltiple).

---

## 3. Megalitos: menhires, dólmenes, círculos de piedra (`menhir`, `dolmen`, `stoneCircle`) — Fase 4

> Detalle completo: [SPEC_LOADER_FANTASY_MEGALITH.md](SPEC_LOADER_FANTASY_MEGALITH.md)

Familia de **piedra cruda**: bloques irregulares, sin arcos ni tejados, máxima imperfección de silueta.

**Generación**
- `menhir`: 1 piedra vertical alta, irregular, ligeramente inclinada; base hundida en el suelo. Opcional: grabados como pequeñas sustracciones (líneas/espirales).
- `dolmen`: 2–3 ortostatos (verticales) + 1 losa horizontal (cobertera) encima → forma de "mesa". Asimétrico (patas de distinta altura/grosor).
- `stoneCircle`: anillo de 5–9 piedras verticales en **perspectiva elíptica** (las traseras más pequeñas/altas en pantalla, las delanteras mayores), espaciado irregular; opcional 1–2 dinteles (trilitos).
- Roca: `polygon` con muchos vértices + `jitterRing` fuerte; nunca rectángulos limpios.

**Tiempo de vida**

| Tipo | Build | Hold | Erode |
| --- | --- | --- | --- |
| menhir | 900–1500 ms | 2500–4500 ms | 1300–1900 ms |
| dolmen | 1400–2200 ms | 2500–4500 ms | 1500–2200 ms |
| stoneCircle | 2000–3000 ms | 3000–5000 ms | 1800–2600 ms |

- Build: piedras verticales "emergen del suelo" (escalado desde su base); en `dolmen` la cobertera **asienta al final** sobre las patas; en `stoneCircle` las piedras emergen una a una (orden por profundidad: fondo→frente o aleatorio).
- Erosión global; piedra desmoronándose (ruido más grueso, `baseFrequency` menor).

---

## 4. Bosques (`forest`) — Fase 5

Conjunto **orgánico** de árboles; primera familia sin geometría arquitectónica.

**Generación**
- N árboles (3–9) con solapamiento y profundidad (tamaños y `baseY` jitter).
- Árbol = `trunk` (polígono estrecho, ligeramente curvo/irregular) + `canopy` (1–3 polígonos de copa, lobulados, asimétricos; conífera vs frondosa según `style`).
- `style`: `broadleaf` (copas redondeadas), `pineWood` (coníferas triangulares escalonadas), `ancient` (1 árbol enorme central + pequeños), `deadWood` (ramas desnudas, sin copa, siluetas retorcidas).
- Sustracciones opcionales: huecos en copa (claros) para "detalle" de follaje.
- Imperfección alta: ninguna copa simétrica; troncos no verticales perfectos.

**Tiempo de vida**

| Build | Hold | Erode |
| --- | --- | --- |
| 1800–2800 ms | 2500–4500 ms | 1600–2400 ms |

- Build: troncos crecen desde el suelo, copas **brotan** después (escalado desde la base del tronco/copa) → sensación de "crecimiento" más que "construcción".
- Erosión: el follaje se disuelve antes que los troncos (frente top→bottom encaja de forma natural).

---

## 5. Formaciones de cristales mágicos (`crystals`) — Fase 6

> Detalle completo: [SPEC_LOADER_FANTASY_CRYSTALS.md](SPEC_LOADER_FANTASY_CRYSTALS.md)

Racimo de **prismas** afilados; estética geométrica brillante (en blanco, mediante facetas).

**Generación**
- Clúster de 4–9 cristales prismáticos de distinta altura/ángulo, emergiendo de una base rocosa común.
- Cada cristal = `polygon` alargado (prisma con punta), con 1–2 facetas internas marcadas como **sustracción fina** (líneas) para dar volumen sin color.
- Disposición en abanico asimétrico; algunos cristales pequeños tumbados en la base.
- `style`: `shard` (afilados altos), `geode` (agrupación compacta tipo roca abierta), `floatingShards` (algunos elevados — permitido por D5: `baseY` despegado del suelo).
- Imperfección: ángulos irregulares, longitudes desiguales.

**Tiempo de vida**

| Build | Hold | Erode |
| --- | --- | --- |
| 1300–2100 ms | 2500–4500 ms | 1400–2000 ms |

- Build: los cristales **brotan/se proyectan** desde la base con escalado rápido (overshoot algo mayor: "cristalización").
- Erosión: disolución global; alternativamente "sublimación" (fade con ruido fino, `baseFrequency` alta) — variante a evaluar en implementación.

---

## 6. Portales mágicos y círculos rúnicos (`portal`) — Fase 7

> Detalle completo: [SPEC_LOADER_FANTASY_PORTAL.md](SPEC_LOADER_FANTASY_PORTAL.md)

Elemento con **ciclo de vida especial**: el "estado finalizado" es el **portal activo**, no una construcción estática. Mantiene la misma máquina de estados, reinterpretando las fases.

**Generación**
- Marco del portal: arco/anillo de piedra (góticonatural o circular rúnico) en torno a un vano.
- Vano: gran **sustracción** central (el "interior" del portal deja ver el fondo).
- `style`: `gateArch` (arco gótico de piedra independiente), `runeRing` (círculo de piedras pequeñas con dinteles), `riftPortal` (marco irregular tipo grieta).
- Glifos/runas: pequeñas sustracciones repartidas por el marco.
- Asimetría: marco no perfectamente circular; piedras desiguales.

**Tiempo de vida (reinterpretado)**

| Fase | Significado en portal | Duración |
| --- | --- | --- |
| building | Se levanta el marco de piedra (abajo→arriba) con el **vano ya a tamaño final** (estático) | 1600–2400 ms |
| holding | Portal abierto y estable (micro-pulso **del borde del marco** opcional, no del vano) | 3000–5000 ms |
| eroding | El marco se erosiona/colapsa (disolución global) | 1700–2500 ms |

- **Decisión D6 = vano estático**: el hueco central aparece a tamaño final desde el principio (viaja en el `d` del marco como sustracción `evenodd`). **No** se anima el crecimiento del hueco → no requiere soporte extra del render.
- El pulso opcional durante `holding` afecta solo al **brillo/escala del marco** (transform suave), nunca al hueco.
- `reduced-motion`: marco con fade-in, sin pulso.

---

## 7. Resumen de cobertura

| `kind` | Fase | Builder | Partes clave | Lifecycle especial |
| --- | --- | --- | --- | --- |
| `castle`, `palace` | 1 | `loader-fantasy-castle.js` | base, torres, bloques, arcos, almenas/bóvedas | estándar |
| `tower` | 2 | `loader-fantasy-tower.js` | fuste, remate, saeteras | estándar (muy vertical) |
| `village`, `town`, `inn` | 3 | `loader-fantasy-settlement.js` | casas, tejados, chimeneas, anexos | grupo erosionado como unidad |
| `menhir`, `dolmen`, `stoneCircle` | 4 | `loader-fantasy-megalith.js` | ortostatos, losas, anillo en perspectiva | cobertera asienta al final — [spec](SPEC_LOADER_FANTASY_MEGALITH.md) |
| `forest` | 5 | `loader-fantasy-forest.js` | troncos, copas | "crecimiento" (copas brotan) |
| `crystals` | 6 | `loader-fantasy-crystals.js` | prismas, facetas, base | "cristalización" / sublimación — [spec](SPEC_LOADER_FANTASY_CRYSTALS.md) |
| `portal` | 7 | `loader-fantasy-portal.js` | marco, vano (hueco), runas | vano estático (D6) — [spec](SPEC_LOADER_FANTASY_PORTAL.md) |

## 8. Tests por tipo (patrón común)

Para cada builder, en `web/tests/loader-fantasy-<tipo>.test.js`:

1. Determinismo por seed.
2. Variación entre seeds.
3. Validez (`isValidFantasyElement`).
4. Invariantes propios (conteos en rango, partes obligatorias presentes, sustracciones esperadas, métrica de asimetría).
5. Build order coherente (abajo→arriba; casos especiales: dolmen cobertera última, dome/finial tras su soporte).
6. (Cuando aplique) sesgos de `style` verificables estadísticamente.

Validación visual por fase con MCP Playwright (perfil **iPhone 13** — 390×844, DPR 3), capturas en `tmp/playwright-output/`.

## 9. Decisiones (resueltas con el usuario, jun 2026)

- **D5 = sí.** Se permiten partes con `baseY` despegado del suelo (cristales flotantes, runas suspendidas); el escalado de construcción nace de la **base propia de la pieza**, no del suelo. Orden de build por `baseY` igual.
- **D6 = vano estático.** No se anima el crecimiento de huecos; el vano del portal y cualquier sustracción aparecen a tamaño final con su pieza. El render **no** necesita interpolar sub-anillos.
- **D7 = una fase.** Megalitos (menhir + dolmen + círculo) en una sola fase con tres builders y gate único.

## 10. Aprobación

- [x] Decisiones D5–D7 resueltas.
- [ ] Usuario aprueba el catálogo de tipos y sus modelos de generación/tiempo de vida.
- [ ] OK para abordar fases 2–7 **en orden**, cada una con su gate.
