# 15 — Orquestador y agentes de play

**Specs:** [SPEC_AI_CENTRAL_ORCHESTRATOR.md](../specify/SPEC_AI_CENTRAL_ORCHESTRATOR.md), [SPEC_AI_PYDANTIC_AGENTS.md](../specify/SPEC_AI_PYDANTIC_AGENTS.md), [SPEC_AI_AGENT_SKILLS.md](../specify/SPEC_AI_AGENT_SKILLS.md), [SPEC_AI_GEMINI_GATEWAY.md](../specify/SPEC_AI_GEMINI_GATEWAY.md), [SPEC_APP_WORLD_GLOSSARY.md](../specify/SPEC_APP_WORLD_GLOSSARY.md), [SPEC_APP_DICTATION.md](../specify/SPEC_APP_DICTATION.md) *(propuesta)*, [SPEC_AI_GEMINI_TTS.md](../specify/SPEC_AI_GEMINI_TTS.md)

> Mapa del **runtime de IA de producto** (no confundir con [14](14-cursor-doc-routing.md), que orienta al agente de Cursor).

## Arquitectura

```mermaid
flowchart TB
  UI[Play UI] --> Svc[DialogueService / compose]
  Svc --> Orch[Orchestrator.run]
  Orch --> Plan{¿Qué rol(es) necesita<br/>este TurnContext?}
  Plan --> Sub[Subagente desde agents/*.md]
  Plan --> Multi[Varios subagentes<br/>p.ej. path_composer ×3]
  Sub --> Skills[Skills declaradas]
  Sub --> Tools
  Multi --> Tools
  subgraph Tools[Tools]
    G[glossary_search DuckDB]
    L[ledger_query DuckDB/FS]
    P[leer flags/niveles PG]
  end
  Sub --> Env[Envelope tipado]
  Multi --> Env
  Env --> Orch
  Orch --> FS[(Ledger JSONL/MD)]
  Orch --> PG[(Supabase flags/niveles)]
  Orch --> Svc
  Svc --> UI
  GW[GeminiGateway quality/lite] -.-> Sub
  GW -.-> Multi
```

## Mapa fase → agente(s)

```mermaid
flowchart LR
  subgraph FirstRun
    PE[pending_entry / choose_world] --> OH[onboarding_host]
    NA[choose_name / age] --> MG[mentor_guide]
    CH[choose_character] --> CC[character_coach]
  end
  subgraph Placement
    PL[prueba acceso] --> PC[placement_composer]
    PL --> PTS[placement_text_scorer opcional]
  end
  subgraph Adventure
    PATH[elegir caminos] --> PAC[path_composer]
    RETO[reto / escena] --> CW[challenge_writer]
    RETO --> NPC[npc_scenes opcional]
  end
  subgraph Dictation
    DT[teoría / listen / foto] --> DC[dictation_composer]
    DT --> TTS[dictation_tts]
    DT --> DG[dictation_grader visión]
  end
  subgraph Memory
    FIN[cierre sesión/camino] --> JS[journey_summarizer lite]
    FIN --> TR[tutor_report]
  end
  Orch2[Orchestrator] --- FirstRun
  Orch2 --- Placement
  Orch2 --- Adventure
  Orch2 --- Dictation
  Orch2 --- Memory
```

## Árbol de decisión del orquestador (turno)

```mermaid
flowchart TD
  Start([TurnContext]) --> W{¿Hay mundo activo?}
  W -- NO --> Host[onboarding_host]
  W -- SI --> Step{¿onboarding_step / fase?}
  Step -->|nombre/edad| Mentor[mentor_guide]
  Step -->|personaje| Coach[character_coach]
  Step -->|placement compose| Place[placement_composer<br/>+ waiting_phrases]
  Step -->|placement item respuesta| Score{¿MCQ?}
  Score -- SI --> Code[Scoring en código]
  Score -- NO --> TScore[placement_text_scorer]
  Step -->|path compose| Paths[path_composer × materias flojas]
  Step -->|reto en curso| Chal[challenge_writer / mentor_guide breve]
  Step -->|dictation compose| DicC[dictation_composer + TTS]
  Step -->|dictation foto| DicG[dictation_grader]
  Step -->|cierre| Sum[journey_summarizer + tutor_report]
  Step -->|diálogo libre mentor| Mentor
  Host --> Out[Validar envelope]
  Mentor --> Out
  Coach --> Out
  Place --> Out
  Code --> Out
  TScore --> Out
  Paths --> Out
  Chal --> Out
  DicC --> Out
  DicG --> Out
  Sum --> Out
  Out --> Persist[Append ledger + PG si flags]
  Persist --> Err{¿Cuota/modelo OK?}
  Err -- NO --> Fail[AiProductError]
  Err -- SI --> Done([TurnResult → UI])
```

## Skills típicas por rol

| Rol | Skills (orientativo) | Tier |
| --- | --- | --- |
| onboarding_host | safety-tone, audience-language | quality |
| mentor_guide | mentor-voice, world-canon, audience-language, safety-tone | quality |
| character_coach | character-traits, audience-language, safety-tone | quality |
| placement_composer | placement-exam, subject-pedagogy, audience-language | quality |
| path_composer | challenge-design, zone-pitches, world-canon, glossary tool | quality |
| challenge_writer | challenge-design, npc-scenes, evaluation-rubric | quality |
| journey_summarizer | journey-summary | lite |
| dictation_composer | dictation-orthography, audience-language, safety-tone, mentor-voice | lite |
| dictation_grader | dictation-orthography, evaluation-rubric, audience-language | lite + imagen |
| dictation_tts | — (gateway TTS) | Gemini Flash TTS |

## Anti-errores

- No llamar `run_purpose` desde el service en el camino feliz: pasar por Orchestrator.
- No mezclar este diagrama con el árbol 14 (Cursor).
- Sin PlacementBank: compose siempre agentic.
