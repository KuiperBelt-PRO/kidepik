# 11 — Pipeline de aventura infantil (contrato)

**Specs:** [SPEC_APP_PLAY_FIRST_RUN.md](../specify/SPEC_APP_PLAY_FIRST_RUN.md), [SPEC_APP_PLACEMENT_EXAM.md](../specify/SPEC_APP_PLACEMENT_EXAM.md), [SPEC_APP_ADVENTURE_DIALOGUE.md](../specify/SPEC_APP_ADVENTURE_DIALOGUE.md), [SPEC_APP_ADVENTURE_SESSION.md](../specify/SPEC_APP_ADVENTURE_SESSION.md), [SPEC_APP_PROGRESSION_RANKS.md](../specify/SPEC_APP_PROGRESSION_RANKS.md)

> **Estado:** contrato de producto aprobado — **sin UI `#/play` ni orquestación IA en código** (jul 2026). Tripulación Fase A sí existe.

```mermaid
flowchart TB
  Crew["Tripulación: plaza creada\nonboarding_step=pending_entry"]
  Play["#/play/:childId futuro"]
  FR[first_run diálogo]
  World[elige mundo fantasy|sci-fi]
  Name[nombre]
  Age[edad]
  Exam[placement exam]
  Sess[adventure session]
  Rank[progression ranks marco]

  Crew --> Play
  Play --> FR
  FR --> World --> Name --> Age --> Exam --> Sess
  Sess -.-> Rank
```

## Persistencia prevista en `children`

| Campo | Uso |
| --- | --- |
| `onboarding_step` | `pending_entry` → `choose_world` → `choose_name` → `choose_age` → `placement` → `complete` |
| `world_theme` | `fantasy` \| `sci-fi` |
| `placement_status` | `not_started` \| `in_progress` \| `completed` |
| `effective_age_band` | Tras examen / edad |

## Diálogo IA (contrato)

- Turnos tipados + opciones; tema visual según mundo.
- Examen: niveles por materia + general ponderado; sin “nota” visible al niño.

## Anti-errores

- No implementar play improvisando sin Plan SDD / spec de implementación.
- No fijar mundo del niño en el alta del tutor (lo elige el niño en first_run).
- No confundir chrome de gestión con HUD de sesión de juego (specs futuras).
