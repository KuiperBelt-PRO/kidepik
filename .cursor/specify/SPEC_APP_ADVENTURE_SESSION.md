# Spec: Sesión de aventura (post-examen) — detalle MVP

> Estado: **propuesta — pendiente de aprobación** (julio 2026) — **sustituye el vacío del marco** manteniendo handoffs previos  
> Relacionado: [SPEC_APP_WORLD_JOURNEY_CANON.md](SPEC_APP_WORLD_JOURNEY_CANON.md), [SPEC_AI_PLAY_ORCHESTRATION.md](SPEC_AI_PLAY_ORCHESTRATION.md), [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md), [SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md), [SPEC_APP_PROGRESSION_RANKS.md](SPEC_APP_PROGRESSION_RANKS.md), [docs/kidepik.md](../../docs/kidepik.md) §7–8  
> El archivo histórico marcó esto como aplazado; **esta versión llena el detalle** para implementación por fases.

## Contexto

Con `onboarding_step === complete` y placement hecho, el explorador vive un **viaje generativo persistente**: la trama del Vacío / Artefacto estructura capítulos y zonas; los retos de aprendizaje se insertan como obstáculos narrativos; cada beat guardado es canónico.

## Objetivo

1. Anatomía de una **sesión de juego** (tiempo, beats, retos).
2. Modelo de datos (`story_beats`, summaries, quests, learning).
3. Loop pedagógico dentro del viaje.
4. Reanudación, límites tutor y UI mínima MVP (diálogo-first; mapa opcional stub).
5. Vertical slice acordado vs alcance completo.

---

## 1. Handoff de entrada

```
placement completed
  → beat de admisión (rango inicial)
  → elegir primera zona (2–3 opciones)
  → quest Q_zone_intro
  → loop de sesión adventure
```

`flow_id = "adventure"`. Chrome play (sin drawer tutor); rango visible como título; niveles ocultos al niño por defecto.

---

## 2. Anatomía de una sesión

### 2.1 Límites

| Parámetro | Default MVP | Fuente |
| --- | --- | --- |
| Duración objetivo | 8–15 min | Ajustes hogar / cupo Tripulación |
| Beats narrativos puros / sesión | 2–4 | motor |
| Retos de aprendizaje / sesión | 1–2 | motor |
| Duración reto | 2–4 min | pedagogía |
| Salida | PIN si `require_exit_pin` | crew |

Al alcanzar límite de tiempo o cupo: cierre narrativo suave + persistencia; no cortar a mitad de scoring sin guardar respuesta.

### 2.2 Micro-loop

```
abrir/reanudar adventure session
  → (si no hay zona) pedir elección de zona
  → narrador: beat de situación (append_story_beat)
  → ¿toca reto? 
        sí → challenge_writer + input niño + score PHP
            → beat éxito/ánimo + record_learning_result
            → posible update_subject_level / update_journey / append_achievement
        no → options de camino (set_choice) → siguiente beat
  → ¿fin sesión o quest step?
        → summarizer si toca
        → salir o continuar
```

### 2.3 Cuándo insertar reto

El planificador PHP elige insertar reto si:

1. Llevamos ≥1 beat desde el último reto en la sesión, y
2. Queda presupuesto de retos, y
3. La quest activa tiene un `learning_gate` pendiente, o
4. Heurística: rotar materia débil cada N minutos.

Prioridad de `subject_id`:

1. Materia de `active_zone_id`.
2. Si esa materia está L5 y hay otra &lt; L3, ofrecer **viaje corto** a otra zona (1 sesión) — opcional MVP+.

---

## 3. Quests

```ts
interface NarrativeQuest {
  id: string;
  child_id: string;
  zone_id: string;
  chapter_id: string;
  title_child: string;
  status: "active" | "completed" | "abandoned";
  steps_total: number;
  steps_done: number;
  learning_gates: { subject_id: string; done: boolean }[];
}
```

Ejemplo intro zona math fantasy: «Ayuda al guardián del Bosque de los Números a recuperar 2 runas de conteo».

Al completar quest:

- `fragments_restored += 1`
- `append_achievement`
- Posible subida de rango si `general_level` / reglas lo permiten
- Oferta de encrucijada (`C2`) o seguir en zona

---

## 4. Modelo de datos

### 4.1 `story_beats`

```sql
create table public.story_beats (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  session_id uuid null,
  sequence_num int not null,
  chapter_id text not null,
  zone_id text null,
  beat_kind text not null check (beat_kind in (
    'narration', 'choice', 'challenge_intro', 'challenge_result', 'quest_update', 'ceremony'
  )),
  narrative_text text not null,
  choices_offered jsonb null,
  choice_taken jsonb null,
  learning_ref uuid null,          -- session_answers / learning id
  dialogue_turn_id uuid null,
  model_used text null,
  created_at timestamptz not null default now(),
  unique (child_id, sequence_num)
);
```

### 4.2 `story_summaries`

```sql
create table public.story_summaries (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  up_to_sequence int not null,
  summary_text text not null,
  created_at timestamptz not null default now()
);
```

Regla: cada **8** beats (configurable `AI_SUMMARY_EVERY_N=8`) generar resumen acumulado; el prompt usa el **último** summary + beats posteriores.

### 4.3 `learning_sessions` / `session_answers`

Alineado a docs §9: sesión de juego puede agrupar 1–2 respuestas; cada una con `subject_id`, score, difficulty, `item_key`.

### 4.4 `children` / journey jsonb

```ts
settings.journey | columnas:
  chapter_id, active_zone_id, antagonist_pressure, fragments_restored, adventure_unlocked, mentor_id
```

### 4.5 Capas de memoria

Detalle normativo: [SPEC_APP_JOURNEY_MEMORY.md](SPEC_APP_JOURNEY_MEMORY.md).

- L1: `story_beats` + `dialogue_turns` + decisiones (append-only).
- L2: `story_summaries` `condensed_full` cada N beats / fin de sesión.
- L3: últimos K beats + T turns inyectados al retomar.

Esta spec de sesión **no** regenera prosa pasada; solo añade.

---

## 5. Loop de aprendizaje (post-placement)

### 5.1 Tras cada reto

| Resultado score | Narrativa | Nivel |
| --- | --- | --- |
| 1.0 | Éxito + fragmento / runa | accuracy_rolling↑; si racha, posible L↑ |
| 0.5 | Casi; mentor ayuda | rolling leve↑ |
| 0.0 | Ánimo; pista; **no** humillación | rolling↓; si racha fallos, bajar difficulty_modifier |

Reglas exactas de subida/bajada L\* (calibrables):

- Subir nivel materia: rolling ≥ 0.80 en ≥ 4 intentos recientes de esa materia y difficulty acorde.
- Bajar: rolling ≤ 0.35 en ≥ 4 intentos (techo emocional: máximo −1 nivel por día).

`general_level` se recalcula con la misma fórmula ponderada del placement.

`grant_rank_if_eligible`: si `general_level` permite tier superior al `rank_id` actual → ceremonia corta (`beat_kind=ceremony`).

### 5.2 Adaptación Vygotsky

Dificultad del siguiente ítem = f(`level_id`, `effective_age_band`, `difficulty_modifier`). El Vacío “presiona” (`antagonist_pressure`) solo en **tono**, no endurece unfair el ítem.

---

## 6. UI MVP

**Diálogo-first** (contrato dialogue). Opcional:

- Chip superior: zona + rango.
- Stub de mapa: lista de zonas desbloqueadas (no canvas).

Fuera de MVP: TTS, minijuegos, píldoras §8 docs, avatar 3D.

---

## 7. Vertical slice (primera implementación jugable)

Orden de entrega recomendado (ver plan de tasks):

1. Gateway + mock.
2. Dialogue session API + UI mínima.
3. First-run hasta character + placement con banco de ítems (LLM rewrite opcional).
4. Adventure: 1 zona, 1 quest, 3–5 beats, 2 retos, summary.
5. Reanudación + Tripulación refleja journey.

No hace falta C4–C7 para llamar “MVP jugable”.

---

## 8. Criterios de aceptación

1. Tras placement, el niño elige zona y ve beats persistidos al reabrir.
2. Un reto actualiza `session_answers` y puede mover rolling/nivel.
3. Summary se genera al umbral N y aparece en PlayerState.
4. Límite de tiempo cierra con beat de despedida.
5. LLM no reescribe `sequence_num` ya guardados.
6. Tests: planificador inserta reto; fórmula nivel; ownership adventure routes.

## Aprobación

- [ ] Sesión con beats + 1–2 retos
- [ ] Quests y zonas del canon
- [ ] Persistencia beats/summaries/learning
- [ ] Adaptación de niveles post-reto
- [ ] Vertical slice C0–C1 (+ stub C2) suficiente para MVP
