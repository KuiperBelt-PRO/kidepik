# Spec: Memoria del viaje (ledger + resúmenes para agentes)

> Estado: **propuesta — pendiente de aprobación** (julio 2026)  
> Relacionado: [SPEC_APP_ADVENTURE_SESSION.md](SPEC_APP_ADVENTURE_SESSION.md), [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md), [SPEC_APP_MENTOR.md](SPEC_APP_MENTOR.md), [SPEC_AI_PLAY_ORCHESTRATION.md](SPEC_AI_PLAY_ORCHESTRATION.md), [docs/kidepik.md](../../docs/kidepik.md) §7, §9

## Contexto

Además del perfil del tripulante (nombre, edad, mundo, traits, niveles), el sistema debe **trazabilidad completa** del viaje y **contexto escalonado** para el LLM al retomar.

Tres capas obligatorias:

| Capa | Nombre | Para humanos / auditoría | Para el agente |
| --- | --- | --- | --- |
| L1 | **Ledger** | Historia completa reconstruible | No se inyecta entera |
| L2 | **Resumen condensado del viaje** | Vista tutor «diario» corto | Sí — siempre |
| L3 | **Ventana reciente detallada** | Últimos pasos legibles | Sí — siempre al retomar |

## Objetivo

1. Definir qué se guarda en cada capa y con qué granularidad.
2. Definir cuándo se actualizan L2/L3.
3. Definir el paquete de contexto que recibe el mentor al continuar.
4. Garantizar que el LLM **no reescribe** el pasado del ledger.

---

## 1. Capa L1 — Ledger (fuente de verdad)

Inmutable hacia atrás (solo append; correcciones = nuevos eventos `system` o `amendment`, no delete silencioso).

### 1.1 Entidades

| Tabla / store | Contenido |
| --- | --- |
| `dialogue_turns` | Cada burbuja mentor + cada respuesta explorer (texto/opción), `flow_id`, `session_id`, `model_used` |
| `story_beats` | Beats narrativos, elecciones, intros/resultados de retos, ceremonias |
| `journey_decisions` | Vista tipada de elecciones con consecuencia (`decision_key`, `option_id`, `beat_id`, `turn_id`) |
| `placement_answers` / `session_answers` | Retos y scores |
| `narrative_quests` | Estado de misiones |
| `child_traits.achievements` | Logros narrativos append-only |

### 1.2 Evento unificado (opcional materializado)

Para exportación / timeline tutor:

```ts
interface JourneyEvent {
  id: string;
  member_id: string;
  at: string; // ISO
  kind: "mentor_utterance" | "explorer_reply" | "decision" | "challenge" | "quest" | "level" | "rank" | "system";
  ref_table: string;
  ref_id: string;
  summary: string; // una línea
}
```

Puede ser vista SQL o tabla `journey_events` alimentada por triggers/servicio.

### 1.3 Garantías

- Reabrir play **rehidrata** desde L1 (turnos/beats), no regenera.
- Tutor puede **leer** timeline (Fase B UI); no editar prosa del mentor a mano en MVP.
- Retención: igual que cuenta; borrado soft del miembro cascadea.

---

## 2. Capa L2 — Resumen condensado del viaje

Texto (y opcional JSON estructurado) que comprime **todo** el arco hasta `up_to_sequence`.

```sql
create table public.story_summaries (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  kind text not null check (kind in ('condensed_full', 'chapter')),
  chapter_id text null,
  up_to_sequence int not null,
  up_to_turn_seq int null,
  summary_text text not null,          -- 400–1200 chars objetivo
  structured jsonb null,               -- { allies, open_threads, fragments, tone }
  model_used text null,
  created_at timestamptz not null default now()
);
```

### 2.1 Cuándo regenerar / ampliar

| Gatillo | Acción |
| --- | --- |
| Cada `AI_SUMMARY_EVERY_N` beats (default **8**) | Nuevo `condensed_full` que resume summary anterior + beats nuevos |
| Fin de capítulo | `kind=chapter` archivado + refresh `condensed_full` |
| Fin de sesión de play | Refresh si hubo ≥3 beats nuevos desde el último summary |
| Manual ops / tutor «compactar» | Futuro |

Agente: `journey_summarizer` ([SPEC_AI_PLAY_ORCHESTRATION.md](SPEC_AI_PLAY_ORCHESTRATION.md)), temperatura baja. El summary **cita hechos del ledger**; si contradice L1 → descartar y reintentar o usar template extractivo.

### 2.2 Contenido mínimo del condensed

- Quién es el héroe (nombre, traits breves, rango).
- Mentor y mundo.
- Capítulo y zona actuales.
- Fragmentos restaurados / presión del antagonista.
- Hilos abiertos (1–5).
- Decisiones mayores (ids + label corto).
- Nivel narrativo de progreso (sin spamear L1–L5 al tono niño; sí puede guardar levels en `structured` para el motor).

---

## 3. Capa L3 — Ventana reciente detallada

No es un summary LLM obligatorio: es el **recorte literal** de L1 para el prompt.

| Parámetro | Default |
| --- | --- |
| Últimos K `story_beats` completos | **6** (`AI_RECENT_BEATS=6`) |
| Últimos T `dialogue_turns` del flow activo | **12** (`AI_RECENT_TURNS=12`) |
| Última quest activa | 1 objeto completo |
| Último reto (enunciado + resultado) | 1 |

Al **retomar** tras días: se inyecta L2 (condensado) + L3 (reciente). Si el hueco es enorme, el summarizer puede producir un puente «desde tu última visita…» **sin** borrar L1.

---

## 4. Paquete de contexto al agente (retomar viaje)

Orden en el prompt (después de system + mentor profile + PlayerState perfil):

```
1. MENTOR_PROFILE (fijo)
2. PLAYER_PROFILE (traits, levels, band, rank, journey counters)
3. JOURNEY_CONDENSED (L2 latest condensed_full)
4. RECENT_WINDOW (L3 beats + turns)
5. CURRENT_GOAL (quest step / onboarding phase / placement item plan)
6. LAST_USER_REPLY
```

Presupuesto tokens: truncar primero turnos antiguos de L3, nunca eliminar L2 entero sin sustituir.

---

## 5. Conversaciones con el mentor

Toda conversación **es** el ledger de `dialogue_turns` con `role=mentor|explorer`.

- No hay tabla paralela «chat» distinta del play.
- Buscar / exportar: por `child_id` + tiempo + `flow_id`.
- Decisiones con options: duplicar en `journey_decisions` para queries («¿cuándo eligió zona_math?»).

---

## 6. API (lectura)

| Endpoint | Uso |
| --- | --- |
| `GET /api/v1/play/{id}/journey/timeline?cursor=` | Página de JourneyEvents (tutor) |
| `GET /api/v1/play/{id}/journey/summary` | Latest L2 |
| Diálogo session | Ya devuelve turns (L3 parcial) |

Escritura solo vía pipeline de turn/effects (no POST libre de summary desde cliente).

---

## 7. Criterios de aceptación

1. Tras 8 beats, existe `condensed_full` nuevo con `up_to_sequence` correcto.
2. Al retomar, el prompt mock incluye L2 + últimos beats literales.
3. Borrar un beat antiguo vía API no está permitido (403/405).
4. Export timeline lista mentor utterances y decisiones en orden.
5. PHPUnit: construcción del context pack; presupuesto de truncado.

## Aprobación

- [ ] Tres capas L1 ledger / L2 condensado / L3 ventana reciente
- [ ] Conversaciones mentor = dialogue_turns
- [ ] Context pack al retomar documentado
- [ ] Summarizer no puede contradecir el ledger
