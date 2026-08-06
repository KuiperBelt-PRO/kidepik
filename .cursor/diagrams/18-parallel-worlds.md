# 18 — Mundos en paralelo y cambio de tema

**Specs:** [SPEC_APP_PARALLEL_WORLDS.md](../specify/SPEC_APP_PARALLEL_WORLDS.md), [SPEC_AI_JOURNEY_FILE_LEDGER.md](../specify/SPEC_AI_JOURNEY_FILE_LEDGER.md), [SPEC_WORLD_LAYERS_PERSISTENCE.md](../specify/SPEC_WORLD_LAYERS_PERSISTENCE.md)

## Ledger por mundo

```mermaid
flowchart TB
  Child[child_id] --> Core[traveler.md núcleo]
  Child --> AW[active_world_theme en PG]
  Child --> F[worlds/fantasy]
  Child --> S[worlds/sci-fi]
  F --> FD[dialogue.jsonl]
  F --> FE[sessions/*/events.jsonl]
  F --> FS[summary / condensed]
  S --> SD[dialogue.jsonl]
  S --> SE[sessions/*/events.jsonl]
  S --> SS[summary / condensed]
  AW -->|fantasy| F
  AW -->|sci-fi| S
```

## Decisión: cambiar de mundo

```mermaid
flowchart TD
  A([Usuario pide cambiar mundo]) --> B{¿Permiso / PIN OK?}
  B -- NO --> X[Rechazar]
  B -- SI --> C[Persistir active_world_theme]
  C --> D{¿Existe ledger del destino?}
  D -- NO --> E[First-run de ese mundo<br/>mantiene núcleo traveler]
  D -- SI --> F[Retomar dialogue/sesión destino]
  E --> G[UI tema + mentor del destino]
  F --> G
  G --> H([Play en mundo activo])
  H -.->|no toca| Other[Ledger y niveles del otro mundo]
```

## Generación agnóstica + decoración

```mermaid
flowchart LR
  Ped[Pedido pedagógico<br/>materias/nivel/edad] --> Core[Core agnóstico<br/>ítems/retos]
  Core --> Dec{¿Mundo activo?}
  Dec -->|fantasy| DF[Decoración fantasy<br/>world-canon + glossary]
  Dec -->|sci-fi| DS[Decoración sci-fi]
  DF --> Out[Envelope + prosa]
  DS --> Out
```

## Anti-errores

- No mezclar turnos fantasy y sci-fi en el mismo `dialogue.jsonl`.
- Subir nivel en un mundo no muta `user_subject_levels` del otro.
