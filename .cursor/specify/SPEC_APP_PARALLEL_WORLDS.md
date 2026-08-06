# Spec: Mundos en paralelo (fantasy + sci-fi)

> Estado: **aprobada** (ago 2026)  
> Relacionado: [SPEC_DATA_STORAGE_LAYERS.md](SPEC_DATA_STORAGE_LAYERS.md), [SPEC_AI_JOURNEY_FILE_LEDGER.md](SPEC_AI_JOURNEY_FILE_LEDGER.md), [SPEC_APP_JOURNEY_MECHANICS.md](SPEC_APP_JOURNEY_MECHANICS.md), [SPEC_WORLD_LAYERS_PERSISTENCE.md](SPEC_WORLD_LAYERS_PERSISTENCE.md), [SPEC_APP_PROGRESSION_RANKS.md](SPEC_APP_PROGRESSION_RANKS.md)  
> **Diagrama:** [18-parallel-worlds.md](../diagrams/18-parallel-worlds.md)

## Contexto

El viajero puede **cambiar de mundo** (fantasy ↔ sci-fi) sin perder el hilo del otro. La pedagogía (examen/retos) debe poder generarse de forma **agnóstica** y decorarse dos veces si hace falta; el ledger guarda viajes **en paralelo**.

## Objetivo

1. Modelo de progreso y ledger por `world_theme`.
2. Reglas de cambio de mundo en cualquier momento (con guardas UX).
3. Generación agnóstica + decoración temática.

---

## 1. Decisiones

| # | Decisión | Valor |
| --- | --- | --- |
| P1 | Paralelismo | Un viajero puede tener viaje fantasy **y** sci-fi |
| P2 | Ledger | Árbol por mundo bajo el mismo `child_id` |
| P3 | Progreso PG | Niveles/rango **por mundo** `(child_id, world_theme)` |
| P4 | Mundo activo | Flag en `children` o sesión: `active_world_theme` |
| P5 | Generación | Core pedagógico agnóstico → decoración fantasy/sci-fi |
| P6 | `traveler.md` | Núcleo compartido + overlay opcional por mundo |
| P7 | UI tema | El tema visual del play sigue el mundo **activo** |

---

## 2. Layout de archivos

```
data/journey/{parent_id}/{child_id}/
  index.json                 # active_world, paths
  traveler.md                # núcleo: nombre, especie, personalidad base
  worlds/
    fantasy/
      dialogue.jsonl
      traveler-world.md      # atuendo/tono fantasy (opcional)
      journey-condensed.md
      sessions/{session_id}/
        events.jsonl         # incluye estado examen/caminos
        summary.md
        meta.json
    sci-fi/
      …igual…
```

`dialogue.jsonl` **por mundo** (no mezclar turnos de temas distintos en el mismo fichero).

---

## 3. Postgres (progreso)

Sustituir/ampliar el modelo de un solo `rank_track`:

```sql
-- conceptual
create table public.child_world_progress (
  child_id uuid references public.children(id) on delete cascade,
  world_theme text not null check (world_theme in ('fantasy', 'sci-fi')),
  general_level text null,
  rank_id text null,
  placement_status text not null default 'not_started',
  onboarding_step text null,  -- o solo el global en children
  updated_at timestamptz not null default now(),
  primary key (child_id, world_theme)
);

create table public.user_subject_levels (
  -- añadir world_theme a la PK si aún no existe
  child_id uuid,
  world_theme text,
  subject_id text,
  level_id text,
  primary key (child_id, world_theme, subject_id)
);
```

`children.active_world_theme` indica cuál usa play ahora.

---

## 4. Cambio de mundo

1. Tutor o viajero (según permisos) elige el otro mundo.
2. Se persiste `active_world_theme`.
3. Play abre/continúa el ledger de ese mundo (first-run de ese mundo si no existe).
4. No se borra el ledger del mundo anterior.
5. Niveles del otro mundo no se sobrescriben.

Generación: el orquestador puede pedir ítems/retos **agnósticos** y luego un subagente `world_decorator` (o skill `world-canon`) produce la prosa del mundo activo; opcionalmente cachear ambas decoraciones si se prepara pack dual (fase 2).

---

## 5. Criterios de aceptación

1. Dos mundos del mismo niño tienen `dialogue.jsonl` independientes.
2. Subir nivel en fantasy no muta `user_subject_levels` de sci-fi.
3. Cambio de mundo activo refleja UI + mentor del tema.
4. Ledger layout documentado también en [SPEC_AI_JOURNEY_FILE_LEDGER](SPEC_AI_JOURNEY_FILE_LEDGER.md).

## Fuera de alcance

- Transferencia automática de XP entre mundos.
- Un solo transcript mezclado.
