# Spec: Ledger de viaje en ficheros (JSONL + Markdown)

> Estado: **aprobada** (ago 2026) — reset niveles/ranks incluido  
> Hilo: IA agentic FastAPI  
> Relacionado: [SPEC_APP_JOURNEY_MEMORY.md](SPEC_APP_JOURNEY_MEMORY.md) (semántica L1/L2/L3), [SPEC_AI_PYDANTIC_AGENTS.md](SPEC_AI_PYDANTIC_AGENTS.md), [SPEC_AI_AGENT_SKILLS.md](SPEC_AI_AGENT_SKILLS.md), [SPEC_APP_PLAY_FIRST_RUN.md](SPEC_APP_PLAY_FIRST_RUN.md), [SPEC_POC_DOCKER_LOCAL_DEV.md](SPEC_POC_DOCKER_LOCAL_DEV.md)

## Contexto

La semántica de memoria (L1 ledger, L2 condensado, L3 ventana reciente) sigue [SPEC_APP_JOURNEY_MEMORY](SPEC_APP_JOURNEY_MEMORY.md). En el camino agentic FastAPI, el **transcript y los resúmenes de aventura** viven en **ficheros**, no como filas de diálogo/beats en Postgres.

| Artefacto | Rol |
| --- | --- |
| **`dialogue.jsonl` (viaje)** | L1 canónico: **todo** el diálogo del viajero (mentor + explorador) append-only |
| **`events.jsonl` por sesión** | Eco/sesión de eventos estructurados (decisiones, retos, system…); el diálogo también se refleja aquí |
| **`summary.md` por sesión** | Resumen **amplio** + front matter YAML ligero (recuperable por agentes) |
| **`traveler.md`** | Ficha viva del viajero: descripción, atuendo, personalidad, habilidades actuales |
| **`journey-condensed.md`** | L2 condensado a escala viaje |

### Qué queda en Postgres vs qué va a ficheros (aclaración)

| En **Postgres** (estado de producto) | En **ficheros** (hilo de aventura) |
| --- | --- |
| Cuenta tutor, auth, `children` (nombre, edad, mundo, traits, niveles, flags) | Cada frase del mentor y del explorador |
| `onboarding_step`, `placement_status`, permisos | Elecciones de camino, intros/resultados de reto narrados |
| Puntero opcional `active_adventure_session_id` | Resúmenes MD y condensed del viaje |
| Catálogos / colas no agentic | Timeline «diario» rico para tutores (vía API que lee disco) |

No significa «sin base de datos». Significa: **la novela del viaje** (conversación y hechos narrativos) se guarda como JSONL/MD en un volumen; la BD guarda **quién eres y en qué punto de la máquina de estados estás**.

## Objetivo

1. Store L1/L2/L3 en disco con volumen **persistente y navegable desde el host**.
2. Esquemas JSONL + front matter MD.
3. API timeline/summary leyendo ficheros.
4. **Sin backfill** PHP→ficheros; **reset de viajeros** al cutover (§10).

---

## 1. Decisiones

| # | Decisión | Valor |
| --- | --- | --- |
| L1 | Store aventura | Filesystem bind-mount |
| L2 | Eventos | JSONL append-only |
| L3 | Resumen sesión | `.md` + YAML front matter |
| L4 | Correcciones | Nuevos eventos `amendment`, no rewrite silencioso |
| L5 | Postgres | Perfil / progresión / flags; no transcript completo |
| L6 | Público | nginx **no** sirve el dir; solo API autenticada |
| L7 | Migración histórica | **No**; cutover = reset (§10) |
| L8 | Volumen | Host `data/journey/` ↔ contenedor; visible en Cursor/Explorer |

---

## 2. Volumen Docker (persistente + navegable fuera)

Mismo patrón que `web/logs` y `web/media` ([compose](../../docker/compose.yaml)):

| Lado | Ruta |
| --- | --- |
| **Host (Windows / repo)** | `kidepik/data/journey/` |
| **Contenedor FastAPI** | `/data/journey` (o valor de `JOURNEY_DATA_DIR`) |
| Compose | `../data/journey:/data/journey` en el servicio `api` / `backend` |

Requisitos:

1. El contenido **sobrevive** a `docker compose restart` y recreación de contenedor (bind mount, no volume anónimo).
2. Desde el host se puede abrir `data/journey/` en el IDE, listar JSONL/MD, depurar sin `docker exec`.
3. `.gitignore`: `data/journey/**` salvo `.gitkeep` (y opcional `README` de convención).
4. Permisos de escritura del proceso del contenedor sobre ese mount (documentar en ops si hace falta `user:`).
5. `JOURNEY_DATA_DIR` override para tests (`tmp_path`).

```
data/journey/                    # HOST — navegable
  .gitkeep
  {parent_id}/
    {child_id}/
      index.json
      dialogue.jsonl             # diálogo completo del viaje
      traveler.md                # ficha del viajero (perfil narrativo)
      journey-condensed.md
      sessions/
        {session_id}/
          events.jsonl
          summary.md
          meta.json
```

Paths solo con UUIDs; anti path traversal.

### 2.1 Seguridad

- No exponer como estático nginx.
- API con JWT + ownership.
- Distinto de `web/media/` (público) y de `web/logs/` (ops).

---

## 3. JSONL — evento L1

### 3.0 Dos niveles de seq

| Fichero | `seq` |
| --- | --- |
| `dialogue.jsonl` | Monotónico **por viajero** (viaje entero) |
| `sessions/{id}/events.jsonl` | Monotónico **por sesión** |

En `dialogue.jsonl` cada línea incluye `session_id`.

```ts
interface JourneyFileEvent {
  id: string;
  at: string;       // ISO-8601 con ms
  seq: number;
  session_id?: string;  // obligatorio en dialogue.jsonl
  kind:
    | "mentor_utterance"
    | "explorer_reply"
    | "decision"
    | "challenge"
    | "quest"
    | "level"
    | "rank"
    | "system"
    | "amendment"
    | "traveler_update";
  flow_id?: string;
  purpose?: string;
  model?: string;
  text?: string;
  summary?: string;
  payload?: Record<string, unknown>;
  source?: "primary" | "echo";
}
```

| kind | payload (ej.) |
| --- | --- |
| `mentor_utterance` | `{ input_mode, options?, envelope_meta? }` |
| `explorer_reply` | `{ reply_text?, option_id? }` |
| `decision` | `{ decision_key, option_id, label }` |
| `challenge` | `{ phase, subject_id, score?, challenge_id }` |
| `quest` | `{ quest_id, status }` |
| `level` / `rank` | `{ subject_id?, from, to }` |
| `system` | `{ code, detail? }` |
| `amendment` | `{ amends_id, reason }` |

Orden: `seq` primario; `at` con ms; `kind_rank` como [JOURNEY_MEMORY §1.4](SPEC_APP_JOURNEY_MEMORY.md) al mezclar vistas. Lock por `session_id` al asignar `seq`.

---

## 4. `summary.md`

### 4.1 Front matter

```yaml
---
schema: kidepik.session_summary/v1
child_id: "…"
session_id: "…"
world_theme: fantasy
mentor_id: guardian
age_band: "8-9"
started_at: "2026-08-05T09:00:00.000Z"
ended_at: "2026-08-05T09:42:11.200Z"
zone_ids: [mirrors_grove]
subjects_touched: [math, reading]
decisions:
  - { key: choose_zone, option_id: mirrors_grove }
challenges_resolved: 3
open_threads: ["…"]
antagonist_pressure: 2
fragments_restored: 1
model_used: gemini-3-flash-preview
events_up_to_seq: 86
---
```

Sin secretos. Forward-compatible.

### 4.2 Cuerpo

Skill `journey-summary`: arco de sesión, decisiones, retos, hilos abiertos. Debe citar hechos del JSONL.

### 4.3 Gatillos

| Gatillo | Acción |
| --- | --- |
| Fin de sesión | `summary.md` |
| Cada `AI_SUMMARY_EVERY_N` beats | Refresh condensed y/o MD |
| Tutor compactar | Futuro |

---

## 4.4 `traveler.md`

Ficha **única** del viajero bajo `{parent}/{child}/traveler.md`.

### Front matter (ligero, para agentes)

```yaml
---
schema: kidepik.traveler_profile/v1
child_id: "…"
display_name: Vatardar
world_theme: fantasy
age_band: adult
age_years: 42
species: Mago humano
palette: índigo y plata
features: [curioso, metódico]
abilities: [cálculo, lectura de runas]
updated_at: "2026-08-05T12:00:00Z"
model_used: gemini-3-flash-preview
---
```

### Cuerpo (prosa)

Secciones markdown: **Descripción**, **Atuendo**, **Personalidad**, **Habilidades**. Actualiza el agente `character_coach` (y futuros agents de progresión) tras cambios relevantes; append `traveler_update` en JSONL.

## 5. L1 / L2 / L3

| Capa | Store | Prompt |
| --- | --- | --- |
| L1 | `dialogue.jsonl` (+ eco sesión) | Nunca entero; ventana por `seq` |
| L2 | `journey-condensed.md` + FM de `summary.md` / `traveler.md` | Siempre al retomar |
| L3 | Últimos K eventos de `dialogue.jsonl` | Siempre al retomar |

---

## 6. API lectura

| Endpoint | Fuente |
| --- | --- |
| `GET …/journey/timeline` | JSONL (paginado); forma JSON estable al front |
| `GET …/journey/summary` | `journey-condensed.md` |
| `GET …/dialogue/history` | JSONL por `seq` / cursor |

Escritura solo vía pipeline de turn.

Punteros opcionales en Postgres: `active_adventure_session_id`.

---

## 7. Relación con journey memory BD

| | PHP / BD (legado) | Agentic (esta spec) |
| --- | --- | --- |
| Semántica L1/L2/L3 | Sí | Sí |
| Transcript | `dialogue_turns` / beats | **JSONL** |
| L2 | `story_summaries` | **MD** |
| Histórico al cutover | — | **No migrar; reset §10** |

---

## 8. Git / ops

- `data/journey/` en `.gitignore` (+ `.gitkeep`).
- Documentar mount en `SPEC_POC_DOCKER_LOCAL_DEV` / compose al implementar.
- Logs app ≠ ledger viaje.

---

## 9. Criterios de aceptación (store)

1. Turno escribe JSONL con `seq` creciente en `data/journey/…` **visible en el host**.
2. Reiniciar contenedor **no** borra el árbol.
3. `summary.md` al cerrar sesión (o error compose sin borrar JSONL).
4. Timeline sin path traversal; 400/403 en ids inválidos.
5. Tests writer/reader con `tmp_path`.

---

## 10. Reset de viajeros (cutover)

### 10.1 Política

- **No** convertir filas PHP (`dialogue_turns`, etc.) a JSONL.
- Al activar play agentic (o script de cutover POC), **todos** los tripulantes vuelven al inicio del flujo first_run para repetir: **mundo → nombre → edad → traits/descripción → examen**.

### 10.2 Estado Postgres (por `child`)

Alinear con [SPEC_APP_PLAY_FIRST_RUN](SPEC_APP_PLAY_FIRST_RUN.md) reset destructivo:

| Campo / área | Valor tras reset |
| --- | --- |
| `onboarding_step` | `pending_entry` |
| `world_theme` | `null` |
| `mentor_id` | `null` |
| `display_name` | `null` (o política explícita: vaciar) |
| `age_years` / `age_band` / `effective_age_band` | `null` |
| traits / character | vacíos / null |
| placement / exam progress | limpio (`placement_status` inicial) |
| adventure zone / quest activa | limpio |
| niveles / ranks | **Reset** a defaults de ingreso (`general_level`/`rank_id`/`rank_track` null; borrar `user_subject_levels`) |
| `lock_world_theme` | según default first_run |

### 10.3 Ficheros

| Acción | Detalle |
| --- | --- |
| Preferida POC | Mover `data/journey/{parent}/{child}/` → `data/journey/_archive/{timestamp}/…` **o** borrar árbol del child |
| Sesiones nuevas | Empiezan JSONL vacío tras primer turno post-reset |
| Diario tutor | Vacío hasta nueva aventura |

### 10.4 Entrada operativa

- Script/CLI: `backend` management command o `scripts/poc-reset-journey.ps1` (idempotente, dry-run).
- Opcional: reutilizar `POST …/onboarding/reset` por child (tutor) además del reset masivo de cutover.
- Log `system` en canal api: cuántos children reseteados; sin PII innecesaria.

### 10.5 Criterios

1. Tras cutover, abrir play → flujo `choose_world` (no reanuda zona antigua).
2. Timeline tutor vacío o solo post-reset.
3. Dry-run no muta BD ni disco.
4. Archive/delete de `data/journey` coherente con §10.3.

## Aprobación

- [x] Sin migración histórica; reset viajeros *(decidido)*
- [x] Volumen host `data/journey/` navegable *(decidido)*
- [ ] Esquemas JSONL + MD
- [ ] §10 reset cutover
- [ ] Postgres = estado; ficheros = transcript *(aclarado)*
