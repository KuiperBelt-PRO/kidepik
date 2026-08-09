# Spec: Rebobinado de viaje en modo debug (play)

> Estado: **implementada** (fases A+B, ago 2026)  
> Relacionado: [SPEC_APP_DEBUG_MODE.md](SPEC_APP_DEBUG_MODE.md), [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md), [SPEC_APP_ADVENTURE_DIALOGUE_HISTORY.md](SPEC_APP_ADVENTURE_DIALOGUE_HISTORY.md), [SPEC_APP_PLAY_FIRST_RUN.md](SPEC_APP_PLAY_FIRST_RUN.md), [SPEC_AI_JOURNEY_FILE_LEDGER.md](SPEC_AI_JOURNEY_FILE_LEDGER.md), [SPEC_APP_JOURNEY_CHAPTERS.md](SPEC_APP_JOURNEY_CHAPTERS.md)

## Contexto

En desarrollo local, el tutor activa **modo debug IA** (`APP_DEBUG_AI` + `?debugAi=1`) para diagnosticar compose, modelos y fallos de play. Hoy, si un paso del first-run o la aventura sale mal, las opciones son:

- Rehacer todo el viajero (`scripts/poc-reset-journey.ps1` / `journey_reset` → `pending_entry`);
- Borrar manualmente BD + `data/journey/`;
- Seguir adelante y convivir con estado corrupto.

No existe **rebobinar hasta un turno concreto** del historial visible en play para repetir un paso tras corregir código o prompts.

## Objetivo

Con modo debug activo, mostrar en cada **tarjeta de conversación** (burbuja mentor/explorador del log de play) un control de **rebobinar hasta aquí** que:

1. Elimine el viaje **posterior** a ese punto (turnos, estado derivado, eventos de ledger acoplados).
2. Deje la sesión lista para **continuar desde ese momento** (mismo `pending_agent_turn` que tendría el explorador al llegar ahí).
3. Sea **solo tutor + solo local** (mismas guardas que [SPEC_APP_DEBUG_MODE.md](SPEC_APP_DEBUG_MODE.md)).

El explorador (niño) **nunca** ve el control.

---

## Principios

| Principio | Decisión |
| --- | --- |
| Solo debug | Misma activación que `SPEC_APP_DEBUG_MODE` §1; **404** en prod |
| Tutor only | JWT padre; verificar `child.parent_id` |
| Destructivo | Confirmación glass antes de aplicar; sin undo |
| Servidor manda | El cliente no trunca turnos en local; API atómica |
| Narrativa intacta | Sin copy de debug en burbujas del mentor |
| Idempotencia | Rebobinar al mismo `turn_id` dos veces → no-op estable |

---

## 1. Semántica del ancla (`turn_id`)

Cada burbuja del log tiene `id` (UUID de `dialogue_turns`). El icono de rebobinado envía ese `turn_id`.

### 1.1 Regla de truncado

| Rol del ancla | Turnos que se **mantienen** | Turnos que se **borran** | `pending` tras rebobinar |
| --- | --- | --- | --- |
| **mentor** | `sequence ≤ anchor.sequence` | `sequence > anchor.sequence` | El turno ancla (reabre sus opciones / compose) |
| **explorer** | `sequence < anchor.sequence` | `sequence ≥ anchor.sequence` | Último turno **mentor** con `sequence < anchor.sequence` |

Intención: si el tutor pulsa en su propia burbuja, repite **esa pregunta**. Si pulsa en la respuesta del explorador, **deshace esa respuesta** y vuelve a la pregunta anterior.

### 1.2 Límites

- No rebobinar si solo queda el turno semilla (`choose_world` inicial) **y** el ancla es mentor con `sequence === 1` → permitido (queda en mundo); no permitir ancla inexistente o de otra sesión/child.
- No mostrar icono en burbuja **thinking** / skeleton.
- Historial paginado: al rebobinar, invalidar caché cliente y rehidratar con `open_session`.

---

## 2. UI — tarjetas de conversación

### 2.1 Cuándo aparece

```
isDebugAiClientActive()
  AND debugServerAllowed (GET /debug/ai/status)
  AND ruta #/play/:childId
```

### 2.2 Anatomía (burbuja)

```
┌─────────────────────────────────────┐
│ [icono mentor]  El Guardián…   [↺] │  ← play-bubble__head
│ Texto del mentor en prosa…          │
└─────────────────────────────────────┘
```

| Elemento | Decisión |
| --- | --- |
| Control | Botón icono `rewind` / `history` (glass, 32×32 táctil) en `play-bubble__head`, alineado a la derecha |
| Clase | `play-bubble__rewind` + `data-turn-id` |
| `aria-label` | «Rebobinar viaje hasta aquí» |
| Visible | Mentor y explorador; oculto en thinking |
| Confirmación | `showGlassModal` / confirm glass: «¿Rebobinar hasta este mensaje? Se borrará todo lo posterior.» |
| Tras OK | `POST` rewind → `hydrateFromSession` → toast «Viaje rebobinado» |
| Error | Toast error; log canal `client` |

### 2.3 Estilo

- Tokens glass existentes ([DESIGN.md](../DESIGN.md)); opacidad baja hasta hover.
- No competir con chip «Ver diagnóstico» de compose_failed (pueden coexistir).

### 2.4 Accesibilidad

- Botón focuable; no depender solo de hover en móvil 390×844.
- `aria-disabled` mientras `sending` o rewind en curso.

---

## 3. API

Base: `/api/v1/debug/journey/…`  
Auth: JWT tutor.  
Guard: `settings.ai_debug_enabled()` → si false, **404** (igual que `/debug/ai/*`).

### 3.1 `POST /api/v1/debug/journey/rewind`

**Body:**

```json
{
  "child_id": "uuid",
  "session_id": "uuid",
  "turn_id": "uuid"
}
```

**Respuesta 200:** mismo shape que `open_session` + bloque debug:

```json
{
  "session_id": "…",
  "turns": [ … ],
  "pending_agent_turn": { … },
  "chapter": { … },
  "mentor": { … },
  "onboarding_step": "choose_character",
  "debug": {
    "rewind": {
      "anchor_turn_id": "…",
      "deleted_turns": 12,
      "ledger_events_trimmed": 8,
      "child_fields_reset": ["placement_status", "onboarding_step"]
    }
  }
}
```

**Errores:**

| Código | Cuándo |
| --- | --- |
| 404 | Debug deshabilitado o turno no encontrado |
| 403 | Child no pertenece al tutor |
| 409 | Sesión cerrada o turno no pertenece a `session_id` |
| 422 | Ancla no rebobinable (p. ej. único turno y rol inválido) |

Cabecera opcional: `X-Kidepik-Debug-Ai: 1` (consistente con debug existente).

### 3.2 `POST /api/v1/debug/journey/rewind/dry-run` (opcional MVP+)

Misma entrada; responde qué se borraría sin mutar (útil para modal detallado).

---

## 4. Persistencia — qué se trunca

Operación **atómica** (una transacción Postgres + escritura ledger acotada).

### 4.1 Postgres

| Recurso | Acción |
| --- | --- |
| `dialogue_turns` | `DELETE` donde `session_id` = X y `sequence` > umbral (§1.1); si ancla explorer, incluir `sequence >= anchor.sequence` |
| `dialogue_sessions` | `updated_at = now()`; mantener `status = open` |
| `children` | Reconstruir campos de viaje según §4.3 |
| `placement_exams` | Borrar filas del child si el ancla queda **antes** de completar placement |
| `user_subject_levels`, `child_world_progress`, `story_beats`, `story_summaries`, `journey_decisions` | Truncar o borrar entradas con `created_at` posterior al ancla **o** regenerar según fase |
| `child_traits` | Deprecado; no fuente de verdad — ignorar salvo legado |

### 4.2 Ledger (`data/journey/`)

| Fichero | Acción |
| --- | --- |
| `dialogue.jsonl` | Eliminar eventos con `seq` / timestamp posteriores al ancla |
| `events.jsonl` (placement, path_pack, path_progress, chapter_opened, …) | Idem |
| `traveler.md` | Si el ancla queda **antes** de `character_coach`, restaurar vacío o snapshot archivado |
| `summary.md` | Regenerar vacío o truncar secciones posteriores (MVP: vaciar si rebobina antes de aventura) |

Implementación de referencia: `JourneyLedger.trim_after(parent_id, child_id, *, session_id, anchor_at, anchor_seq)` — nuevo helper; **no** archivar todo el child (eso es `journey_reset`).

### 4.3 Reconstrucción de estado del viajero

**Problema:** `children.onboarding_step`, `world_theme`, `placement_status`, etc. deben cuadrar con el último turno conservado.

**Estrategia MVP (aprobación requerida):**

1. **Mapa fase → campos** derivado del último turno **mentor** conservado (`meta.phase`):
   - `choose_world` → `onboarding_step=choose_world`, `world_theme=null`, `placement_status=not_started`
   - `choose_name` → mundo ya fijado (leer último effect `set_world_theme` en turnos conservados o columna actual si no se borró)
   - `choose_character_species` → `onboarding_step=choose_character`, …
   - `placement_item` → `onboarding_step=placement`, `placement_status=in_progress`
   - `choose_path` / `path_intro` → `onboarding_step=complete`, placement completed, …
2. **Replay de effects** (opcional refuerzo): recorrer `explorer_reply` + effects aplicados en turnos conservados para `display_name`, `age_years`, `world_theme`.
3. **V2 (recomendado):** en cada turno que muta child, persistir `meta.state_snapshot` (subset JSON de `children` + ids de capítulo) para rewind O(1).

Si la reconstrucción no es confiable → **422** con mensaje tutor «No se pudo rebobinar de forma segura; usa reset completo del viajero».

### 4.4 Capítulo UI

Tras rewind, recalcular `chapter` ([SPEC_APP_JOURNEY_CHAPTERS.md](SPEC_APP_JOURNEY_CHAPTERS.md)) con el resolver existente + ledger truncado.

---

## 5. Servicio backend

Nuevo módulo: `backend/app/services/journey_rewind.py`

```python
async def rewind_to_turn(
    session: AsyncSession,
    *,
    auth_user_id: str,
    child_id: str,
    session_id: str,
    turn_id: str,
    dry_run: bool = False,
) -> RewindReport: ...
```

Router: `backend/app/routers/debug_journey.py` montado solo si `ai_debug_enabled()`.

Reutilizar validación de ownership de `DialogueService._child`.

---

## 6. Cliente (`web/js/scenes/play.js`)

| Paso | Acción |
| --- | --- |
| Render burbuja | Si debug activo, añadir `play-bubble__rewind` con `data-turn-id` |
| Click | Confirm modal → `debugJourneyRewind(session, childId, sessionId, turnId)` |
| OK | `hydrateFromSession(data)`; limpiar `renderedTurnIds` / historial |
| API | `web/js/lib/debug-journey-api.js` (nuevo), cabeceras `debugAiRequestHeaders()` |

No persistir preferencia; iconos solo con debug activo en la sesión.

---

## 7. Seguridad y auditoría

| Riesgo | Mitigación |
| --- | --- |
| Borrado accidental en prod | Guard `ai_debug_enabled()` + tests contract 404 |
| Rewind de child ajeno | FK tutor ↔ child |
| Pérdida de datos | Solo local; confirmación UI; log `api` `journey_rewind_applied` con counts (sin texto de burbujas) |
| Perfil tutor (`is_tutor_profile`) | **Excluido** — sin iconos / 403 |

---

## 8. Tests

| Capa | Casos |
| --- | --- |
| Unit `journey_rewind` | mentor ancla; explorer ancla; dry-run; fase→child mapping |
| Contract | 404 sin debug; 403 child ajeno; 200 trunca turnos |
| Integration | rewind tras choose_name → display_name coherente; tras placement parcial → queue limpia |
| Playwright 390×844 | Con `?debugAi=1`, icono visible en burbuja; rewind elimina burbujas posteriores — `tmp/playwright-output/debug-rewind-v1.png` |

---

## 9. Fases de implementación

| Fase | Entrega |
| --- | --- |
| **A** | API rewind + truncado `dialogue_turns` + mapa fase básico + icono UI + confirm |
| **B** | Ledger trim + placement/path + `chapter` + dry-run |
| **C** | `meta.state_snapshot` en turnos nuevos + rewind O(1) fiable |

---

## 10. Criterios de aceptación

1. Con debug activo en local, cada burbuja del log (no thinking) muestra icono rebobinar.
2. Rebobinar en burbuja mentor deja ese turno como `pending` y borra posteriores.
3. Rebobinar en burbuja explorador deshace esa respuesta y restaura la pregunta mentor anterior.
4. `onboarding_step` / `world_theme` / `placement_status` coherentes con el punto rebobinado (first-run al menos hasta placement).
5. Prod: sin iconos; `POST …/rewind` → 404.
6. Perfil tutor no rebobinable.
7. Tras rewind, el tutor puede enviar un turno nuevo y el flujo continúa sin recargar la página entera.

## Aprobación

- [x] Alcance: rewind parcial en play (no sustituye `poc-reset-journey` global)
- [x] Mismas guardas que modo debug IA (solo local, solo tutor)
- [x] Semántica ancla mentor vs explorador (§1.1)
- [x] Truncado Postgres + ledger (§4) — fases A+B
- [x] Reconstrucción estado MVP por fase (§4.3)
- [ ] Snapshots V2 (`meta.state_snapshot`) — fase C pendiente
- [x] UI icono en tarjetas + confirmación glass
- [x] API `POST /debug/journey/rewind` + dry-run
- [x] Tests unit + contract
- [ ] Playwright `debug-rewind-v1.png` — validar en local con stack arriba
