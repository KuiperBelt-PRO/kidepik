# Spec: Skills de agentes de producto — Pydantic AI

> Estado: **aprobada** (ago 2026) — **delta 18 ago 2026:** placement-exam / subject-pedagogy / challenge-design: conocimiento escolar previo vs lore inventado. **delta 20 ago 2026:** anti-tautología de significado; compose sin reintento pedagógico.  
> Hilo: IA agentic FastAPI  
> Relacionado: [SPEC_AI_PYDANTIC_AGENTS.md](SPEC_AI_PYDANTIC_AGENTS.md), [SPEC_AI_GEMINI_GATEWAY.md](SPEC_AI_GEMINI_GATEWAY.md), [SPEC_AI_JOURNEY_FILE_LEDGER.md](SPEC_AI_JOURNEY_FILE_LEDGER.md), [SPEC_APP_WORLD_JOURNEY_CANON.md](SPEC_APP_WORLD_JOURNEY_CANON.md), [SPEC_APP_ADVENTURE_ZONE_BIBLE.md](SPEC_APP_ADVENTURE_ZONE_BIBLE.md), [SPEC_APP_AGE_BANDS.md](SPEC_APP_AGE_BANDS.md), [SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md)

## Contexto

Esta spec define **una sola capa**: skills de **runtime** para los agentes Pydantic AI de la app (`backend/skills/`).

**Fuera de alcance:** skills de Cursor / library-skills / `pydantic/skills` para desarrolladores. Se gestionan fuera de este hilo; no se documentan ni se instalan desde estas specs.

Las skills **no** son «contenido infantil». La app atiende exploradores de distintas edades (niños y adultos). El **ajuste de lenguaje, complejidad y tono** es responsabilidad de skill(s) dedicadas (`audience-language`, y donde aplique fragmentos en otras), alimentadas por `age_band` / preferencias en `RunDeps` — no una norma global «siempre habla como a un niño de 8 años» en el system prompt.

Estándar de formato: [agentskills.io](https://agentskills.io) (`SKILL.md` + progressive disclosure).

## Objetivo

1. Catálogo de skills por dominio (mundo, retos, examen, resumen, evaluación, audiencia…).
2. Formato, carga diferida y binding a `purpose`.
3. Fijar el **loader canónico** (decisión §1 S6).
4. Separar system corto vs instrucciones largas en skills.

---

## 1. Decisiones

| # | Decisión | Valor |
| --- | --- | --- |
| S1 | Formato | Directorio con `SKILL.md` (YAML frontmatter + cuerpo) |
| S2 | Carga | Progressive disclosure (`defer_loading` / load on demand) |
| S3 | Ubicación | `backend/skills/` (versionado en git) |
| S4 | Binding | Cada `purpose` declara `skill_ids`; no registrar el catálogo entero en cada run |
| S5 | Scripts en skills | POC: **solo** instrucciones + `references/*.md`; sin scripts ejecutables |
| S6 | Loader | **Capability nativa de Pydantic AI** (ver §4) — no paquete `pydantic-ai-skills` en POC |
| S7 | Audiencia | Lenguaje adaptativo vía skill(s), no tono infantil hardcodeado |

### 1.1 ¿Por qué Capability nativa y no `pydantic-ai-skills`?

| Criterio | Capability nativa (Pydantic AI) | `pydantic-ai-skills` (terceros) |
| --- | --- | --- |
| Dependencias | Ya viene con `pydantic-ai` | Paquete extra + acoplamiento de versión |
| POC (instrucciones + MD) | Suficiente: `Capability(id, description, instructions, defer_loading=True)` desde `SKILL.md` | Overkill |
| Scripts / registries git | No hace falta en POC | Útil más adelante |
| Mantenimiento | Primera parte del framework que ya elegimos | Otro release cycle |

**Decisión:** implementar un loader fino `load_skill(path) -> Capability` (patrón docs oficiales) + filtrar por `skill_ids` del purpose. Revisar `SkillsCapability` **first-party** de Pydantic AI si la versión pinneada lo expone como API estable equivalente; **no** añadir `pydantic-ai-skills` salvo necesidad futura de scripts.

---

## 2. Layout

```
backend/skills/
  audience-language/
    SKILL.md
    references/
      bands-overview.md
  mentor-voice/
    SKILL.md
  world-canon/
    SKILL.md
    references/
      fantasy-zones.md
      scifi-zones.md
  zone-bible/
    SKILL.md
  zone-pitches/
    SKILL.md
  npc-scenes/
    SKILL.md
  challenge-design/
    SKILL.md
  subject-pedagogy/
    SKILL.md
    references/
      subjects-overview.md
  placement-exam/
    SKILL.md
  evaluation-rubric/
    SKILL.md
  journey-summary/
    SKILL.md
  waiting-copy/
    SKILL.md
  onboarding-flow/
    SKILL.md
  character-traits/
    SKILL.md
  safety-tone/
    SKILL.md
```

Nombres: `kebab-case`, ≤64 chars.

### 2.1 Frontmatter

```yaml
---
id: audience-language
name: Audience Language
description: >
  Adapta registro, longitud de frase y vocabulario al age_band
  (y flags de hogar). Cargar en todo diálogo orientado al explorador.
metadata:
  kidepik:
    domains: [voice, accessibility]
    purposes: [mentor_guide, onboarding_host, adventure_narrator, …]
---
```

Cuerpo: reglas operativas; `references/` cortos. No pegar specs enteras.

---

## 3. Catálogo POC

| Skill id | Dominio | Cuándo | Esencial |
| --- | --- | --- | --- |
| `audience-language` | Audiencia | Diálogo al explorador | Mapear `age_band` (y adulto) → registro, longitud, metáforas; **no** asumir niño |
| `mentor-voice` | Voz | Diálogo mentor | Identidad Guardián/Arquitecto; coherencia de personaje |
| `world-canon` | Mundo | Narración / pitches / escenas | Canon viaje, anti-incoherencias |
| `zone-bible` | Mundo | Llegada / between / quest | Constraints `zone_id` |
| `zone-pitches` | Mundo | Encrucijadas | Variedad pitches / arcos |
| `npc-scenes` | Mundo | Escenas NPC | Arquetipos; anti-eco opciones |
| `challenge-design` | Retos | Vestir / resultado | Currículo narrado; lore del mundo solo si acaba de enseñarse |
| `subject-pedagogy` | Currículo | Retos + placement | Catálogo materias; dificultad por banda; `mythology` = mitos reales |
| `placement-exam` | Examen | Ítems placement | Formato; ES-ES; conocimiento escolar previo; sin lore inventado |
| `evaluation-rubric` | Evaluación | Scorer texto | 0 / 0.5 / 1 + rationale |
| `journey-summary` | Memoria | Summarizer | MD + front matter; no contradecir JSONL |
| `waiting-copy` | UX espera | Bubbles | Variantes mundo × audiencia |
| `onboarding-flow` | First run | Host / pasos | Orden first_run |
| `character-traits` | Perfil | choose_character | Draft traits |
| `safety-tone` | Safety | Rewrite / bloqueos | Límites de contenido **proporcionales a la audiencia** (no «siempre infantil») |

### 3.1 Binding

Ver [SPEC_AI_PYDANTIC_AGENTS §4–§5](SPEC_AI_PYDANTIC_AGENTS.md). Máximo ~4–5 skill ids registradas por run; el modelo carga 1–2 cuerpos según tarea. `audience-language` + `mentor-voice` suelen ir juntas en purposes de diálogo.

---

## 4. Integración (loader canónico)

```python
from pathlib import Path
import yaml
from pydantic_ai import Agent
from pydantic_ai.capabilities import Capability

def load_skill(path: Path) -> Capability:
    _, frontmatter, body = path.read_text(encoding="utf-8").split("---", 2)
    meta = yaml.safe_load(frontmatter)
    return Capability(
        id=meta["id"],
        description=meta["description"],
        instructions=body.strip(),
        defer_loading=True,
    )

def skills_for(purpose: str) -> list[Capability]:
    ids = PURPOSE_SKILL_IDS[purpose]
    root = Path(__file__).resolve().parents[2] / "skills"  # backend/skills
    return [load_skill(root / sid / "SKILL.md") for sid in ids]

agent = Agent(
    f"google:{model}",
    output_type=DialogueEnvelope,
    instructions=BASE_SYSTEM_SHORT,
    capabilities=skills_for("mentor_guide"),
)
```

### 4.1 System vs skill

| System (siempre, corto) | Skill (bajo demanda) |
| --- | --- |
| Rol del agente / purpose | Canon de zonas, rúbricas, formatos MD |
| Idioma base ES-ES | Adaptación fina por banda (`audience-language`) |
| Safety dura mínima | Matiz safety por audiencia |
| Recordatorio de envelope | Biblia de zona, pedagogía detallada |

---

## 5. Criterios de aceptación

1. Catálogo §3 con `SKILL.md` válido.
2. Purpose `zone_scene_writer` no registra `evaluation-rubric`.
3. Progressive disclosure: cuerpo completo no va en el prompt inicial.
4. Cambio de skill sin tocar routers.
5. Sin dependencias ni docs de library-skills / Cursor en este hilo.
6. Tests: discovery + filtro por purpose (sin Gemini).

## Aprobación

- [x] Una sola capa: skills de agentes de producto *(decidido)*
- [x] Loader = Capability nativa *(recomendación fijada)*
- [x] Audiencia adaptativa por skill, no tono infantil global *(decidido)*
- [ ] Catálogo §3 como MVP
