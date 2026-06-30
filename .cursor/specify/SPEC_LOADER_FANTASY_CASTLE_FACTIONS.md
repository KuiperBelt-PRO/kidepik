# Spec: Facciones temáticas de castillos y palacios

> Estado: **implementada** (jun 2026)
> Motor: [SPEC_LOADER_FANTASY_ENGINE.md](SPEC_LOADER_FANTASY_ENGINE.md)
> Builder: [SPEC_LOADER_FANTASY_CASTLE.md](SPEC_LOADER_FANTASY_CASTLE.md)

## 1. Contexto

Los castillos y palacios del loader pertenecen a un **mundo de fantasía** con arquitecturas distintas por pueblo/raza, al estilo de sagas como *El Señor de los Anillos* o *Dragones y Mazmorras*. Cada aparición elige una **facción** que sesga silueta, proporciones, arcos y decoración.

No se usan nombres propietarios (Rohan, Rivendell, etc.): solo arquetipos genéricos.

## 2. Facciones

| ID | Arquetipo | Silueta y carácter |
| --- | --- | --- |
| `human` | Reinos humanos | Piedra maciza, solemne, robusta; torres altas; arcos románicos/góticos equilibrados; remates **almenas o cúpula recortada** (sin tejado a dos aguas). |
| `elf` | Reinos élficos | Orgánico, esbelto, muy alto; torres finas; arcos ojivales y trilobulados; remates en cúpula hueca o aguja; **arcos que se cruzan** en fachada. |
| `dwarf` | Fortalezas enanas | Piedra tallada **poligonal** con **esquinas achaflanadas**; baja y ancha; torres macizas; **vanos rectangulares achaflanados** (sin arcos curvos); columnas tipo dolmen opcionales. |
| `evil` | Fuerzas malignas | Amenazante, irregular; **pinchos y puntas** en remates y cornisas; torres inclinadas; saeteras; agujas frecuentes. Grafo detallado: [ELEMENTS_ENGINE_SPECS.md](ELEMENTS_ENGINE_SPECS.md). |

## 3. Modelo de datos

```js
/** @typedef {'human'|'elf'|'dwarf'|'evil'} CastleFaction */

// Perfil (resumen; ver loader-fantasy-castle-factions.js)
{
  id, label,
  baseW, baseH, towerW, hMul,        // rangos [min,max]
  jitterScale,                         // multiplicador de imperfección
  archBias: { gothic, romanesque },
  winKinds: string[],
  remateWeights: { battlement, roof, dome },
  blockMax,
  bodyShape: 'rect' | 'chamfer',
  crossingArchChance,                  // elf
  spikeChance, spikeDensity,           // evil
  finialKinds: ('ball'|'needle')[],
  palaceBias,                          // peso si palace:true
}
```

### API extendida

```js
generateCastle({
  seed,
  palace?: boolean,
  faction?: CastleFaction,  // si omitido → pickFaction(rng, palace)
  imperfection?: number,
});
```

**Depuración en el loader** (query string):

| Parámetro | Valores | Efecto |
| --- | --- | --- |
| `fantasyDev` | `castle`, `palace`, `block` | Fuerza el `kind` del elemento |
| `fantasyFaction` | `human`, `elf`, `dwarf`, `evil` | Fuerza la facción arquitectónica |

Ejemplo: `http://localhost:8082/?fantasyDev=castle&fantasyFaction=elf#/loader` (también vale `#/loader?fantasyDev=castle&fantasyFaction=elf`)

`meta.faction` y `meta.towerRemate` quedan en el elemento generado.

## 4. Reglas de coherencia (heredadas + nuevas)

- **Un solo tipo de remate** por edificio (almenas o cúpula recortada en humanos; ninguno en enanos; ver `ELEMENTS_ENGINE_SPECS.md`).
- **Sin símbolos religiosos** (no cruces).
- Almenas con merlón en **ambos extremos**.
- La facción es **determinista** con `seed` (+ `palace` si no se fuerza `faction`).

## 5. Primitivas geométricas nuevas

| Función | Uso |
| --- | --- |
| `chamferRect(cx, baseY, w, h, chamfer)` | Cuerpos enanos con esquinas achaflanadas |
| `chamferAperture(cx, baseY, w, h, chamfer)` | Huecos enanos (puertas/ventanas); **planeado** — ver `ELEMENTS_ENGINE_SPECS.md` |
| `domeCropped(cx, baseY, rx, ry, cropRatio)` | Cúpula humana con **recorte horizontal** superior; **planeado** |
| `crossingArches(cx, baseY, w, h)` | Marco decorativo de arcos cruzados (elfos) |
| `spikeRow(cx, baseY, w, count, spikeH)` | Fila de pinchos (malignos) |

## 6. Tests

1. Cada facción produce `isValidFantasyElement` OK (30 seeds × 4).
2. `meta.faction` coherente con opción forzada.
3. Determinismo: misma `seed` + `faction` → mismo SVG.
4. Estadístico: elfos más altos que enanos; malignos más piezas `decoration` con pinchos.
5. Invariantes de castillo existentes siguen en verde.

## 7. Criterios de aceptación visual

1. A simple vista se distingue humano (robusto) de elfo (esbelto/alto) de enano (achatado/angular) de maligno (pinchos).
2. Palacios tienden a facciones `human`/`elf`; castillos mezclan las cuatro.
3. Ciclo build → hold → erode sin regresiones.
