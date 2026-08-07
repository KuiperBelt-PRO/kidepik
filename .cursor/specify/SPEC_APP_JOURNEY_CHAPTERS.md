# Spec: Capítulos del viaje (título de escena en play)

> Estado: **propuesta — pendiente de aprobación** (ago 2026)  
> Relacionado: [SPEC_APP_MENTOR.md](SPEC_APP_MENTOR.md), [SPEC_APP_PLAY_FIRST_RUN.md](SPEC_APP_PLAY_FIRST_RUN.md), [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md), [SPEC_APP_JOURNEY_MECHANICS.md](SPEC_APP_JOURNEY_MECHANICS.md), [SPEC_APP_SECTION_FRAME.md](SPEC_APP_SECTION_FRAME.md), [SPEC_APP_ADVENTURE_SESSION.md](SPEC_APP_ADVENTURE_SESSION.md)

## Contexto

En play, bajo el logotipo KidepiK, hay una línea centrada (`data-mentor-name`, clase `play-panel__mentor`) que hoy muestra el **nombre del mentor** (p. ej. «El Guardián del Conocimiento»). En la práctica actúa como **ancla narrativa** de la escena actual, pero no refleja el arco del viaje ni las decisiones del explorador.

La idea de producto: tratar el viaje como una **historia por capítulos**. Cada fase relevante (elección de mundo, nombre, personaje, prueba de ingreso, llegada a zona, etc.) tendría un **título de capítulo** legible para el niño y el tutor, distinto del nombre del mentor en la burbuja.

## Objetivo

1. Separar **quién habla** (mentor en burbuja) de **en qué capítulo estamos** (título superior).
2. Actualizar el título al avanzar `onboarding_step`, fase de placement o `chapter_id` de aventura.
3. Persistir capítulos en historial / timeline tutor sin sobrecargar cada turno.

---

## 1. Conceptos

| Concepto | Descripción |
| --- | --- |
| `chapter_id` | Clave estable interna (`prelude`, `choose_world`, `forge_name`, …) |
| `chapter_title` | Texto mostrado bajo el logo («El umbral», «La forja del nombre», …) |
| `mentor.display_name` | Sigue siendo el hablante de las burbujas IA (spec mentor) |
| `scene_heading` | Sinónimo UI de `chapter_title` en play |

**Regla:** el título de capítulo **no** sustituye al nombre del mentor en la cabecera de burbuja; son capas distintas.

---

## 2. Mapeo MVP (first_run + placement)

| `onboarding_step` / fase | `chapter_id` | `chapter_title` (ejemplo) |
| --- | --- | --- |
| `pending_entry`, `choose_world` | `prelude` | **El umbral** |
| Tras `set_world_theme` (transición) | `mentor_revealed` | **El mentor se presenta** |
| `choose_name` | `forge_name` | **La forja del nombre** |
| `choose_age` | `measure_years` | **La medida de los años** |
| `choose_character` / traits | `shape_hero` | **La forma del héroe** |
| `placement` (handoff) | `rite_entry` | **El rito de ingreso** |
| `placement` (ítems activos) | `rite_entry` | **La prueba del saber** |
| `complete` → aventura | `adventure` | Título de zona activa o «La aventura comienza» |

Títulos literales finales pueden variar por `world_theme` y `age_band` (sci-fi: «La cartografía del nombre»; banda menor: frases más cortas).

---

## 3. Aventura (post-onboarding)

Cuando `flow_id = adventure` y existe `active_zone_id` / `chapter_id` en sesión:

| Fuente | `chapter_title` |
| --- | --- |
| `zone_bible.title` o pitch de zona | Nombre de la zona («El bosque de los ecos») |
| Transición entre zonas | «Camino a …» / «Nuevo horizonte» |
| Boss / fragmento | Título evento puntual (evento, no capítulo largo) |

El mentor puede **mencionar** el capítulo en prosa; el título UI viene del **sistema**, no del LLM (evita títulos inventados o spoilers).

---

## 4. UI (play)

```
┌─────────────────────────────────┐
│ [←]     [logo KidepiK]          │
│        El umbral                │  ← chapter_title (nuevo contrato)
│  ┌ mentor ───────────────────┐  │
│  │ ◉ El Guía                 │  │  ← display_name mentor (burbuja)
│  │ «Texto…»                  │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

- Elemento actual `data-mentor-name` → renombrar a `data-chapter-title` (o dual durante migración).
- Tipografía: misma banda que hoy (`play-panel__mentor` → `play-panel__chapter`).
- Skeleton: una línea glass mientras no hay `chapter_title`.
- **No** mostrar `chapter_id` técnico al usuario.

---

## 5. API

Extender respuestas de diálogo / sesión play:

```json
{
  "mentor": { "id": "host", "display_name": "El Guía", "mentor_id": "mentor_neutral_host" },
  "chapter": {
    "id": "prelude",
    "title": "El umbral"
  }
}
```

| Campo | Origen |
| --- | --- |
| `chapter.id` | Resolver servidor según `onboarding_step`, `flow_id`, `active_zone_id` |
| `chapter.title` | Catálogo estático + variantes por mundo/edad; aventura desde zone bible |

Efectos tipados (opcional fase 2): `set_chapter: { id, title }` en effects de turno cuando el LLM no debe decidir título.

---

## 6. Persistencia y timeline tutor

- `dialogue_turns.meta.chapter_id` en turnos donde cambia el capítulo.
- Evento ledger `chapter_opened` con `{ chapter_id, title, world_theme }`.
- Timeline tripulación: fila «Capítulo: El umbral» al abrir prelude (icono distinto de `mentor_utterance`).

---

## 7. IA y orquestador

- Los agentes **no** generan `chapter_title` en MVP salvo copy narrativo dentro de `agent_text`.
- El orquestador resuelve capítulo **antes** del turno y lo incluye en `RunDeps.player_state.chapter`.
- Prompt: «El capítulo actual se llama {title}; no lo repitas como encabezado; intégralo en la escena si encaja.»

---

## 8. Criterios de aceptación

1. Pre-mundo: título «El umbral» (o equivalente); mentor en burbuja «El Guía».
2. Tras elegir fantasy: título pasa a fase mentor/nombre; burbuja firma «El Guardián del Conocimiento».
3. Cambio de `onboarding_step` actualiza título sin recargar página.
4. En aventura, título refleja zona activa cuando hay `zone_bible`.
5. Timeline tutor registra apertura de capítulo.
6. Tests: resolver `chapter` por estado; UI muestra `chapter.title` ≠ `mentor.display_name`.

## Aprobación

- [ ] Separar título de capítulo vs nombre de mentor
- [ ] Catálogo MVP first_run + placement
- [ ] Campo `chapter` en API play
- [ ] Persistencia timeline / meta turnos
- [ ] Aventura: título por zona (fase 2 si hace falta acotar MVP)
