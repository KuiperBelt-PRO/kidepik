# Plan: IA agentic FastAPI (Gemini + Pydantic AI + skills + ledger ficheros)

> Estado: **specs aprobadas — implementación en curso** (ago 2026)  
> Decisión extra: reset de **niveles/ranks** en cutover (confirmado).  
> Specs:
> - [SPEC_AI_GEMINI_GATEWAY.md](../specify/SPEC_AI_GEMINI_GATEWAY.md) — lista fallback Gemini
> - [SPEC_AI_PYDANTIC_AGENTS.md](../specify/SPEC_AI_PYDANTIC_AGENTS.md) — mapa fases→roles
> - [SPEC_AI_AGENT_SKILLS.md](../specify/SPEC_AI_AGENT_SKILLS.md) — Capability nativa; audience-language
> - [SPEC_AI_JOURNEY_FILE_LEDGER.md](../specify/SPEC_AI_JOURNEY_FILE_LEDGER.md) — `data/journey/` + reset cutover

## Decisiones ya cerradas (ago 2026)

| Tema | Decisión |
| --- | --- |
| Fallback modelos | Lista estática Gemini (`AI_GEMINI_MODEL_LIST`) |
| Loader skills | Capability nativa Pydantic AI (no `pydantic-ai-skills` en POC) |
| Skills Cursor / library-skills | Fuera de este hilo |
| Audiencia | Skill `audience-language` (niños y adultos); no tono infantil global |
| Histórico PHP | No migrar; **reset** first_run completo |
| Volumen | Bind-mount host `data/journey/` ↔ contenedor |

## Fases (tras aprobación)

| Fase | Entrega | Estado |
| --- | --- | --- |
| 0 | Aprobación + secrets Gemini + deps `pydantic-ai` | **hecho** |
| 1 | Gateway Gemini + clasificador errores + logs `ai` | **hecho** (tests) |
| 2 | Mount `data/journey/` + writer/reader JSONL/MD | **hecho** (tests) |
| 3 | Script reset viajeros (dry-run + apply) | **hecho** (`scripts/poc-reset-journey.ps1`) |
| 4 | Registry agentes + skills SKILL.md MVP | **hecho** |
| 5 | `mentor_guide` / onboarding E2E con Gemini real | **hecho** (smoke `app.scripts.smoke_mentor_guide`) |
| 6 | Placement + adventure purposes | **parcial** — placement vía agente; character_coach + mentor_guide en first_run |
| 7 | Cutover play → FastAPI; diagramas 04/11 | **hecho** |
| 8 | Ledger `dialogue.jsonl` + `traveler.md` | **hecho** |
| 9 | Retiro stack IA PHP | **hecho** (catálogos AgeBand/etc. conservados) |

## Fuera de alcance POC

- LangGraph / LangChain
- OpenRouter en backend agentic
- Backfill dialogue_turns → JSONL
- Scripts ejecutables dentro de skills
- Hosting prod del runtime agentic
