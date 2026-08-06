# Spec: Agentes de play con Pydantic AI (FastAPI)

> Estado: **aprobada** (ago 2026) — **canónica**: todo diálogo play vía agentes Gemini; sin guion fijo PHP  
> Hilo: IA agentic FastAPI  
> Relacionado: [SPEC_AI_GEMINI_GATEWAY.md](SPEC_AI_GEMINI_GATEWAY.md), [SPEC_AI_AGENT_SKILLS.md](SPEC_AI_AGENT_SKILLS.md), [SPEC_AI_JOURNEY_FILE_LEDGER.md](SPEC_AI_JOURNEY_FILE_LEDGER.md), [SPEC_AI_PLAY_ORCHESTRATION.md](SPEC_AI_PLAY_ORCHESTRATION.md), [SPEC_APP_PLAY_FIRST_RUN.md](SPEC_APP_PLAY_FIRST_RUN.md), [SPEC_APP_MENTOR.md](SPEC_APP_MENTOR.md), [SPEC_APP_ADVENTURE_LLM_NARRATIVE.md](SPEC_APP_ADVENTURE_LLM_NARRATIVE.md), [SPEC_APP_AGE_BANDS.md](SPEC_APP_AGE_BANDS.md)

## Contexto

Reimplementación de la orquestación PHP ([SPEC_AI_PLAY_ORCHESTRATION](SPEC_AI_PLAY_ORCHESTRATION.md)) con **[Pydantic AI](https://pydantic.dev/)**: agentes tipados, `output_type`, capabilities/skills. **Sin LangGraph / LangChain** como orquestador.

Esta spec **define el mapa de agentes y roles por fase de la app** (onboarding → placement → aventura → memoria → UX espera). Hereda envelopes; cambia el motor.

## Objetivo

1. Pydantic AI como framework único de agentes en `backend/`.
2. Mapa claro **fase de producto → purpose → Agent → skills → envelope**.
3. Pedagogía en código vs prosa/evaluación asistida por LLM.
4. Integrar skills y ledger ficheros.

---

## 1. Decisiones

| # | Decisión | Valor |
| --- | --- | --- |
| A1 | Framework | **Pydantic AI** |
| A2 | No usar | LangGraph, LangChain chains |
| A3 | Modelo | Lista Gemini ([SPEC_AI_GEMINI_GATEWAY](SPEC_AI_GEMINI_GATEWAY.md)) |
| A4 | Salida | `output_type` = envelopes Pydantic |
| A5 | Skills | Capability nativa + `backend/skills/` ([SPEC_AI_AGENT_SKILLS](SPEC_AI_AGENT_SKILLS.md)) |
| A6 | Orquestación | Services FastAPI eligen `purpose` e invocan un Agent; sin grafo global |
| A7 | Voz dialogada | Mentor canónico cuando ya hay mundo; host neutro solo pre-mundo ([SPEC_APP_MENTOR](SPEC_APP_MENTOR.md)) |
| A8 | Audiencia | `age_band` (y adulto) vía skill `audience-language`; no tono infantil fijo |
| A9 | First_run | **Sin plantillas hardcodeadas** de mentor: `onboarding_host` / `mentor_guide` / `character_coach` generan cada burbuja |
| A10 | Persistencia | Cada turno → `dialogue.jsonl` + eco sesión; traits → `traveler.md` ([SPEC_AI_JOURNEY_FILE_LEDGER](SPEC_AI_JOURNEY_FILE_LEDGER.md)) |
| A11 | PHP IA | Retirado ([SPEC_AI_PHP_STACK_RETIREMENT](SPEC_AI_PHP_STACK_RETIREMENT.md)) |

---

## 2. Layout

```
backend/app/ai/
  gemini_gateway.py
  agents/
    deps.py
    registry.py          # PURPOSE_REGISTRY
    envelopes.py
    onboarding.py        # host + mentor first_run steps
    placement.py
    adventure.py
    summarizer.py
    waiting.py
    safety.py
backend/skills/          # SPEC_AI_AGENT_SKILLS
backend/app/services/
  dialogue.py            # turn loop
  adventure.py
  placement.py
  journey_reset.py       # cutover / tutor reset (ledger + flags)
```

Flujo: **router → service (purpose + pedagogía) → agent.run → validar → Postgres (estado) + ledger (transcript)**.

---

## 3. `RunDeps`

```python
class RunDeps(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    child_id: UUID
    session_id: str
    purpose: str
    player_state: PlayerState
    mentor: MentorProfile | None     # None en host pre-mundo
    world_theme: Literal["fantasy", "sci-fi"] | None
    age_band: str | None
    audience: AudienceContext        # age_band, is_adult-ish flags, prefs
    ledger: JourneyLedgerPort
    catalogs: CatalogBundle
```

- Sin email/nombre real del tutor.
- L2/L3 desde ledger ficheros.
- Append al ledger solo vía puerto.

---

## 4. Fases de la app → agentes

### 4.1 Vista por fase (normativa)

```
first_run (SPEC_APP_PLAY_FIRST_RUN)
  pending_entry / choose_world     → onboarding_host
  choose_name / choose_age         → mentor_guide (+ audience-language)
  choose_character                 → character_coach
placement                          → placement_item_writer
                                   → placement_text_scorer (solo short_text dudoso)
adventure
  zone pitches                     → zone_pitch_writer
  arrival / between / quest        → zone_scene_writer  (alias adventure_narrator)
  challenge dress / result         → challenge_writer / challenge_result_writer
  generic mentor turns             → mentor_guide
waiting UX                         → waiting_copy_writer
session / journey memory           → journey_summarizer
safety retry                       → safety_rewriter
```

**Código no-LLM (siempre):** elegir `subject_id`, dificultad, tipo de ítem, umbrales de nivel, elegibilidad de rango, máquina `onboarding_step` / `flow_id`.

### 4.2 Tabla purpose → Agent

| `purpose` | Fase | Responsabilidad | `output_type` | Skills (ids) |
| --- | --- | --- | --- | --- |
| `onboarding_host` | First run pre-mundo | Bienvenida; presentar elección de mundo; voz neutra | `DialogueEnvelope` | `onboarding-flow`, `audience-language` |
| `mentor_guide` | First run post-mundo, aventura, cierres | Diálogo mentor canónico | `DialogueEnvelope` | `mentor-voice`, `audience-language`, `world-canon` |
| `character_coach` | `choose_character` | Co-crear traits (como mentor) | `DialogueEnvelope` | `character-traits`, `mentor-voice`, `audience-language` |
| `placement_item_writer` | Examen | Redactar ítem ya elegido por motor | `ItemEnvelope` | `placement-exam`, `subject-pedagogy`, `audience-language` |
| `placement_text_scorer` | Examen | Score short_text dudoso | `ScoreEnvelope` | `evaluation-rubric` |
| `zone_pitch_writer` | Post-examen / encrucijada | Bundle de pitches de zona | `ZonePitchBundle` | `world-canon`, `zone-pitches`, `audience-language` |
| `zone_scene_writer` | Aventura | Llegada, between, quest complete, NPCs | `DialogueEnvelope` | `world-canon`, `zone-bible`, `npc-scenes`, `mentor-voice`, `audience-language` |
| `challenge_writer` | Aventura | Vestir reto curricular | `ChallengeEnvelope` | `challenge-design`, `subject-pedagogy`, `audience-language` |
| `challenge_result_writer` | Aventura | success / near_miss | `ChallengeResultEnvelope` | `challenge-design`, `mentor-voice`, `audience-language` |
| `waiting_copy_writer` | UX | Bubbles de espera | `WaitingCopyBundle` | `waiting-copy`, `audience-language` |
| `journey_summarizer` | Memoria | Summary MD + structured | `SessionSummaryEnvelope` | `journey-summary` |
| `safety_rewriter` | Transversal | Reescribir si falla tono/safety | texto / envelope mínimo | `safety-tone`, `audience-language` |

Alias: `adventure_narrator` ≡ `zone_scene_writer` en registry (un solo Agent).

### 4.3 Diagrama

```
┌──────────────┐     ┌─────────────────────┐     ┌──────────────┐
│ Pedagogía    │────►│ Pydantic AI Agent   │────►│ Validador    │
│ (Python)     │     │ + Gemini lista      │     │ output_type  │
│ + flow state │     │ + skills Capability │     │ + effects    │
└──────────────┘     └──────────┬──────────┘     └──────┬───────┘
                                │                       ▼
                                │              Postgres (perfil/flags/niveles)
                                ▼
                         JSONL + MD (transcript / resúmenes)
```

---

## 5. Envelopes

Modelos Pydantic alineados a [SPEC_AI_PLAY_ORCHESTRATION §3](SPEC_AI_PLAY_ORCHESTRATION.md):

- `DialogueEnvelope`, `ItemEnvelope`, `ChallengeEnvelope`, `ChallengeResultEnvelope`
- `ZonePitchBundle`, `WaitingCopyBundle`, `ScoreEnvelope`
- `SessionSummaryEnvelope` → cuerpo MD + dict front-matter

Post-check: effects permitidos por `flow_id`, longitudes según audiencia, mentor_id coherente. Fallo → `ai_compose_failed`.

---

## 6. Ciclo de turno

1. `POST …/dialogue/turn` → service.
2. Cargar perfil Postgres + L2/L3 ledger.
3. Resolver `purpose` según `flow_id` / `onboarding_step` / beat plan.
4. Pedagogía (si aplica) elige ítem/zona/dificultad.
5. `registry.run(purpose, prompt, deps)`.
6. Validar; effects → Postgres; eventos → JSONL; gatillos → `summary.md`.
7. Respuesta HTTP paritaria con `web/` (+ `error_code` Gemini si falla).

---

## 7. Reset de viajeros (cutover agentic)

Al activar el camino FastAPI agentic **no** se migra historial PHP → JSONL. Sí es **obligatorio** dejar a todos los tripulantes en el **punto inicial** del viaje para repetir:

mundo → nombre → edad → descripción/traits → examen de ingreso

Contrato detallado: [SPEC_AI_JOURNEY_FILE_LEDGER §10](SPEC_AI_JOURNEY_FILE_LEDGER.md#10-reset-de-viajeros-cutover). Semántica alineada a [SPEC_APP_PLAY_FIRST_RUN](SPEC_APP_PLAY_FIRST_RUN.md) (`onboarding_step = pending_entry` + limpieza).

---

## 8. Testing

| Tipo | Cómo |
| --- | --- |
| Unit | `TestModel`; envelopes; registry purpose→skills |
| Unit | Máquina first_run → purpose correcto |
| Integration | Smoke Gemini opcional |
| Prohibido | `AI_MOCK` en runtime producto |

---

## 9. Criterios de aceptación

1. Tabla §4.2 completa en `PURPOSE_REGISTRY` (aunque algunos purposes se implementen por fases).
2. `mentor_guide` E2E con Gemini + skills + JSONL.
3. Sin `langgraph` / `langchain` en deps de producto.
4. `audience-language` presente en purposes de diálogo al explorador.
5. Cutover reset deja tripulantes en `pending_entry` (ver ledger §10).
6. Diagramas 04/11 actualizados al implementar.

## Aprobación

- [x] Pydantic AI; mapa fases→agentes ampliado *(decidido)*
- [ ] Tabla §4.2 como contrato de roles
- [ ] Pedagogía en código; prosa en agentes
- [ ] Paridad HTTP play
