# Spec: Empaquetado de turnos y eco de elecciones (play)

> Estado: **propuesta — pendiente de aprobación** (1 ago 2026)  
> Relacionado: [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md), [SPEC_APP_ADVENTURE_STORY_RICHNESS.md](SPEC_APP_ADVENTURE_STORY_RICHNESS.md), [SPEC_APP_ADVENTURE_ZONE_BIBLE.md](SPEC_APP_ADVENTURE_ZONE_BIBLE.md), [SPEC_APP_JOURNEY_MEMORY.md](SPEC_APP_JOURNEY_MEMORY.md)

## Contexto / síntomas

1. Tras elegir zona, el servidor devuelve **3 turnos** `zone_arrive` (`arrive_step` 1–3); el cliente pinta **3 burbujas** mentor seguidas. El usuario espera **una sola** burbuja narrativa.
2. En elección de camino, el patrón de **varias tarjetas** (intro + una carta por opción) **sí** es deseable — pero no está formalizado.
3. Tras decidir, solo aparece la burbuja del explorador con la opción elegida; las **descartadas** no quedan visibles en el historial.
4. El motor puede volver a ofrecer zonas ya **superadas** en encrucijadas posteriores.

## Objetivo

Contrato claro de **cuántas burbujas**, **qué va en cada una**, y **cómo se muestran elecciones pasadas** — sin perder memoria para el mentor.

---

## 1. Principio general

| Tipo de momento | Burbujas en historial | Opciones / cartas |
| --- | --- | --- |
| **Narración continua** (llegada, entre-retos, feedback reto) | **1** burbuja mentor por beat | CTA único (`continue`) o chips del reto |
| **Elección con contexto** (zona, camino, bifurcación) | **1** burbuja mentor de encuadre | **N cartas** (una por opción) en el pie — no repetir cuerpo en la burbuja |
| **Resolución de elección** | Burbuja explorador (elegida) + **eco visual** de descartadas | Descartadas no clicables |

---

## 2. Elección de destino (`phase=choose_zone`)

### 2.1 Secuencia UI (aprobada por producto)

1. **Turno A** — `admission_map` o intro: 1 burbuja mentor (cierre de examen / «hay caminos abiertos»). `input_mode: continue`.
2. **Turno B** — `choose_zone`: 1 burbuja mentor **breve** (`zonePitchMapText`) + **hasta 3 cartas** en el pie (`play-world-hint` / grid), cada una con `label`, `description`, `why_for_you`.
3. **No** volcar `description` + `why_for_you` dentro de la burbuja mentor (ya corregido parcialmente).

### 2.2 Persistencia

- `story_beats` `beat_kind=choice` con `choices_offered` completo.
- `meta.choices_offered` en el turno `choose_zone`.

---

## 3. Tras elegir zona (`phase=choice_resolved` + `zone_arrive`)

### 3.1 Respuesta del servidor (orden de inserción)

Tras `reply.kind=option` con `zone_*`:

| # | `role` | Contenido | UI |
| --- | --- | --- | --- |
| 1 | `explorer` | Label de la zona elegida | Burbuja explorador (ya existe) |
| 2 | `system` o `mentor` | Eco de elección | Ver §3.2 |
| 3 | `mentor` | Llegada unificada Z0–Z2 | **1 burbuja**; `phase=zone_arrive`, `arrive_step` omitido o `1` |
| — | (pie) | CTA «Afrontar el obstáculo» | `input_mode: continue` en turno 3 |

**Prohibido:** devolver array `turns` con 3 entradas `zone_arrive` para el mismo beat de llegada.

### 3.2 Eco de opciones descartadas

Objetivo: el tutor ve qué se ofreció y qué se dejó para después; el mentor tiene contexto en ledger y en historial UI.

**Modelo de turno:**

```ts
interface ChoiceResolutionMeta {
  phase: "choice_resolved";
  decision_key: "choose_zone";
  choices_offered: ZonePitchOption[];
  choice_taken: { id: string; label: string };
  choices_discarded: { id: string; label: string }[];
}
```

**UI (`play.js`):**

- Tras la burbuja explorador, renderizar bloque `play-choice-echo`:
  - Carta **elegida**: estilo actual, marca «Elegido».
  - Cartas **descartadas**: mismo layout, clase `play-choice-card--discarded` (opacidad ~0.55, sin hover, `aria-disabled`, tachado suave en título).
- Texto mentor opcional corto: «Dejamos {A} y {B} para más adelante.» (1 frase; nombres de zona, no repetir descriptions).

**Ledger:** actualizar `story_beats.choice_taken`; `journey_decisions` ya registra la elegida — añadir fila o JSON en beat con `discarded_option_ids`.

---

## 4. Zonas superadas — no re-ofertar

### 4.1 Definición «superada»

Una zona cuenta como **superada** cuando su quest intro `Q_zone_intro_{zone}` pasa a `status=completed` en `narrative_quests` (los N gates hechos — hoy N=3).

Visita abandonada o en curso **no** cuenta como superada.

### 4.2 Persistencia

```json
// children.settings.journey
{
  "zones_completed": ["zone_math"],
  "zones_offered_pending": ["zone_logic", "zone_culture"]
}
```

- Al `quest` → `completed`: añadir `zone_id` a `zones_completed` (sin duplicados).
- `AdventureService::zonePitches()` **excluye** ids en `zones_completed`.
- Si quedan 0 zonas pendientes: transición a capítulo siguiente o `session_wrap` (fuera de MVP C1).

### 4.3 Encrucijada (`phase=adventure_crossroads`)

- Misma UI que §2 (intro + cartas).
- Solo zonas **no** superadas y materias activas.
- Si solo queda 1: intro «Solo queda un territorio por explorar…» + 1 carta.

### 4.4 Memoria del mentor

- `JourneyContextPack` incluye `zones_completed` y últimas `choices_discarded`.
- El LLM puede decir «La Biblioteca esperará» pero **no** debe emitir chip `zone_culture` si está en `zones_completed`.

---

## 5. Otros beats (resumen)

| `phase` | Burbujas mentor por transición |
| --- | --- |
| `adventure_challenge` | 1 (situación + enunciato vestido) |
| `zone_between` | 1 |
| `zone_quest_complete` | 1 |
| `session_wrap` | 1 |

---

## 6. API / cliente

### 6.1 Respuesta `submitTurn`

- `agent_turns`: máximo **1** turno narrativo por beat planificado (salvo `choice_resolved` que es eco + llegada = 2 mentor/system + 1 llegada, o eco integrado en llegada).
- Cliente: bucle `agent_turns` sin cambiar; al reducir servidor, se arregla solo.

### 6.2 Rehidratar sesión

Al abrir play, turnos históricos con `meta.phase=choice_resolved` deben renderizar eco de descartadas (no solo al vuelo).

---

## 7. Criterios de aceptación

1. Elegir zona → **≤2** burbujas mentor antes del primer reto (eco + llegada), nunca 3 de llegada.
2. Historial muestra elegida + descartadas con estilo diferenciado.
3. Tras completar Bosque, `zone_math` no aparece en siguiente `choose_zone`.
4. PHPUnit: empaquetado de `chooseZone` devuelve 1 turno `zone_arrive`.
5. Playwright: captura con eco de descartadas visible.

---

## 8. Archivos afectados (implementación)

| Archivo | Cambio |
| --- | --- |
| `AdventureService.php` | Unificar turnos; filtrar pitches; `zones_completed` |
| `DialogueService.php` | Insertar `choice_resolved`; no duplicar turnos |
| `JourneyContextPack.php` | Exponer zonas superadas / descartadas |
| `web/js/scenes/play.js` | Render eco + histórico |
| `web/css/scenes/play.css` | `.play-choice-card--discarded` |
| `PlacementService.php` | Tras finalize, inicializar `zones_offered_pending` |
