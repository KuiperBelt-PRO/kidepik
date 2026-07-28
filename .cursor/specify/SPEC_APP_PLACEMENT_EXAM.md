# Spec: Examen de conocimientos (placement) y niveles

> Estado: **aprobada como contrato de producto** (julio 2026) — fórmulas y banco de ítems refinables en Plan; **sin implementación** hasta motor play  
> Relacionado: [SPEC_APP_PLAY_FIRST_RUN.md](SPEC_APP_PLAY_FIRST_RUN.md), [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md), [SPEC_APP_PROGRESSION_RANKS.md](SPEC_APP_PROGRESSION_RANKS.md), [SPEC_APP_CREW_SECTION.md](SPEC_APP_CREW_SECTION.md), [docs/kidepik.md](../../docs/kidepik.md) §3, §6

## Contexto

Tras elegir mundo, nombre y edad, el explorador realiza un **examen de acceso narrativo**: retos cortos de varias materias, presentados como prueba de ingreso (academia espacial / escuela de magos, etc.). Responde con **opciones y/o texto** vía el sistema de diálogo.

Se guardan:

- Nivel **por materia**
- Nivel **general** (fórmula ponderada)
- Posible actualización de `effective_age_band` si el rendimiento justifica tratarle “como de más edad” a efectos pedagógicos

Al niño **no** se le muestra puntuación numérica; solo feedback narrativo. El tutor verá resumen en Tripulación / informes futuros.

## Objetivo

1. Definir flow `placement` sobre el diálogo.
2. Modelo de materias, niveles y fórmula general.
3. Reglas de promoción de banda efectiva.
4. Persistencia (`placement_exams`, `user_subject_levels`).
5. Handoff a aventura y enlace a rangos ([SPEC_APP_PROGRESSION_RANKS.md](SPEC_APP_PROGRESSION_RANKS.md)).

---

## Principios

| Principio | Decisión |
| --- | --- |
| Narrativo, no “examen escolar” | Envoltorio de historia |
| Micro | 3–5 retos cortos (o 1–2 por materia activa), sesión acotada |
| Multi-modal | Opciones, texto, (futuro: otros tipos) |
| Por materia + general | Ambos persistidos |
| Edad cronológica ≠ techo | `effective_age_band` puede superar la banda por edad declarada |
| Tutor transparente | Niveles visibles en gestión; ocultos en UI niño |

---

## 1. Materias (catálogo MVP)

| `subject_id` | Label tutor | Peso default \(w\) |
| --- | --- | --- |
| `math` | Matemáticas | 0.30 |
| `language` | Lenguaje | 0.30 |
| `logic` | Lógica | 0.20 |
| `science` | Ciencias | 0.10 |
| `culture` | Cultura general | 0.10 |

Pesos normalizados \(\sum w = 1\). Si Ajustes desactiva materias (`learning.active_subjects`), se **renormalizan** los pesos de las activas.

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

| Condición | Efecto |
| --- | --- |
| `age_band == age_7` y `general_level ∈ {L4, L5}` | `effective_age_band = age_9` |
| `age_band == age_7` y ≥ 2 materias en L4+ | `effective_age_band = age_9` |
| `age_band == age_9` | `effective_age_band` permanece `age_9` (techo MVP de banda) |
| En caso contrario | `effective_age_band = age_band` |

Narrativa al niño: puede hablar de “escuadrón avanzado” / “círculo superior”; **nunca** “tienes nivel de 9 años”.

El tutor ve en ficha: edad declarada + banda efectiva + niveles.

Sesiones futuras pueden seguir moviendo `effective_age_band` y niveles ([docs](../../docs/kidepik.md) Vygotsky); reglas de subida/bajada continua → spec de adaptación (futura). **Este documento fija el placement inicial.**

---

## 4. Modelo de datos

### 4.1 `placement_exams`

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

1. Placement solo tras mundo+nombre+edad.
2. ≥1 respuesta por materia activa; scores persistidos.
3. `general_level` = redondeo ponderado documentado.
4. Promoción a `age_9` efectivo bajo reglas §3.4.
5. Reanudación no duplica ítems.
6. Retake tutor con confirm.
7. Tests unitarios de fórmula y umbrales; PHPUnit ownership.

## Aprobación

- [x] Examen interactivo opciones/texto en diálogo
- [x] Niveles por materia + general ponderado
- [x] Banda efectiva puede superar edad declarada
- [x] Sin nota numérica al niño
- [x] Rangos/flavor de progreso detallados en SPEC_APP_PROGRESSION_RANKS (ampliable después)
