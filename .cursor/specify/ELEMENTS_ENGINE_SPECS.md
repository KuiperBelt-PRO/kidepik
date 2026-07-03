# Instrucciones para el motor de generacion de elementos por grafos:

- El motor debe ser capaz de generar contenido de forma automatica y optima para las redes sociales.
- Debe realizarlo a partir de grafos de decision para cada tipo de elemento y subtipo.
- Cada pieza del grafo es un modulo independiente (plataforma, torre, arco, remate…) con coordenadas locales; el ensamblador normaliza el conjunto.
- **Anti-patrones globales:** no enterrar el edificio bajo el terreno; la base visible debe quedar por encima del suelo con vanos o sombra que permitan distinguir piedra de terreno.

## Castillos

### Todos

- **Envelope:** anchura total aleatoria dentro de un maximo (`spanW`). Ningun modulo puede sobresalir ese ancho por izquierda o derecha.
- **Anclaje:** el modulo de suelo (`plinth` o `podium`) define el borde inferior del edificio. La base del castillo se ancla al **fondo de pantalla** (`bottom: 0`); el zocalo se extiende hacia abajo en espacio local para atravesar la franja de terreno.
- **Grafo:** nodos ordenados por `order` y dependencias `after`; cada nodo instancia un modulo del catalogo.
- **Silueta:** relleno blanco unico; vanos y arcos huecos se restan con `evenodd` o se dejan como hueco real (sin masa solida).
- **Roles:** `plinth` | `base` | `block` | `tower` | `roof` | `decoration` (ver `SPEC_LOADER_FANTASY_CASTLE.md`).

### Castillos elficos

> Arquetipo: vertical, esbelto, gotico ojival, **aire entre piezas**. Evitar domos bulbosos, semicirculos pesados o siluetas ovoideas. Referencia visual: pabellones abiertos, costillas, agujas, no cupulas macizas.

- Desde la base: arco gotico central en el centro, con altura aleatoria dentro de un maximo.
- Desde la base: arcadas de arcos goticos entrecruzados a los lados del arco central. Los arcos no son solidos, son arcos huecos. Altura aleatoria dentro de un maximo.
- Desde las arcadas: base del segundo nivel, con columnas en los extremos izquierdo y derecho, desde la base hasta la altura de la base.
- Desde la base del segundo nivel: tejados de tejas como escamas de pez en pico, invertidas, de manera que las tejas se extienden hacia abajo. El tejado es un trapezoide de base plana, mas bajo por el extremo mas alejado del arco central.
- Desde el arco central: base del tercer nivel, con columnas en los extremos izquierdo y derecho, desde la base hasta la altura de la base.
- Desde la base del tercer nivel: entre 1 y 3 torres anchas, formadas por varias lineas verticales, unidas por arcos goticos huecos a diferentes alturas. La torre se culmina con un domo gotico hueco, del mismo ancho que la torre. Dentro del domo, varios arcos goticos huecos de diferentes alturas y anchuras.
- Desde la base del segundo nivel, tras los tejados, una o varias torres estrechas de lineas verticales y arcos goticos huecos a diferentes alturas. Terminan en un domo gotico hueco del mismo ancho que la torre.

**Proporciones orientativas**

| Parametro | Rango local | Notas |
| --- | --- | --- |
| Relacion altura / ancho torre | 6:1 – 10:1 | Mucho mas alto que ancho |
| Arcos | > 95 % goticos ojivales | Casi nunca medio punto |
| Remates | Costillas, agujas, marcos huecos | No cupulas rellenas ni «cebollas» |

### Castillos humanos

> Arquetipo: piedra maciza, solemne, defensiva. Torres gruesas, cuerpo rectangular, mezcla romanica / gotica. Referencia visual: fortaleza medieval europea (muralla + torres + almenas). **Sin tejados a dos aguas.**

**Modulos del grafo (orden sugerido)**

| ID nodo | Modulo | Rol |
| --- | --- | --- |
| `plinth` | `human.plinth` | `plinth` |
| `curtain` | `human.curtain_wall` | `base` |
| `wing_L` / `wing_R` | `human.wing` (opcional) | `block` |
| `tower_*` | `human.tower` | `tower` |
| `buttress_*` | `human.buttress` | `decoration` |
| `crown` | `human.central_crown` | `decoration` |

**Construccion por niveles**

- Desde la base (`plinth`): zocalo macizo rectangular, **mas ancho que el cuerpo** (factor 1,4–1,8×), altura baja (**9–13 %** del cuerpo; factor `HUMAN_PLINTH_HEIGHT_FACTOR` 0,6 sobre el zocalo base). Borde superior horizontal bien marcado; es la transicion visible con el terreno.
- Desde el zocalo: **muralla principal** (`curtain`) — rectangulo macizo del ancho del envelope, altura media-alta. Un solo vano grande: **puerta** centrada o ligeramente desplazada (arco romanico de medio punto o gotico, 50–65 % de la altura del muro). Ventanas secundarias: 2–5 vanos mas pequenos (romanicos o goticos) en rejilla irregular, nunca simetrica perfecta.
- Desde la muralla, en los extremos (opcional): **alas** (`wing`) — bloques adosados mas bajos (60–85 % de la altura del cuerpo), mismo ancho que una torre intermedia. Remate del ala: **almenas** o **cupula recortada** (ver abajo); nunca tejado a dos aguas.
- Desde la muralla o el zocalo: **2–4 torres** de seccion **gruesa** (ancho 12–18 % del `spanW`), alturas variables (la central o una lateral puede ser 1,2–1,5× mas alta). Separacion irregular, no equiespaciada. Cada torre:
  - Fuste macizo rectangular (no hueco total).
  - 1–3 saeteras o ventanas (rectangulares, romanicas o goticas segun `archBias`).
  - **Un solo remate por torre** en todo el edificio (regla global): **almenas** (merlon en ambos extremos del parapeto) o **cupula recortada** (solo torre central o palacio).
- Desde el cuerpo: **contrafuertes** rectangulares (2–4) en esquinas o entre torres; piezas aditivas inclinadas o escalonadas, grosor visible.
- Desde la muralla, en el centro del skyline: **corona central** opcional — almenas continuas, cupula recortada o cupula recortada + almenas en la torre/cuerpo mas alto.

**Cupula humana (`human.dome_cropped`)**

- Semielipse o arco de medio punto en la base, igual que una cupula clasica.
- **Corte horizontal recto** en la parte superior: la cupula no termina en punta ni en circulo completo; se trunca con un segmento plano paralelo al suelo (como un tambor coronado).
- El modulo geom `domeCropped(cx, baseY, rx, ry, cropRatio)` genera el contorno: arco inferior + recta superior entre los dos puntos de tangencia del recorte.
- Parametro `cropRatio` (0,35–0,55): fraccion de `ry` conservada por debajo del corte; a mayor valor, cupula mas baja y plana.

**Proporciones orientativas**

| Parametro | Rango local | Notas |
| --- | --- | --- |
| Relacion altura torre / ancho torre | 2,5:1 – 4:1 | Robusta, no aguja |
| Relacion altura total / ancho envelope | 1,0:1 – 1,4:1 | Mas ancho que alto en conjunto |
| Arcos | ~50 % romanicos, ~50 % goticos | Puerta puede marcar el dominante |
| Remates | Almenas > cupula recortada | Sin tejados |
| Contrafuertes | Frecuentes (~85 %) | No arbotantes voladores |

**Anti-patrones humanos**

- **Tejados a dos aguas** (`gableRoof`, cumbrera, triangulos de tejado).
- Torres esbeltas tipo aguja (eso es elfico).
- Arcadas huecas en toda la planta baja (eso es elfico).
- Pinchos y cornisas dentadas (eso es maligno).
- Cupulas ojivales altas, domos bulbosos o cupulas sin recorte superior plano.
- Simetria perfecta bilateral.

### Castillos enanos

> Arquetipo: fortaleza excavada en roca, baja y ancha, angulos vivos. Piedra tallada con **esquinas achaflanadas en todos los modulos**. **Sin arcos** (ni goticos ni de medio punto): vanos rectangulares achaflanados. Referencia visual: ciudadela de montaña / dolmen megalitico.

**Lenguaje formal enano**

- Toda pieza maciza usa `trapezoidTopChamfer` (trapecio, base ancha plana) o `chamferTopRect` en columnas dolmen.
- **Chamfer solo en la parte superior** de cada pieza (`chamferTopRect` / `chamferTopAperture`); la base es recta y plana.
- **Prohibido** en la faccion enana: `arch()` gothic, `arch()` romanesque, medio punto, ojiva, arco de cualquier tipo.

**Modulos del grafo (orden sugerido)**

| ID nodo | Modulo | Rol |
| --- | --- | --- |
| `rock_base` | `dwarf.rock_shelf` | `plinth` |
| `bastion` | `dwarf.bastion` | `base` |
| `tower_*` | `dwarf.tower` | `tower` |
| `column_*` | `dwarf.column` (opcional) | `decoration` |
| `block_*` | `dwarf.massif` (opcional) | `block` |
| `corbel_*` | `dwarf.corbel` (opcional) | `decoration` |

**Construccion por niveles**

- Desde la base: **estante de roca** (`rock_base`) — `chamferRect`, mas ancho que el bastion (1,1–1,25×), altura baja. Borde superior plano y grueso.
- Desde el estante: **bastion** (`bastion`) — cuerpo principal achaflanado, altura moderada, ancho casi total del envelope. Vanos:
  - **Puerta:** rectangulo achaflanado grande (50–70 % altura del muro), centrado o ligeramente desplazado.
  - **Ventanas / saeteras:** rectangulos achaflanados pequenos, distribucion irregular.
  - Sin arcadas, sin columnatas abiertas en planta baja.
- Desde el bastion: **1–3 torres macizas** — `chamferRect`, relacion altura/ancho 1:1 – 1,8:1. **Sin remate clasico** (sin almenas, cupula ni aguja): terminan en **mesa achaflanada** o ligero escalon superior tambien achaflanado.
  - Vanos en torre: solo rectangulos achaflanados (`chamferAperture` o hueco `chamferRect`).
  - Opcional: hendiduras verticales cortas (lineas de decoracion).
- Desde el bastion o delante del bastion (opcional): **columnas tipo dolmen** (`column`) — 1–4 piezas:
  - **Fuste:** rectangulo achaflanado vertical (alto y estrecho).
  - **Capitel / losa superior:** rectangulo achaflanado horizontal mas ancho que el fuste (como la losa de un dolmen), asentado sobre el fuste con ligero voladizo.
  - Sin base circular ni capitel clasico; todo es ortogonal + chamfer.
- Desde el bastion (opcional): **1–2 masas** laterales (`massif`) — bloques achaflanados mas bajos que las torres.
- Desde esquinas (opcional): **mensulas** (`corbel`) — trapecios o triangulos gruesos achaflanados.

**Primitiva de vano enano (pendiente de implementar)**

- `chamferAperture(cx, baseY, w, h, chamfer)` — igual que `chamferRect` pero emitido como hueco (`evenodd`) para restar del muro.

**Proporciones orientativas**

| Parametro | Rango local | Notas |
| --- | --- | --- |
| Relacion altura torre / ancho torre | 1:1 – 1,8:1 | Macizo, no esbelto |
| Relacion altura total / ancho envelope | 0,7:1 – 1,1:1 | Bajo y ancho |
| Vanos | 100 % rectangulos achaflanados | Cero arcos curvos |
| Remates | Ninguno en torres | Mesa de piedra |
| Columnas dolmen | 0–4 por castillo | Fuste + losa superior achaflanada |
| Imperfeccion (`jitter`) | Baja | Bordes casi rectos |

**Anti-patrones enanos**

- Cualquier arco curvo (gotico, romanico, medio punto, ojival).
- Torres altas y finas.
- Cupulas, agujas, almenas altas.
- Arbotantes, arcadas de claustro, puentes elevados.
- Columnas cilindricas o capiteles redondeados.
- Curvas organicas o domos bulbosos.

---

## Acantilados y formaciones rocosas

> Arquetipo: columnas estrechas y altas en los **bordes** de la pantalla (izquierdo, derecho o ambos). Dos subtipos exclusivos: acantilado macizo que crece, o rocas apiladas.

| Subtipo | Comportamiento build | Piezas |
| --- | --- | --- |
| `cliff` | Escala vertical de una sola masa | 1 silueta + repisas opcionales (misma secuencia) |
| `rocks` | Apilado bottom-up | 3–6 bloques con `buildSequence` creciente |

- Anchura 10–18 u local; altura 52–78 u; relación altura/anchura ≥ 3:1 tras normalizar.
- Cara exterior dentada hacia el borde de pantalla; zócalo hacia el terreno (como castillos).
- Detalle: [SPEC_LOADER_FANTASY_CLIFFS.md](SPEC_LOADER_FANTASY_CLIFFS.md).

---

## Relacion con otras specs

| Documento | Contenido |
| --- | --- |
| [ELEMENTS_ENGINE_SPECS.md](ELEMENTS_ENGINE_SPECS.md) | **Fuente de verdad** — grafos de construccion por faccion (elfo, humano, enano) |
| [SPEC_LOADER_FANTASY_CASTLE.md](SPEC_LOADER_FANTASY_CASTLE.md) | Roles de partes, arcos, API `generateCastle` |
| [SPEC_LOADER_FANTASY_CASTLE_FACTIONS.md](SPEC_LOADER_FANTASY_CASTLE_FACTIONS.md) | Perfiles `FactionProfile`; detalle de grafo en este documento |
| [SPEC_LOADER_FANTASY_ENGINE.md](SPEC_LOADER_FANTASY_ENGINE.md) | Ciclo de vida, normalizacion, render |

**Estado:** implementado (jul 2026). Tres facciones operativas en `loader-fantasy-castle.js`. Primitivas `chamferAperture` y `domeCropped` en `loader-fantasy-geom.js`. Pendiente: migración a grafo para humano/enano (elfo ya usa grafo).
