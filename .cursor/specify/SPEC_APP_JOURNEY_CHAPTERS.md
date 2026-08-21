# Spec: Capítulos del viaje (título de escena en play)

> Estado: **aprobada** (ago 2026)  
> Relacionado: [SPEC_APP_MENTOR.md](SPEC_APP_MENTOR.md), [SPEC_APP_PLAY_FIRST_RUN.md](SPEC_APP_PLAY_FIRST_RUN.md), [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md), [SPEC_APP_JOURNEY_MECHANICS.md](SPEC_APP_JOURNEY_MECHANICS.md), [SPEC_APP_SECTION_FRAME.md](SPEC_APP_SECTION_FRAME.md), [SPEC_APP_ADVENTURE_SESSION.md](SPEC_APP_ADVENTURE_SESSION.md), [SPEC_APP_WORLD_JOURNEY_CANON.md](SPEC_APP_WORLD_JOURNEY_CANON.md)

## Contexto

En play, bajo el logotipo KidepiK, hay una línea centrada que hoy muestra el **nombre del mentor** (`data-mentor-name`). En la práctica actúa como ancla narrativa, pero mezcla **quién habla** con **en qué parte de la historia estamos**.

La idea de producto: el viaje se lee como **historia por capítulos**, con tres macro-fases antes de la aventura libre, y capítulos de aventura ligados al **camino elegido**.

## Objetivo

1. Separar **mentor** (burbuja) de **capítulo** (rótulo fijo bajo el logo).
2. Usar **tres macro-capítulos** hasta terminar el examen: umbral → rito → aventura.
3. En aventura, el **título del capítulo lo fija el LLM** según el camino elegido (pitch / intro del path).
4. El título de capítulo **permanece siempre visible** al hacer scroll del diálogo.

---

## 1. Conceptos

| Concepto | Descripción |
| --- | --- |
| `chapter_id` | Clave estable interna (`umbral`, `rito`, `adventure`, o id de capítulo de camino) |
| `chapter_title` | Texto mostrado bajo el logo |
| `mentor.display_name` | Habla en la burbuja ([SPEC_APP_MENTOR.md](SPEC_APP_MENTOR.md)) |
| `scene_heading` | Sinónimo UI de `chapter_title` |

**Regla:** capítulo ≠ mentor. El mentor puede nombrar el capítulo en prosa; el rótulo UI es contrato aparte.

---

## 2. Macro-fases (producto acordado)

No hay un capítulo distinto por cada paso de onboarding. Hasta el examen solo existen **dos** títulos de sistema; después, los de aventura.

| Fase | `chapter_id` | `chapter_title` | Cubre |
| --- | --- | --- | --- |
| First-run completo **antes** del examen | `umbral` | **Catálogo por mundo** (§2.2) | `pending_entry` … `choose_character` hasta handoff al examen |
| Examen de ingreso (placement) | `rito` | **Catálogo por mundo** (§2.2) | `placement`, handoff, ítems activos |
| Aventura | `adventure:…` | **LLM** (§3); fallback §2.2 | Tras `onboarding_step === 'complete'` |

**No** se fragmenta el umbral en subtítulos por paso de onboarding; eso vive en el diálogo.

### 2.2 Catálogo normativo por `world_theme`

El servidor resuelve `chapter.title` con `chapter_id` + `world_theme` del viajero. **Obligatorio** variante por mundo en `umbral` y `rito`. En aventura el LLM genera el título; si falla, fallback del catálogo.

| `chapter_id` | `world_theme` | `chapter_title` (normativo) |
| --- | --- | --- |
| `umbral` | `null` (pre-mundo) | **El umbral** |
| `umbral` | `fantasy` | **El umbral** |
| `umbral` | `sci-fi` | **La puerta estelar** |
| `rito` | `fantasy` | **La prueba del saber** |
| `rito` | `sci-fi` | **La prueba de acceso** |
| `adventure` (fallback LLM) | `fantasy` | **La senda continúa** |
| `adventure` (fallback LLM) | `sci-fi` | **Rumbo desconocido** |

**Transición pre-mundo → mundo:** mientras `world_theme` es `null`, rótulo «El umbral». Tras `set_world_theme`, **misma fase** `umbral` pero título pasa a la fila fantasy/sci-fi (cambio visible al elegir mundo, sin cambiar `chapter_id`).

**`age_band` (opcional MVP+):** misma clave de catálogo; si `band_young` o equivalente, permitir alias más cortos en fichero (p. ej. fantasy `rito` → «La prueba»; sci-fi `rito` → «La prueba»). No inventar en cliente.

Implementación de referencia (código, no LLM):

```ts
// data/chapters/system_titles.es.json (o módulo Python equivalente)
{
  "umbral": { "neutral": "El umbral", "fantasy": "El umbral", "sci-fi": "La puerta estelar" },
  "rito": { "fantasy": "La prueba del saber", "sci-fi": "La prueba de acceso" },
  "adventure_fallback": {
    "fantasy": "La senda continúa",
    "sci-fi": "Rumbo desconocido"
  }
}
```

API: incluir `chapter.world_theme` cuando ayude al cliente a auditar; `chapter.title` ya viene resuelto.

### 2.3 Transiciones

| Evento | `chapter_id` | Quién fija `chapter_title` |
| --- | --- | --- |
| Entrada a play (first_run) | `umbral` | Catálogo sistema |
| Handoff a placement | `rito` | Catálogo sistema |
| Fin examen → aventura | primer capítulo del camino | LLM (al abrir camino / pitch) |
| Avance dentro del camino | `adventure:<path_id>:<chapter_seq>` | LLM al abrir cada capítulo del path |

---

## 3. Aventura — título desde el camino (LLM)

En aventura el nombre del capítulo **sí sale del LLM**, porque deriva del **camino elegido** por el explorador (pitch, intro del path, beat narrativo del capítulo).

| Origen | Cuándo |
| --- | --- |
| Agente de pitch / path / zone_scene | Al presentar caminos o al abrir un capítulo del path seleccionado |
| Persistencia | `session` / ledger: `chapter_title` validado se guarda y reutiliza hasta cambio de capítulo |

**Contrato LLM:**

- Campo dedicado en envelope o effect tipado: `set_chapter: { id, title }` **o** `chapter_title` en meta del turno que abre capítulo.
- Validación servidor: longitud (p. ej. 4–48 chars), sin saltos de línea, castellano, sin spoilers de capítulos futuros.
- Fallback si falla compose: título de `adventure_fallback` en §2.2 según `world_theme` + reintento en background; **no** dejar rótulo vacío.

El mentor integra el nombre en `agent_text` si encaja; el rótulo UI **no** se infiere parseando la burbuja — viene del estado `chapter` de la sesión.

---

## 4. UI — siempre visible (fuera del scroll)

```
┌─────────────────────────────────┐
│ [←]     [logo KidepiK]          │  ← section-frame__header (fijo)
│        El umbral                │  ← chapter_title (FIJO, hasta 2 líneas)
├─────────────────────────────────┤
│ ▲ scroll                        │
│ │  burbujas mentor / explorador │
│ │  chips del turno vigente      │
│ ▼                               │
├─────────────────────────────────┤
│ equipaje plegado / compose      │  ← footer fijo (COMPOSE_COMPACT)
└─────────────────────────────────┘
```

**Delta 21 ago 2026 (propuesta):** títulos largos de aventura **no** se recortan a 18 rem ni a una sola línea con ellipsis. Wrap ≤ 2 líneas; detalle en [SPEC_APP_PLAY_COMPOSE_COMPACT.md](SPEC_APP_PLAY_COMPOSE_COMPACT.md) §4.

### 4.1 Reglas de layout

| Regla | Decisión |
| --- | --- |
| Ubicación | `chapter_title` en **cabecera del marco** (`section-frame__header` / brand), **debajo del logo**, **fuera** de `.section-frame__scroll` |
| Overflow (play) | Hasta **2 líneas**; brand sin cap `18rem`; ver [SPEC_APP_PLAY_COMPOSE_COMPACT](SPEC_APP_PLAY_COMPOSE_COMPACT.md) §4 |
| No scrollea | Solo `.play-panel__log` (y contenido de diálogo) vive dentro del área con scroll; el rótulo de capítulo **no** puede quedar dentro de `[data-log]` |
| Migración | `data-mentor-name` → `data-chapter-title`; clase `play-panel__mentor` → `play-panel__chapter` |
| Skeleton | Una línea glass en cabecera mientras no hay `chapter.title` |
| Accesibilidad | `aria-live="polite"` al cambiar capítulo; no anunciar en cada burbuja |

Implementación de referencia: reutilizar slot de título bajo logo en [SPEC_APP_SECTION_FRAME.md](SPEC_APP_SECTION_FRAME.md) o slot dedicado `section-frame__chapter` entre `__header` y `__scroll`.

---

## 5. API

Extender respuestas de diálogo / sesión play:

```json
{
  "mentor": {
    "id": "host",
    "display_name": "El Guía",
    "mentor_id": "mentor_neutral_host"
  },
  "chapter": {
    "id": "umbral",
    "title": "La puerta estelar",
    "source": "system",
    "world_theme": "sci-fi"
  }
}
```

En aventura:

```json
{
  "chapter": {
    "id": "adventure:path_alpha:2",
    "title": "El bosque de los ecos",
    "source": "llm",
    "path_id": "path_alpha"
  }
}
```

| Campo | Origen |
| --- | --- |
| `chapter.id` | Resolver: `umbral` \| `rito` \| `adventure:…` según fase y camino |
| `chapter.title` | Catálogo §2.2 (`umbral`, `rito`) o LLM validado (aventura) |
| `chapter.world_theme` | Mundo usado para resolver título de catálogo (`null` \| `fantasy` \| `sci-fi`) |
| `chapter.source` | `system` \| `llm` — auditoría y tests |

`chapter` se envía en **open session**, **submit turn** y **resync** cuando cambia.

---

## 6. Persistencia y timeline tutor

- `dialogue_turns.meta.chapter_id` cuando cambia el capítulo.
- Ledger `chapter_opened`: `{ chapter_id, title, source, world_theme, path_id? }`.
- Timeline tutor: «Capítulo: El umbral» / «Capítulo: El bosque de los ecos» con icono distinto de `mentor_utterance`.

---

## 7. IA y orquestador

| Fase | Quién define título |
| --- | --- |
| `umbral`, `rito` | Servidor (catálogo); LLM solo lo puede **mencionar** en prosa |
| Aventura | LLM al abrir capítulo del camino; servidor valida y persiste |

Prompt (aventura): «Propón `chapter_title` corto para este tramo del camino {path_label}; devuélvelo en meta/effect; no uses el título como encabezado duplicado en agent_text.»

Orquestador: incluir `player_state.chapter` en `RunDeps` antes de cada turno.

---

## 8. Criterios de aceptación

1. Pre-examen: rótulo de catálogo `umbral` por mundo (§2.2); pre-mundo «El umbral» hasta elegir tema.
2. Placement: rótulo de catálogo `rito` por mundo («La prueba del saber» / «La prueba de acceso»).
3. En aventura: rótulo = título LLM del capítulo del camino elegido, persistido y estable entre turnos del mismo capítulo.
4. Al hacer scroll del historial, el rótulo de capítulo **sigue visible** (no sale del viewport del marco).
5. Cambio de macro-fase o de capítulo de aventura actualiza rótulo sin recargar página.
6. Timeline tutor registra `chapter_opened`.
7. Tests: resolver `chapter` por fase; UI sticky/fuera de scroll; validación LLM + fallback.

## Aprobación

- [x] Macro-fases: umbral → rito → aventura
- [x] Catálogo `umbral` / `rito` / fallback aventura **por mundo** (§2.2)
- [x] Aventura: título de capítulo desde LLM / camino elegido
- [x] Rótulo siempre visible (fuera de scroll)
- [x] Campo `chapter` en API play
- [x] Persistencia timeline / meta turnos
- [x] Validación y fallback de títulos LLM
