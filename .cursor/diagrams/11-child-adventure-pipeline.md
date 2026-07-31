# 11 — Pipeline de aventura infantil (contrato)

**Specs:** [SPEC_APP_PLAY_FIRST_RUN.md](../specify/SPEC_APP_PLAY_FIRST_RUN.md), [SPEC_APP_CHARACTER_TRAITS.md](../specify/SPEC_APP_CHARACTER_TRAITS.md), [SPEC_APP_AGE_BANDS.md](../specify/SPEC_APP_AGE_BANDS.md), [SPEC_APP_MENTOR.md](../specify/SPEC_APP_MENTOR.md), [SPEC_APP_JOURNEY_MEMORY.md](../specify/SPEC_APP_JOURNEY_MEMORY.md), [SPEC_APP_PLACEMENT_EXAM.md](../specify/SPEC_APP_PLACEMENT_EXAM.md), [SPEC_APP_ADVENTURE_DIALOGUE.md](../specify/SPEC_APP_ADVENTURE_DIALOGUE.md), [SPEC_APP_ADVENTURE_SESSION.md](../specify/SPEC_APP_ADVENTURE_SESSION.md), [SPEC_APP_PROGRESSION_RANKS.md](../specify/SPEC_APP_PROGRESSION_RANKS.md), [SPEC_APP_WORLD_JOURNEY_CANON.md](../specify/SPEC_APP_WORLD_JOURNEY_CANON.md), [SPEC_AI_OPENROUTER_GATEWAY.md](../specify/SPEC_AI_OPENROUTER_GATEWAY.md), [SPEC_AI_PLAY_ORCHESTRATION.md](../specify/SPEC_AI_PLAY_ORCHESTRATION.md)

> **Estado:** contratos + **propuestas IA** (jul 2026) — **sin UI `#/play` en código**. Plan: [tasks/AI_ADVENTURE_SYSTEM_PLAN.md](../tasks/AI_ADVENTURE_SYSTEM_PLAN.md). Tripulantes: **cualquier edad** (5–99).

```mermaid
flowchart TB
  Crew["Tripulación: plaza\npending_entry"]
  Play["#/play/:id futuro"]
  Host[Host neutro pre-mundo]
  World[elige mundo]
  Mentor[Mentor canónico\nGuardián / Arquitecto]
  Name[nombre]
  Age[edad → age_band]
  Char[traits]
  Exam[placement]
  Zone[zona]
  Sess[adventure]
  Mem["Memoria L1 ledger\nL2 condensado\nL3 reciente"]
  Free[OpenRouter free\ndiscovery+rank]

  Crew --> Play --> Host --> World --> Mentor
  Mentor --> Name --> Age --> Char --> Exam --> Zone --> Sess
  Free -.-> Mentor
  Free -.-> Sess
  Mem --- Sess
  Mem --- Mentor
```

## Persistencia

| Capa | Qué |
| --- | --- |
| Perfil | mundo, nombre, edad/banda, traits, niveles, mentor_id |
| L1 | dialogue_turns + story_beats + decisions (trazable) |
| L2 | story_summaries condensed_full |
| L3 | últimos beats/turns al retomar |

## Anti-errores

- No implementar sin aprobación P0 del plan.
- No modelos de pago (`AI_ALLOW_PAID=false`).
- No segunda voz de chat: solo mentor.
- No versionar `OPENROUTER_API_KEY`.
