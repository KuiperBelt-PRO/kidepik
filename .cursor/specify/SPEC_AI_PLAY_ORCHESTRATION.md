# Spec: Orquestación IA de play (agentes, prompts, envelopes)

> Estado: **propuesta — pendiente de aprobación** (julio 2026)  
> Relacionado: [SPEC_AI_OPENROUTER_GATEWAY.md](SPEC_AI_OPENROUTER_GATEWAY.md), [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md), [SPEC_APP_WORLD_JOURNEY_CANON.md](SPEC_APP_WORLD_JOURNEY_CANON.md), [SPEC_APP_CHARACTER_TRAITS.md](SPEC_APP_CHARACTER_TRAITS.md), [SPEC_APP_MENTOR.md](SPEC_APP_MENTOR.md), [SPEC_APP_JOURNEY_MEMORY.md](SPEC_APP_JOURNEY_MEMORY.md), [SPEC_APP_AGE_BANDS.md](SPEC_APP_AGE_BANDS.md), [SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md), [SPEC_APP_ADVENTURE_SESSION.md](SPEC_APP_ADVENTURE_SESSION.md)  
> Patrón: PHP multi-paso (como PDA Retrieval→LLM), **no** LangGraph en MVP.

## Contexto

El gateway solo habla HTTP (solo modelos **free** rankeados). Esta spec define **quién decide qué**, qué contexto se inyecta (perfil + mentor + memoria L2/L3), qué JSON debe devolver el modelo y cómo se valida antes de aplicar effects.

**Voz:** toda salida dialogada es el [mentor persistente](SPEC_APP_MENTOR.md).

## Objetivo

1. Roles de agente por fase de producto.
2. `PlayerState` canónico inyectado al prompt.
3. Envelope JSON único de salida del diálogo.
4. Pipeline: validar reply → (opcional) clasificar → generar → validar schema → effects → persistir.
5. Separar **generación narrativa** de **scoring pedagógico** (el LLM no pone la nota global).

---

## 1. Roles (MVP)

| `agent_role` | Cuándo | Temperatura | Salida |
| --- | --- | --- | --- |
| `onboarding_host` | first_run pre-mundo (voz `mentor_neutral_host`) | 0.5 | DialogueEnvelope |
| `mentor_guide` | first_run post-mundo, aventura, exam intro/cierre | 0.5–0.6 | DialogueEnvelope (voz mentor canónico) |
| `character_coach` | choose_character (siempre como mentor) | 0.7 | DialogueEnvelope + draft traits |
| `placement_item_writer` | redactar ítem ya elegido por motor | 0.3 | ItemEnvelope |
| `placement_text_scorer` | solo short_text dudoso | 0.0–0.2 | `{ score: 0\|0.5\|1, rationale }` |
| `adventure_narrator` | beats (voz mentor) | 0.6 | DialogueEnvelope + beat meta |
| `zone_pitch_writer` | pitches post-examen / encrucijada | 0.6 | `ZonePitchBundle` — [SPEC_APP_ADVENTURE_LLM_NARRATIVE.md](SPEC_APP_ADVENTURE_LLM_NARRATIVE.md) |
| `zone_scene_writer` | llegada, between, quest complete | 0.6 | DialogueEnvelope + npc meta |
| `challenge_writer` | vestir reto curricular | 0.4 | ChallengeEnvelope |
| `challenge_result_writer` | líneas éxito/casi por zona | 0.5 | `{ success_text, near_miss_text }` |
| `waiting_copy_writer` | burbujas de espera (thinking) | 0.7 | `WaitingCopyBundle` |
| `journey_summarizer` | L2 condensed ([SPEC_APP_JOURNEY_MEMORY.md](SPEC_APP_JOURNEY_MEMORY.md)) | 0.2 | `{ summary, structured? }` |
| `safety_rewriter` | re-prompt si falla tono | 0.2 | texto limpio |

**Motor pedagógico (código PHP, no LLM):** elige `subject_id`, dificultad, tipo de ítem, umbrales, fórmula de niveles, promoción de banda, elegibilidad de rango.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Pedagogía   │────►│ Narrador /   │────►│ Validador   │
│ (PHP rules) │     │ Writer (LLM) │     │ schema+tono │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                ▼
                                         Effects + BD
```

---

## 2. PlayerState (contexto inyectado)

Construido en PHP desde Postgres; serializado compacto al system/user prompt.

```ts
interface PlayerState {
  child: {
    id: string;
    display_name: string | null;
    age_years: number | null;
    age_band: AgeBand | null;  // ver SPEC_APP_AGE_BANDS
    effective_age_band: AgeBand | null;
    world_theme: "fantasy" | "sci-fi" | null;
    mentor_id: string | null;
    rank: { id: string; label_child: string; tier: number } | null;
  };
  traits: ChildTraits | null;
  levels: { subject_id: string; level_id: string }[];
  general_level: string | null;
  journey: {
    chapter_id: string;
    active_zone_id: string | null;
    antagonist_pressure: number;
    fragments_restored: number;
  } | null;
  household: {
    narrative_tone?: string;
    avoid_themes: string[];
    active_subjects: string[];
    show_levels_to_child: boolean;
  };
  recent_beats: { sequence: number; zone?: string; narrative_text: string; choice?: string }[];
  recent_turns: { role: string; text: string }[];  // L3 dialogue window
  journey_summary: string | null;                 // L2 condensed_full
  mentor: MentorProfile;                          // ficha fija
  flow: {
    flow_id: string;
    onboarding_step?: string;
    placement_status?: string;
    session_id: string;
  };
}
```

Reglas:

- Nunca email/nombre real del tutor.
- `recent_beats`: últimos K (default 6) **completos**; más antiguo solo vía `journey_summary`.
- Si `show_levels_to_child=false`, el narrador recibe niveles pero con instrucción de **no mencionar números/L\***.

---

## 3. Envelope de diálogo (salida LLM → DTO)

Todo agente que hable con el niño debe producir JSON parseable:

```ts
interface DialogueEnvelope {
  agent_text: string;                 // burbuja principal
  input_mode: "options_only" | "text_only" | "options_or_text" | "continue" | "blocked";
  options?: { id: string; label: string }[];  // ids kebab-case estables cuando sean enums
  effects?: Effect[];                 // subset permitido por flow
  meta?: {
    phase?: string;
    subject_id?: string;
    zone_id?: string;
    npc_archetype?: string;
    chapter_id?: string;
    item_key?: string;
    emotional_tone?: "warm" | "curious" | "tense_soft" | "celebratory";
  };
}
```

### 3.1 ItemEnvelope (placement / challenge)

```ts
interface ItemEnvelope {
  item_key: string;
  subject_id: string;
  item_type: "mcq" | "short_text" | "numeric";
  difficulty: 1 | 2 | 3 | 4 | 5;
  prompt_text: string;              // narrativizado
  options?: { id: string; label: string }[];
  canonical_answer: {
    option_id?: string;
    numeric?: number;
    tolerance?: number;
    keywords?: string[];            // short_text
  };
  narrative_wrapper?: string;       // intro corta antes de la pregunta
}
```

El **banco o el motor** fija `canonical_answer`; el LLM redacta `prompt_text` + wrapper. En aventura post-examen el camino feliz es **LLM completo** con validación PHP — ver [SPEC_APP_ADVENTURE_LLM_NARRATIVE.md](SPEC_APP_ADVENTURE_LLM_NARRATIVE.md) §2.3. Placement MVP puede seguir plantilla + rewrite.

### 3.2 ChallengeEnvelope (aventura)

Extiende ItemEnvelope con:

```ts
{
  quest_id?: string;
  zone_id: string;
  success_beat_hint: string;
  fail_beat_hint: string;   // ánimo, no castigo humillante
}
```

---

## 4. Pipeline por `POST .../dialogue/turn`

```
1. Auth + ownership + cupo horario Tripulación
2. Cargar sesión + último agent turn (input_mode)
3. Validar reply vs input_mode (422 si no)
4. Guardrails pre-LLM (jailbreak / sensitive) → respuesta fija narrativa suave
5. Persist turno niño
6. Dispatcher según flow_id + onboarding_step + meta.phase:
     - first_run structured steps: a menudo **sin LLM** (opciones enum mundo) o LLM ligero
     - character_coach: LLM
     - placement: motor elige ítem → writer LLM → (score PHP o scorer LLM)
     - adventure: pedagogía elige reto o beat puro → narrator/challenge_writer
7. AiGateway.complete(purpose=...)
8. Parse JSON; si falla → 1 reintento “devuelve solo JSON”
9. Safety filter tono; si falla → safety_rewriter o plantilla
10. Filtrar effects al catálogo del flow
11. Transacción: aplicar effects + persist agent turns (+ story_beat si adventure)
12. Responder agent_turns + effects + flow_complete
```

## 4.1 Context pack (retomar)

Ver [SPEC_APP_JOURNEY_MEMORY.md](SPEC_APP_JOURNEY_MEMORY.md) §4. El dispatcher **debe** construir el pack L2+L3 antes de llamar al gateway en flows `adventure` y al reanudar `first_run`/`placement`.

---

## 4.2 Cuándo NO llamar al LLM

| Situación | Motivo |
| --- | --- |
| Elección de mundo `sci-fi`/`fantasy` | Enum cerrado |
| Edad por chip numérico | Parseo PHP |
| MCQ con option_id canónico | Score exacto |
| `continue` con guion fijo de cierre | Solo placement tier histórico; aventura post-examen **sin** guion PHP |
| Tests / fixtures | Gateway inyectado + JSON en `api/tests/fixtures/` |

**Ya no aplica** (tras [SPEC_APP_ADVENTURE_LLM_NARRATIVE.md](SPEC_APP_ADVENTURE_LLM_NARRATIVE.md)): omitir LLM en pitches, llegadas, retos y esperas de aventura «para ahorrar cuota» — usar caché de esperas y compose por lotes en su lugar.

---

## 5. System prompts (estructura, no texto final literario)

Cada rol carga un fichero versionable, p. ej.:

```
shared/Ai/prompts/
  onboarding_host.es.md
  character_coach.es.md
  placement_narrator.es.md
  placement_item_writer.es.md
  adventure_narrator.es.md
  zone_pitch_writer.es.md
  zone_scene_writer.es.md
  challenge_writer.es.md
  waiting_copy_writer.es.md
  journey_summarizer.es.md
  safety_rewriter.es.md
  _common_child_safety.es.md
```

Bloques obligatorios en `_common_child_safety` (nombre histórico; aplica a todas las bandas):

- Español de España; longitud y léxico según `age_band` ([SPEC_APP_AGE_BANDS.md](SPEC_APP_AGE_BANDS.md)).
- Hablar **siempre** como el mentor inyectado (o host neutro pre-mundo).
- Sin violencia gráfica / miedo intenso; filtros más estrictos en bandas early/child.
- No pedir datos del titular de cuenta ni direcciones.
- No romper personaje del mundo ni cambiar de mentor.
- Responder **solo** con el JSON del schema indicado.

Ficheros mentor: `shared/Ai/mentors/mentor_fantasy_guardian.es.md`, `mentor_scifi_architect.es.md`, `mentor_neutral_host.es.md`.

El prompt de sesión concatena: common + mentor profile + rol + PlayerState + L2 + L3 + instrucción de turno.

---

## 6. Catálogo de effects (unión)

| Effect | Flows |
| --- | --- |
| `set_world_theme` | first_run |
| `set_display_name` | first_run |
| `set_age` | first_run |
| `set_traits` / `patch_traits` | first_run character |
| `advance_onboarding` | first_run, placement |
| `record_answer` | placement |
| `set_subject_level` / `set_general_level` / `set_effective_age_band` | placement (al cierre, PHP) |
| `grant_rank` | placement cierre / adventure |
| `append_story_beat` | adventure |
| `set_choice` | adventure |
| `update_quest` | adventure |
| `update_journey` | adventure |
| `record_learning_result` | adventure |
| `update_subject_level` | adventure (post-reto, PHP) |
| `append_achievement` | adventure |

Los effects de **cálculo** (niveles, rango, banda) los emite el **servidor PHP** tras reglas, no el LLM. El LLM puede sugerir en `meta`, pero la fuente de verdad es código.

---

## 7. Observabilidad

- Log estructurado: `child_id`, `flow_id`, `agent_role`, `provider`, `model`, `latency_ms`, `parse_ok`.
- No loguear texto completo del niño en prod si política lo restringe; en local sí para debug.
- `dialogue_turns.model_used` + `api_usage`.

---

## 8. Criterios de aceptación

1. Un turno con reply inválido → 422 sin llamar gateway.
2. Envelope malformado → reintento; segundo fallo → 503 amable + sin effects parciales.
3. Effect fuera de catálogo del flow → descartado + log.
4. Placement score MCQ no usa LLM.
5. Adventure beat se persiste y el siguiente prompt incluye su texto (no regenera).
6. PHPUnit: parser envelope, filtro effects, PlayerState serialization snapshot.
7. Playwright: flujo post-examen → elegir zona → primer reto — smoke con LLM real local o fixture HTTP grabado.

## Aprobación

- [ ] Roles y pipeline documentados (voz mentor)
- [ ] PlayerState + DialogueEnvelope + ItemEnvelope + L2/L3
- [ ] Pedagogía PHP vs narración LLM
- [ ] Prompts versionados + safety + fichas mentor
- [ ] Effects: LLM sugiere UI; cálculos en PHP
- [ ] Solo modelos free vía gateway rankeado
