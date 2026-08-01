# Spec: Biblia narrativa por zona (coherencia diegética)

> Estado: **propuesta — pendiente de aprobación** (1 ago 2026)  
> Relacionado: [SPEC_APP_WORLD_JOURNEY_CANON.md](SPEC_APP_WORLD_JOURNEY_CANON.md), [SPEC_APP_ADVENTURE_STORY_RICHNESS.md](SPEC_APP_ADVENTURE_STORY_RICHNESS.md), [SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md), [SPEC_APP_MENTOR.md](SPEC_APP_MENTOR.md), [SPEC_APP_AGE_BANDS.md](SPEC_APP_AGE_BANDS.md)  
> Precedencia: corrige el vertical slice actual donde `AdventureService::chooseZone()` usa **copy de bosque** para **todas** las zonas fantasy.

## Contexto / síntoma (sesión real)

El explorador elige **Laberinto de Espejos** (`zone_logic`). El mentor dice «Laberinto de Espejos» en la primera frase, pero acto seguido:

- «hojas como runas», «equilibrio tiembla», «Guardián del **claro**», «ser de **musgo y números**», «**bosque** recuerda», «pruebas en el **bosque**».

**Causa técnica:** en `api/src/Services/AdventureService.php`, `chooseZone()` solo sustituye `%s` por el título de zona; NPC, problema y beats intermedios son **plantillas fijas de bosque/math** compartidas por todo el mundo fantasy. Lo mismo afecta a `resolveChallenge()` (entre-retos) y cierre de quest.

**No es un fallo del LLM** en este tramo: es copy PHP sin `zone_id`.

## Objetivo

1. Cada `zone_id` tiene **escenario, antagonista local, NPC y metáforas** propias.
2. Prohibido mezclar vocabulario de otra zona (bosque en espejos, runas de conteo en biblioteca…).
3. El mentor habla con **claridad** (comprensible para un adulto que supervisa) y tono acorde a `world_theme` + `effective_age_band`.
4. Reducir muletillas («equilibrio tiembla», «fragmentos», «niebla») a **uso moderado** y solo cuando encajen en la zona.

---

## 1. Tabla canónica por zona (fantasy MVP)

| `zone_id` | Materia | Escenario (sensorial) | Antagonista local | NPC (`zone_guardian`) | Objetivo diegético (quest intro) |
| --- | --- | --- | --- | --- | --- |
| `zone_math` | math | Bosque de runas numéricas, árboles que susurran cifras | Niebla que borra cantidades | **Guardiana del Bosque** — figura de musgo y luz verde | Recuperar **3 fragmentos de número** |
| `zone_logic` | logic | Laberinto de espejos, pasillos que se repiten, reflejos falsos | Espejos que muestran caminos imposibles | **Vigía de los Espejos** — silueta sin rostro, voz clara | Encontrar **3 secuencias verdaderas** que abren la salida |
| `zone_language` | language | Montañas de ecos, cumbres de viento y palabras rotas | Viento que se lleva sílabas | **Escriba del Viento** — pluma flotante, tono poético breve | Recomponer **3 ecos de palabra** |
| `zone_science` | science | Jardines alquímicos, plantas apagadas, frascos vacíos | Frío que apaga la curiosidad | **Alquimista del Rocío** — bata manchada de luz | Despertar **3 semillas de observación** |
| `zone_culture` | culture | Biblioteca de los Reinos, tomos con páginas en blanco | Polvo que borra crónicas | **Archivista de los Reinos** — gafas de cristal, voz serena | Restaurar **3 páginas perdidas** |

### Sci-fi (paridad)

Misma estructura con ids de zona del canon §3 (`Nebulosa Matemática`, `Laberinto de Circuitos`, etc.). NPCs: IA de sector, técnico de secuencias, intérprete orbital, biólogo de estación, curador de archivo.

---

## 2. Reglas de vocabulario (firewall)

Por cada turno con `meta.zone_id`:

| Prohibido si `zone_id` ≠ `zone_math` | `bosque`, `árbol`, `hoja`, `claro`, `musgo`, `fragmento de número`, `runa de conteo` |
| Prohibido si `zone_id` ≠ `zone_logic` | `espejo` como obstáculo principal en otra zona (metáfora puntual ≤1 frase solo si el mentor lo nombra explícitamente) |
| Prohibido si `zone_id` ≠ `zone_culture` | `tomo`, `página`, `archivo`, `biblioteca` |
| Global (todas las zonas) | Repetir «el equilibrio tiembla» más de **1 vez por sesión de play** |
| Global | Más de **2** de estas muletillas en un mismo turno: equilibrio, fragmento, niebla, runa, chispa |

**Validador PHP (MVP):** función `ZoneNarrativeGuard::assertCopy(string $zoneId, string $text): void` en tests y, en runtime, log `warning` si falla (no bloquear al niño en MVP).

---

## 3. Plantillas de llegada (Z0–Z2 en **un solo turno**)

Ver [SPEC_APP_ADVENTURE_TURN_PACKAGING.md](SPEC_APP_ADVENTURE_TURN_PACKAGING.md): la llegada a zona es **una burbuja**, no tres.

Estructura interna (3 párrafos cortos, separados por `\n\n` en el mismo `text`):

1. **Llegada** — dónde estamos + qué falla en **este** lugar (sensorial, 2–3 frases).
2. **NPC** — el guardián de zona habla **una** frase citada o parafraseada por el mentor (sin abrir otro chat).
3. **Problema + CTA** — qué hay que hacer (N pruebas) + invitación al primer obstáculo.

Ejemplo normativo `zone_logic` fantasy:

> Entramos en el Laberinto de Espejos. Los pasillos se repiten y cada reflejo muestra una salida distinta; solo una es real.  
> El Vigía de los Espejos aparece en un cristal roto: «Cadete, sin orden claro nos perderemos entre copias falsas.»  
> Hay **tres secuencias** que abrir la salida. Cuando quieras, afrontamos la primera.

**Prohibido** en `zone_logic`: bosque, musgo, hojas, claro, números como tema principal del escenario.

### Tono y legibilidad

| Regla | Detalle |
| --- | --- |
| Audiencia | El niño (`effective_age_band`); el tutor adulto debe entender la situación **sin releer** |
| Longitud | 280–420 caracteres por bloque de llegada (soft max); párrafos de ≤2 frases |
| Léxico | Castellano de España; evitar arcaísmos gratuitos («pergeñar», «dilucidar») |
| Fantasía | Imágenes concretas (espejo roto, pasillo) antes que abstracciones («equilibrio del saber») |
| Muletillas | «Equilibrio», «Vacío/Artefacto»: como seasoning, no en cada párrafo |

Textos literales viven en `shared/Ai/zone_narratives/{world_theme}/{zone_id}.es.md` (versionables); PHP carga plantilla + sustituye `{display_name}`, `{steps_total}`, `{mentor_name}`.

---

## 4. Entre-retos y cierre de quest

Misma biblia: `zone_between` y `zone_quest_complete` **usan plantilla de la zona activa**, no bosque genérico.

| Fase | Contenido |
| --- | --- |
| `zone_between` | 1 frase de progreso en el escenario (espejo que se aclara, página que vuelve…) + «queda reto X de N» |
| `zone_quest_complete` | Celebración **en el lugar** + oferta: otra zona / pausar sesión |

---

## 5. Relación con LLM

Cuando el LLM vista prosa (`zone_between`, reto vestido):

- Recibe `zone_bible_excerpt` (escenario + NPC + palabras permitidas/prohibidas) en el system prompt.
- El validador de [SPEC_APP_WORLD_JOURNEY_CANON.md](SPEC_APP_WORLD_JOURNEY_CANON.md) §6 amplía regla 4 con el firewall de §2.

Fallback sin LLM: plantillas de §3–4 siempre disponibles.

---

## 6. Criterios de aceptación

1. Elegir `zone_logic` fantasy **no** contiene `bosque`, `musgo`, `claro`, `hoja` en los 3 primeros turnos post-elección.
2. Elegir `zone_math` **sí** puede usar bosque/runas/números.
3. Llegada a zona = **1** burbuja mentor (ver spec de empaquetado).
4. Tests PHPUnit: `ZoneNarrativeGuardTest` + fixture por cada `zone_id`.
5. Playwright: flujo elegir espejos → una burbuja de llegada coherente → CTA obstáculo.

---

## 7. Implementación prevista (tras aprobación)

| Pieza | Ubicación |
| --- | --- |
| Cargador de plantillas | `shared/Ai/ZoneNarrativeCatalog.php` |
| Refactor `chooseZone` | `AdventureService.php` — 1 turno, copy por `zone_id` |
| Refactor between/complete | `AdventureService.php` |
| Guard de vocabulario | `shared/Ai/ZoneNarrativeGuard.php` |
| Prompt LLM | `shared/Ai/prompts/_mentor_prose_rules.es.md` + excerpt zona |
| Tests | `api/tests/ZoneNarrativeTest.php` |
