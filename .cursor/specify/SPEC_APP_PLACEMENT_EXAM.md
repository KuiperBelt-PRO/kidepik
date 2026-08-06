# Spec: Examen de conocimientos (placement) y niveles

> **DEPRECADA como contrato de persistencia (ago 2026).**  
> Fuente de verdad del examen en curso: **ledger JSONL** (`placement_queue` / `placement_answer` / `placement_result`).  
> Niveles oficiales: `user_subject_levels` + `child_world_progress`.  
> Sin PlacementBank. Ver canónicos:  
> [SPEC_APP_JOURNEY_MECHANICS.md](SPEC_APP_JOURNEY_MECHANICS.md) · [SPEC_DATA_STORAGE_LAYERS.md](SPEC_DATA_STORAGE_LAYERS.md) · [SPEC_AI_JOURNEY_FILE_LEDGER.md](SPEC_AI_JOURNEY_FILE_LEDGER.md) · [SPEC_APP_CANONICAL_VOCABULARY.md](SPEC_APP_CANONICAL_VOCABULARY.md).  
> Las secciones §4.1 `placement_exams` / banco estático abajo son **legado histórico**; no implementar nuevas dependencias.

> Estado histórico: aprobada como contrato de producto (julio 2026) — supersedida parcialmente por capas de datos + mecánicas (ago 2026).  
> Relacionado: [SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md), [SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE.md](SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE.md), [SPEC_APP_PLAY_FIRST_RUN.md](SPEC_APP_PLAY_FIRST_RUN.md), [SPEC_APP_CHARACTER_TRAITS.md](SPEC_APP_CHARACTER_TRAITS.md), [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md), [SPEC_AI_PLAY_ORCHESTRATION.md](SPEC_AI_PLAY_ORCHESTRATION.md), [SPEC_APP_WORLD_JOURNEY_CANON.md](SPEC_APP_WORLD_JOURNEY_CANON.md), [SPEC_APP_PROGRESSION_RANKS.md](SPEC_APP_PROGRESSION_RANKS.md), [SPEC_APP_CREW_SECTION.md](SPEC_APP_CREW_SECTION.md), [docs/kidepik.md](../../docs/kidepik.md) §3, §6

## Contexto

Tras elegir mundo, nombre, edad y **personaje**, el explorador realiza un **examen de acceso narrativo**: retos cortos de varias materias, presentados como prueba de ingreso (academia espacial / escuela de magos, etc.). Responde con **opciones y/o texto** vía el sistema de diálogo.

Se guardan:

- Nivel **por materia**
- Nivel **general** (fórmula ponderada)
- Posible actualización de `effective_age_band` si el rendimiento justifica tratarle “como de más edad” a efectos pedagógicos

Al niño **no** se le muestra puntuación numérica; solo feedback narrativo. El tutor verá resumen en Tripulación / informes futuros.

## Objetivo

1. Definir flow `placement` sobre el diálogo.
2. Modelo de materias, niveles y fórmula general.
3. Reglas de promoción de banda efectiva.
4. Persistencia (**legado:** `placement_exams`; **actual:** JSONL + `user_subject_levels` / `child_world_progress`).
5. Handoff a aventura / caminos y enlace a rangos ([SPEC_APP_PROGRESSION_RANKS.md](SPEC_APP_PROGRESSION_RANKS.md)).

---

## Principios

| Principio | Decisión |
| --- | --- |
| Narrativo, no “examen escolar” | Envoltorio de historia |
| Micro por materia | Retos generados por agente (sin banco estático); cola en JSONL — ver [SPEC_APP_JOURNEY_MECHANICS.md](SPEC_APP_JOURNEY_MECHANICS.md) |
| Multi-modal | Opciones, texto, (futuro: otros tipos) |
| Por materia + general | Ambos persistidos en PG al cerrar |
| Edad cronológica ≠ techo | `effective_age_band` puede superar la banda por edad declarada |
| Tutor transparente | Niveles visibles en gestión; ocultos en UI niño |

---

## 1. Materias (catálogo)

> **Fuente de verdad ampliada (jul 2026):** [SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md) — **14 materias**, pesos, familias UI, materias base por `age_band`, activación por tripulante en ficha `#/crew/:id`.

Resumen heredado MVP (5 originales, aún válidas como subconjunto):

| `subject_id` | Label tutor | Peso default \(w\) * |
| --- | --- | --- |
| `math` | Matemáticas | 0.14 |
| `language` | Lengua y gramática | 0.14 |
| `logic` | Lógica | 0.09 |
| `science` | Ciencias | 0.09 |
| `culture` | Cultura general | 0.08 |

\* Pesos del catálogo completo en [SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md) §1. Nuevas: `reading`, `geography`, `mythology`, `ethics`, `arts`, `communication`, `sports`, `politics`, `finance`.

Pesos normalizados \(\sum w = 1\) sobre las materias **activas** del tripulante (`children.settings.learning.active_subjects`). El tutor puede activar materias extra sin límite de edad; la **dificultad** del reto sigue `age_band`, no el id de materia.

Niveles discretos por materia (alineado a docs): `L1` … `L5` (equivalente M1–M5).

| Nivel | Significado orientativo |
| --- | --- |
| L1 | Inicio / apoyo |
| L2 | En camino (típico ~7) |
| L3 | Sólido |
| L4 | Avanzado (~9+) |
| L5 | Excelente / techo MVP |

---

## 2. Flujo en diálogo (`flow_id = "placement"`)

1. Intro narrativa según `world_theme`.
2. Para cada ítem (generado o de banco + IA de redacción):
   - Pregunta en tono del mundo.
   - `input_mode` según tipo de ítem.
   - Effect `record_answer` con evaluación (correct / partial / incorrect, `subject_id`, `difficulty`).
3. Tras el conjunto mínimo:
   - Calcular niveles por materia y general.
   - Persistir.
   - Posible `set_effective_age_band`.
   - Cierre narrativo (admisión, escuadrón, etc.).
   - `placement_status = completed`, `onboarding_step = complete`.
4. Handoff aventura.

`placement_status`: `not_started` → `in_progress` al primer ítem → `completed`.

Reanudación: no repetir ítems ya respondidos en la misma `placement_exam` abierta.

---

## 3. Evaluación de respuestas

### 3.1 Tipos de ítem

| `item_type` | Respuesta | Scoring |
| --- | --- | --- |
| `mcq` | option_id | exact match → 1; else 0 |
| `short_text` | texto | normalizar + match claves / validador LLM acotado → 0 \| 0.5 \| 1 |
| `numeric` | texto/número | tolerancia |

El validador LLM, si se usa, solo clasifica; no inventa la “nota global”.

### 3.2 Agregado por materia

Para materia \(s\) con respuestas \(r_{s,i} \in [0,1]\):

\[
score_s = \frac{1}{n_s}\sum_i r_{s,i}
\]

Mapa a nivel (umbrales iniciales; calibrables):

| \(score_s\) | Nivel |
| --- | --- |
| &lt; 0.35 | L1 |
| &lt; 0.55 | L2 |
| &lt; 0.70 | L3 |
| &lt; 0.85 | L4 |
| ≥ 0.85 | L5 |

Ajuste por `age_band` declarado: el **banco** elige dificultad de ítems según edad; el mapa score→nivel es el mismo para comparar. (Calibración fina = tarea posterior.)

### 3.3 Nivel general

Sea \(L_s\) el índice numérico del nivel (L1=1 … L5=5).

\[
G = \mathrm{round}\left(\sum_s w_s \cdot L_s\right)
\]

con \(G\) clamp a \([1,5]\) → `general_level` = `L{G}`.

**Alternativa documentada (si se prefiere media de scores):**  
\(G_{score} = \sum w_s score_s\) luego mismo mapa umbral.  
**Decisión de producto MVP:** fórmula por **niveles discretos ponderados** (arriba).

### 3.4 Promoción de `effective_age_band`

Usa el catálogo de [SPEC_APP_AGE_BANDS.md](SPEC_APP_AGE_BANDS.md). Regla MVP:

| Condición | Efecto |
| --- | --- |
| Rendimiento excelente (general L4–L5 o ≥2 materias L4+) | Subir **una** banda (techo `band_senior`) |
| Rendimiento muy bajo sostenido (opcional post-MVP) | Bajar una banda (suelo `band_early`) |
| En caso contrario | `effective_age_band = age_band` |

Narrativa: círculos/rutas avanzadas; **nunca** «tienes nivel de N años».

*(La tabla legacy age_7→age_9 queda sustituida por este modelo de bandas.)*
---

## 4. Modelo de datos

### 4.1 `placement_exams` (LEGADO — no usar como fuente de verdad)

> **Ago 2026:** el examen en curso vive en JSONL; al completar se escriben `user_subject_levels` y `child_world_progress`. Esta DDL queda solo como referencia histórica.

```sql
create table public.placement_exams (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  world_theme text not null,
  status text not null check (status in ('in_progress', 'completed', 'abandoned')),
  general_level text null,
  raw_scores jsonb not null default '{}'::jsonb,
  narrative_variant text null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null
);
```

### 4.2 `placement_answers`

```sql
create table public.placement_answers (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.placement_exams(id) on delete cascade,
  subject_id text not null,
  item_key text not null,
  item_type text not null,
  prompt_text text not null,
  response jsonb not null,
  score numeric not null check (score >= 0 and score <= 1),
  created_at timestamptz not null default now()
);
```

### 4.3 `user_subject_levels`

```sql
create table public.user_subject_levels (
  child_id uuid not null references public.children(id) on delete cascade,
  subject_id text not null,
  level_id text not null check (level_id in ('L1','L2','L3','L4','L5')),
  accuracy_rolling numeric null,
  difficulty_modifier numeric not null default 0,
  source text not null default 'placement',
  updated_at timestamptz not null default now(),
  primary key (child_id, subject_id)
);
```

También persistir `children.general_level` (columna o `settings`) y `effective_age_band`.

---

## 5. API

### 5.1 Vía diálogo

Effects: `record_answer`, `set_subject_level`, `set_general_level`, `set_effective_age_band`, `advance_onboarding`.

### 5.2 Lectura tutor

Incluido en `GET /api/v1/crew/{id}`:

```json
{
  "placement": {
    "status": "completed",
    "general_level": "L3",
    "subjects": [
      { "subject_id": "math", "level_id": "L2" }
    ],
    "effective_age_band": "age_7",
    "age_years": 8
  }
}
```

### 5.3 Repetir placement (tutor)

`POST /api/v1/play/{childId}/placement/retake` con `{ "confirm": true }` — archiva exam anterior; reinicia `placement_status`; no borra story beats de aventura (si existieran). Confirmación fuerte en UI Tripulación.

---

## 6. UX niño vs tutor

| Audiencia | Qué ve |
| --- | --- |
| Niño | Historia, aciertos narrativos, ánimo; sin L1–L5 |
| Tutor | Tabla de materias + general + banda efectiva |

Respetar `learning.show_levels_to_child === false` por defecto (Ajustes).

---

## 7. Criterios de aceptación

1. Placement solo tras mundo+nombre+edad+**traits**.
2. ≥1 respuesta por materia activa; scores persistidos.
3. `general_level` = redondeo ponderado documentado.
4. Promoción a `age_9` efectivo bajo reglas §3.4.
5. Reanudación no duplica ítems.
6. Retake tutor con confirm.
7. Tests unitarios de fórmula y umbrales; PHPUnit ownership.
8. Ítems: banco + rewrite; MCQ sin LLM scorer (§8).

---

## 8. Ampliación IA (propuesta)

Complementa §§2–3 con el pipeline de [SPEC_AI_PLAY_ORCHESTRATION.md](SPEC_AI_PLAY_ORCHESTRATION.md).

### 8.1 Banco + rewrite (estrategia MVP)

1. Catálogo versionado `shared/Ai/placement_bank/{age_band}/{subject_id}.json` con ítems seed (`item_key`, tipo, dificultad, `canonical_answer`, prompt neutro).
2. Motor PHP elige 1 ítem por materia activa (3–5 total) según `age_band` y evita `item_key` ya usados en el exam abierto.
3. `placement_item_writer` reescribe `prompt_text` + `narrative_wrapper` al mundo/traits **sin alterar** `canonical_answer`.
4. Si el LLM falla: usar prompt neutro del banco (degradación elegante).

### 8.2 Scoring

| Tipo | Quién puntúa |
| --- | --- |
| `mcq` | PHP exact match |
| `numeric` | PHP + tolerancia |
| `short_text` | keywords PHP primero; si duda → `placement_text_scorer` (0 / 0.5 / 1) |

El LLM **no** calcula `general_level` ni `effective_age_band`.

### 8.3 Envoltorio narrativo

Intro/cierre según [SPEC_APP_WORLD_JOURNEY_CANON.md](SPEC_APP_WORLD_JOURNEY_CANON.md) § institución de ingreso. Tras cierre: `grant_rank` + handoff elección de primera zona (adventure).

## Aprobación

- [x] Examen interactivo opciones/texto en diálogo
- [x] Niveles por materia + general ponderado
- [x] Banda efectiva puede superar edad declarada
- [x] Sin nota numérica al niño
- [x] Rangos/flavor de progreso detallados en SPEC_APP_PROGRESSION_RANKS (ampliable después)
- [ ] Banco + rewrite LLM (§8)
- [ ] Traits como prerrequisito
