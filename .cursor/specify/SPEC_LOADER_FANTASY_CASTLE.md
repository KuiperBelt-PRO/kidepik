# Spec: Castillos y palacios (builder de fantasía)

> Estado: **propuesta** (jun 2026) — pendiente de aprobación del usuario
> Motor: [SPEC_LOADER_FANTASY_ENGINE.md](SPEC_LOADER_FANTASY_ENGINE.md)
> Fase: **1** del [plan de ejecución](../tasks/LOADER_FANTASY_ENGINE_EXECUTION_PLAN.md)

## 1. Contexto

Primer builder concreto del motor de fantasía. Genera **castillos** y **palacios** como siluetas blancas detalladas, asimétricas e imperfectas, que se construyen de abajo a arriba y luego se erosionan (ciclo de vida común del motor).

`castle` y `palace` comparten builder y difieren por **variante de estilo** (`style`) y pesos de partes:

- **castle**: más defensivo — almenas, torres macizas, saeteras, arco de entrada bajo.
- **palace**: más señorial — más bóvedas/cúpulas, ventanales altos, simetría algo mayor, remates ornamentales.

> **Grafos por facción:** las reglas detalladas de silueta (humano, elfo, enano) viven en [ELEMENTS_ENGINE_SPECS.md](ELEMENTS_ENGINE_SPECS.md) y **prevalecen** sobre este documento cuando contradigan remates o vanos por facción. Ejemplos: humanos sin tejado a dos aguas; enanos sin arcos curvos.

## 2. Modelo de generación

### 2.1 Anatomía (partes)

```
              finial        finial
               ╱╲            ╱╲
            ▟▛▜▙          ▟▛▜▙           ← almenas / bóveda (remate de torre)
            █████   ▟███▙  █████         ← torres (con saeteras)
            █████  ███████ █████
        ╔══════════════════════════╗
        ║   ▢   ▢    ╱▔▔╲   ▢   ▢   ║    ← cuerpo central (ventanas + arcos)
        ║   ▢   ▢   │    │  ▢   ▢   ║
        ║          [puerta arco]    ║    ← sustracción puerta (arco gótico/románico)
        ╚══════════════════════════╝
     ───────────────────────────────────  ← suelo (terreno)
```

| Rol (`role`) | Descripción | Remates posibles |
| --- | --- | --- |
| `base` | **Cuerpo central rectangular** (muralla/cuerpo principal). Obligatorio. | almenas o cornisa |
| `block` | Bloques secundarios adosados (alas), distinta altura/anchura | tejado, almenas o bóveda |
| `tower` | Torres (2–5), anchura y altura variables, posición asimétrica | tejado cónico/agudo, almenas o bóveda/cúpula |
| `roof` | Tejado a dos aguas o cónico sobre torre/bloque | — |
| `battlement` | Almenas (merlones) sobre base/bloque/torre | — |
| `dome` | Bóveda / cúpula sobre torre/bloque (más en `palace`) | con `finial` opcional |
| `decoration` | Remates: agujas, banderines, esferas, cruces, cornisas | — |

Sustracciones (huecos `evenodd`, ver motor §3.3): **ventanas**, **saeteras**, **puerta** y **arcos** se restan de su pieza contenedora.

### 2.2 Arcos (sustracciones de estilo)

| Tipo | Forma | Uso típico |
| --- | --- | --- |
| `gothic` | Ojival (dos arcos de círculo que se cruzan en punta) | Palacio, ventanales, puerta |
| `romanesque` | Medio punto (semicírculo) | Castillo, puerta, galerías |
| `flat` | Dintel recto | Saeteras, ventanas pequeñas |
| `trefoil` | Trilobulado (decorativo) | Ventanales de palacio |

La **puerta** principal es un arco grande centrado-asimétrico en `base`. Las **ventanas** se distribuyen en rejilla irregular por muros de `base`/`block`/`tower`, con conteo y tamaño variables.

### 2.3 Parámetros de variación

| Parámetro | Rango | Efecto |
| --- | --- | --- |
| `style` | `keep` (castillo), `citadel`, `manor`, `palace`, `ruinedKeep` | Sesga partes, arcos y remates |
| Nº de torres | 2–5 | Asimetría: alturas/anchos distintos, no equiespaciadas |
| Nº de bloques | 0–3 | Alas laterales de distinta altura |
| Altura de torres | 0.9–1.9 × alto de `base` | Skyline irregular |
| Remate por torre | `roof` \| `battlement` \| `dome` (ponderado por estilo) | Variedad de coronación |
| Tipo de arco dominante | `gothic` \| `romanesque` (+ `flat`/`trefoil` secundarios) | Carácter gótico/románico |
| Densidad de ventanas | baja/media/alta | Detalle |
| `imperfection` | 0–1 (default ~0.55) | Jitter de vértices, inclinación, desalineación |
| `asymmetryBias` | 0.3–0.8 | Desplazamiento del eje y desigualdad de lados |

### 2.4 Reglas de asimetría e imperfección

- El **eje central** de `base` se desplaza respecto al centro del `viewBox` (`asymmetryBias`).
- Las torres **no** se colocan simétricas: una más alta/ancha que otra, una posiblemente medio derruida (`ruinedKeep`).
- Conteos preferentemente **impares**; alturas con jitter.
- `jitterRing` aplica a muros y remates (bordes no perfectamente rectos); algunas piezas con `tiltDeg` ±1.5°.
- En `ruinedKeep`: una torre/bloque con la parte superior recortada (silueta "rota") ya en generación (no es la erosión, es estilo).

### 2.5 API

```js
/**
 * @param {{ seed:number; style?:string; sizeHint?:number; imperfection?:number;
 *           palace?:boolean }} options
 * @returns {import('./loader-fantasy-element.js').FantasyElement}
 */
export function generateCastle(options);
```

Registrado en el motor como `FANTASY_BUILDERS.castle` y `FANTASY_BUILDERS.palace` (mismo builder, `palace:true` ⇒ sesga `style` a `manor`/`palace`).

### 2.6 Orden de construcción (build-up)

Derivado por el motor a partir de `baseY`, pero el builder garantiza una jerarquía coherente vía `buildOrder`:

1. `base` (cuerpo central) y luego `block`s — desde el suelo.
2. `tower`s (crecen tras asentarse el cuerpo/bloques).
3. Remates por pieza: `roof` / `battlement` / `dome` (tras su torre/bloque).
4. `decoration` (agujas, banderines, cornisas) al final.

Las ventanas/puertas/arcos viajan en el `d` de su pieza (aparecen al escalar la pieza).

## 3. Modelo de tiempo de vida (castillo)

Usa la máquina de estados del motor (§5) con estos ajustes:

| Fase | Valor castillo/palacio | Notas |
| --- | --- | --- |
| `building` | 2200–3400 ms | Castillos tienen muchas piezas; escalonado más largo |
| Escalado por pieza | 240–420 ms, ease-out con overshoot leve | "Asentamiento" de piedra |
| Solape | ~55 % | Construcción fluida ascendente |
| `holding` | 3000–5200 ms | Castillo terminado, bien visible |
| `eroding` | 1900–2800 ms | Desmoronamiento global top→bottom con ruido |
| Erosión | `feTurbulence` baseFrequency ~1.0; frente irregular | Las almenas/torres caen antes que la base |

- **Construcción**: torres y remates "suben" desde su base; sensación de levantar el castillo piedra a piedra de abajo arriba.
- **Erosión**: el conjunto se disuelve como una sola máscara (las cimas primero), no pieza a pieza.
- **Reduced motion**: fade-in del castillo completo → hold → fade-out.

## 4. Ficheros

| Fichero | Responsabilidad |
| --- | --- |
| `web/js/components/loader-fantasy-castle.js` | `generateCastle`, helpers de torres/arcos/almenas específicos |
| `web/js/components/loader-fantasy-element.js` | Registrar `castle`/`palace` en el registry |
| `web/css/scenes/loader.css` | (si procede) ajustes de la capa fantasía |
| `web/tests/loader-fantasy-castle.test.js` | Tests del builder |

Depende de Fase 0 (geometría, render y lifecycle del motor ya disponibles).

## 5. Tests (node --test, sin DOM)

1. **Determinismo**: misma `seed`+`style` → mismos `parts` (`d` idénticos).
2. **Variación**: seeds distintas → siluetas distintas; 50 seeds → ≥ N estilos/skylines distintos.
3. **Validez**: `isValidFantasyElement` OK; todos los `d` con sintaxis válida y área positiva.
4. **Invariantes de castillo**:
   - Existe exactamente **una** `base` rectangular.
   - Hay **2–5 torres**; cada torre tiene **un** remate ∈ {`roof`, `battlement`, `dome`}.
   - Hay **≥1 sustracción** de puerta y **≥1** ventana.
   - Se usa **≥1 arco** del tipo dominante esperado por `style`.
   - **Asimetría**: métrica (desplazamiento de centroide / desigualdad de alturas de torres) supera umbral en la mayoría de seeds.
5. **Build order**: `buildOrder` de `base` < torres < remates < decoración; monótono con `baseY`.
6. **palace vs castle**: `palace:true` produce mayor proporción de `dome`/`trefoil`/`gothic` y menor de `battlement` (test estadístico sobre N seeds).

Validación visual (MCP Playwright, perfil **iPhone 13** — 390×844, DPR 3) del ciclo completo build→hold→erode en la fase de implementación.

## 6. Criterios de aceptación

1. En el loader aparece un **castillo blanco detallado** sobre el terreno, **distinto en cada recarga**.
2. Cuerpo central rectangular + 2–5 torres asimétricas con remates variados (tejado/almenas/bóveda) + bloques secundarios.
3. Arcos góticos/románicos y sustracciones de ventanas/puerta visibles (dejan ver el fondo).
4. Estética **blanca sólida, detallada, asimétrica, imperfecta**.
5. Se **construye de abajo a arriba** con escalado por componente; reposa; se **erosiona en conjunto** hasta desaparecer.
6. `palace` se percibe más señorial que `castle`.
7. Sin errores de consola; `destroy()` limpio; `reduced-motion` degradado correctamente.
8. Tests de `loader-fantasy-castle.test.js` en verde.

## 7. Fuera de alcance (de esta fase)

- Otros tipos de elemento (ver [catálogo](SPEC_LOADER_FANTASY_ELEMENTS_CATALOG.md)).
- Color, banderas animadas, humo de chimeneas, ventanas iluminadas.
- Varias siluetas simultáneas (lo gestiona el director en Fase 8).

## 8. Aprobación

- [ ] Usuario aprueba anatomía, variación y lifecycle del castillo.
- [ ] OK para implementar **Fase 1** (requiere Fase 0 aprobada e implementada).
