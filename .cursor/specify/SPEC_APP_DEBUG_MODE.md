# Spec: Modo debug de producto (tutor / local)

> Estado: **implementada** (1 ago 2026)  
> Amplía / relaciona: [SPEC_AI_GEMINI_GATEWAY.md](SPEC_AI_GEMINI_GATEWAY.md), [SPEC_APP_SETTINGS_SECTION.md](SPEC_APP_SETTINGS_SECTION.md) §2.6, [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md), [SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE.md](SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE.md), [DESIGN.md](../DESIGN.md)  
> Diagrama: [11-child-adventure-pipeline.md](../diagrams/11-child-adventure-pipeline.md)

## Contexto

Hoy, cuando falla «preparar la prueba» (placement compose), el tutor solo ve un mensaje narrativo amable. **No hay forma en la app** de saber:

- qué modelos de la cola BD se iban a intentar;
- cuáles se intentaron realmente y con qué HTTP/status;
- si el fallo fue transporte (429/5xx), JSON inválido, validación de slots incompleta, o clave OpenRouter ausente;
- qué `purpose` y `AI_MAX_MODEL_ATTEMPTS` aplicaron.

El gateway **sí hace fallback** en código (`AiGateway::complete` recorre la cola), pero **traga** `LLMException` sin telemetría. `api_usage` existe en esquema y **no se escribe** (falta `AiUsageTracker`). `PlacementExamComposer` captura `\Throwable` y devuelve `[]` sin rastro.

## Objetivo

1. **Modo debug** opt-in, solo entornos no-prod (o flag explícito), visible para el tutor autenticado.
2. **Traza de intentos LLM** por request (modelo, purpose, resultado, latencia, error corto).
3. **Panel UI** y/o payload en respuestas de diálogo/placement cuando el modo está activo.
4. **Endpoints de inspección** (cola BD, últimos intentos, health IA) sin exponer secretos.
5. Base para diagnosticar fallos de compose sin mirar solo el dashboard de OpenRouter.

**No implementar hasta aprobación explícita.**

---

## Principios

| Principio | Decisión |
| --- | --- |
| Opt-in | Off por defecto; el niño nunca ve el panel |
| Sin secretos | Nunca `OPENROUTER_API_KEY`, tokens JWT, ni cuerpos de prompt completos en prod; en local debug sí se puede truncar prompt |
| Narrativa intacta | El copy del mentor al niño no cambia; el debug es capa aparte |
| Free only | Debug no habilita modelos de pago |
| Proporcional | Fase A = traza + panel play/ajustes; Fase B = ops admin |

---

## 1. Activación del modo debug

### 1.1 Fuentes de verdad (prioridad)

| # | Fuente | Cómo |
| --- | --- | --- |
| 1 | Env servidor | `APP_DEBUG_AI=true` **y** `APP_ENV=local` (POC; en prod el debug está deshabilitado) |
| 2 | Permiso de cuenta (DB) | Tutor miembro de un grupo con permiso `debug_ai` (`developers`, `admins`) — ver §1.4 |
| 3 | Ajustes de cuenta (DB) | `parent_accounts.settings.diagnostics.debug_ai_enabled` — toggle «Diagnóstico IA» en Ajustes (sticky) |

**Prod (`APP_ENV=production`):** modo debug **imposible** aunque el tutor tenga permiso en BD. El API responde sin `debug` y el front no monta el panel.

**Activo en runtime** cuando se cumplen **1 ∧ 2 ∧ 3**. El API expone el resumen en `GET /api/v1/parents/me/settings` → `debug_capabilities` (`operator_eligible`, `debug_enabled`, `debug_allowed`).

### 1.2 Quién lo ve

- Solo **tutor autenticado** con permiso `debug_ai` (grupo `developers` o `admins` en BD).
- La sección **«Modo debug»** en Ajustes solo se muestra si `operator_eligible` es true.
- El toggle **«Activar modo debug»** persiste `settings.diagnostics.debug_ai_enabled` (opt-in del tutor; el permiso en BD no activa el modo solo).
- En `#/play/:childId` el panel es overlay tutor (no burbuja del mentor); el rebobinado (↺) requiere modo debug activo.

### 1.3 Señal al API

Cabecera opcional en requests de play/diálogo:

```
X-Kidepik-Debug-Ai: 1
```

El servidor **ignora** la cabecera si no hay `debug_allowed` (entorno + permiso + toggle). Si la permite, adjunta bloque `debug` en JSON de respuesta (ver §3).

### 1.4 Grupos y permisos (PostgreSQL)

Migración: `supabase/migrations/20260818163000_parent_account_groups_permissions.sql`

| Tabla | Rol |
| --- | --- |
| `app_groups` | Catálogo (`developers`, `admins`, …) |
| `app_permissions` | Permisos de producto (`debug_ai`, …) |
| `app_group_permissions` | Permisos concedidos a cada grupo |
| `parent_account_groups` | Membresía tutor ↔ grupo |
| `app_group_bootstrap_emails` | Emails que reciben un grupo al login/bootstrap |

Catálogo inicial:

- Grupos `developers` y `admins` → permiso `debug_ai`.
- Solo el **API (service role)** escribe membresías; el cliente no puede auto-asignarse grupos.

### 1.5 Operativa local

**Añadir un desarrollador** (cuenta ya existente):

```bash
docker exec kidepik-poc-api-1 python -m app.scripts.grant_parent_group \
  --email tutor@example.com --group developers
```

**Preautorizar email antes del primer login** (persistente en BD):

```sql
insert into public.app_group_bootstrap_emails (email, group_id)
select 'nuevo@example.com', g.id from public.app_groups g where g.slug = 'developers'
on conflict do nothing;
```

Al siguiente `POST /parents/bootstrap` o cualquier ruta que llame `get_or_bootstrap`, se inserta la membresía en `parent_account_groups`.

**Desarrolladores fundadores (seed):** `edusernalonso@gmail.com` → grupo `developers` (`20260818170000_debug_developer_bootstrap_emails.sql`).

---

## 2. Qué debe poder responder el sistema (preguntas de diagnóstico)

| Pregunta | Fuente |
| --- | --- |
| ¿Qué modelos hay en BD para `placement_exam_composer`? | `GET …/debug/ai/queues` → filas `ai_purpose_model_queues` |
| ¿Qué cola resolvió el gateway para este purpose? | `resolveAttempts` snapshot en traza |
| ¿Hizo fallback? | Lista ordenada de intentos con `ok`/`fail` |
| ¿Por qué falló cada uno? | `http_status`, `error_class`, `error_brief` (sin stack ni key) |
| ¿Falló compose por LLM o por validación? | `compose.outcome`: `llm_empty` \| `json_invalid` \| `slots_incomplete` \| `ok` |
| ¿Cuántos slots pedía? | `compose.slot_count`, `compose.subjects` |
| ¿Hay clave / mock? | `ai.enabled`, `ai.mock`, `ai.key_present` (bool) |

---

## 3. Contrato de traza LLM (servidor)

### 3.1 Estructura `AiAttemptTrace` (por `complete()`)

```ts
type AiAttemptTrace = {
  purpose: string;
  queue_source: 'db' | 'discovery' | 'env_seed' | 'injected';
  resolved_models: string[];      // cola final (antes de intentar)
  max_attempts: number;
  attempts: Array<{
    model_id: string;
    ok: boolean;
    http_status?: number;
    latency_ms: number;
    error_class?: 'timeout' | 'http' | 'empty' | 'json' | 'transport' | 'other';
    error_brief?: string;         // ≤ 160 chars, sin PII
  }>;
  winner_model?: string;
  total_latency_ms: number;
};
```

### 3.2 Persistencia

| Almacén | Uso |
| --- | --- |
| Memoria request | Siempre que debug activo: devolver en response |
| Tabla `ai_call_attempts` (nueva) | Una fila por intento (o JSON agregado por `call_id`) — retención 7 días local / configurable |
| `api_usage` | Una fila por **éxito** (como ya prevé la gateway spec); ampliar con `ok=false` opcional en Fase B |

Migración propuesta:

```sql
create table if not exists public.ai_call_attempts (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null,
  child_id uuid null references public.children(id) on delete set null,
  purpose text not null,
  model_id text not null,
  position int not null,
  ok boolean not null,
  http_status int null,
  latency_ms int null,
  error_class text null,
  error_brief text null,
  meta jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists ai_call_attempts_call_idx on public.ai_call_attempts (call_id);
create index if not exists ai_call_attempts_created_idx on public.ai_call_attempts (created_at desc);
```

### 3.3 Cambios en `AiGateway`

1. En cada intento: registrar entrada en traza (éxito o `LLMException`).
2. Método `getLastTrace(): ?AiAttemptTrace` o devolver `trace` en el array de retorno cuando `opts['capture_trace']=true`.
3. **No** cambiar el orden de fallback.

### 3.4 Cambios en `PlacementExamComposer` / `PlacementService`

Cuando falle:

```ts
type ComposeDebug = {
  outcome: 'ok' | 'llm_empty' | 'json_invalid' | 'slots_incomplete' | 'ai_disabled' | 'exception';
  slot_count: number;
  subjects: string[];
  compose_attempts: number;     // bucles del composer (hoy 3)
  llm_traces: AiAttemptTrace[]; // una por llamada complete()
  validation?: { missing_slots: number[]; invalid_keys: string[] };
};
```

En fallo de compose con debug:

- `dialogue_turns.meta` incluye `compose_failed: true` **y** `compose_debug` (o solo id `call_id` si el payload es grande).
- Respuesta HTTP de turn incluye `debug.compose` si cabecera/entorno lo permiten.

Copy al niño: **sin cambio** («no he podido preparar tu prueba…»).

---

## 4. API de inspección (debug)

> **Delta ago 2026 (Gemini):** el panel y `/debug/ai/*` ya no usan colas OpenRouter / `ai_purpose_model_queues`.  
> Provider canónico: **Gemini** (`provider=gemini`, cola desde env `AI_GEMINI_MODEL_LIST`).  
> Purpose por defecto: `mentor_guide` (alias: `placement_exam_composer` → `placement_item_writer`).  
> Intentos recientes: logs `ai-*.log` (`llm_attempt`); `ai_call_attempts` solo como fallback legado.

Base: `/api/v1/debug/ai/…`  
Auth: JWT tutor.  
Guard: `ai_debug_enabled()` → si false, **404**.

| Método | Ruta | Respuesta |
| --- | --- | --- |
| `GET` | `/debug/ai/status` | `{ enabled, provider, mock, key_present, models, max_attempts, … }` |
| `GET` | `/debug/ai/queues?purpose=` | Filas env Gemini (`enabled`, `model_id`, `tier`) |
| `GET` | `/debug/ai/resolve?purpose=mentor_guide` | `{ models, resolved_models, queue_source=gemini_env, tier }` |
| `GET` | `/debug/ai/attempts?limit=20` | Últimos `llm_attempt` (log) o filas legacy |
| `POST` | `/debug/ai/ping` | Ping `mentor_guide` vía Gemini; `{ ok, model, provider }` |

**Prohibido:** devolver la API key, headers Authorization, o system prompts íntegros en ping (truncar a 200 chars si se incluye).

---

## 5. UI — panel debug

### 5.1 Anatomía (390×844)

En play / tras fallo de compose, o desde Ajustes → Diagnóstico:

```
┌─────────────────────────────────┐
│ Diagnóstico IA            [×]   │
│─────────────────────────────────│
│ Estado: provider=gemini · key=… │
│ Purpose: mentor_guide           │
│ Cola Gemini (N, gemini_env):    │
│  1. gemini-3-flash-preview      │
│  2. gemini-2.5-flash            │
│  …                              │
│ Últimos intentos (logs):        │
│  ✓ mentor_guide · gemini-…      │
│ [Copiar JSON] [Ping IA]         │
└─────────────────────────────────┘
```

Tokens DESIGN: glass modal existente (`SPEC_APP_GLASS_MODAL`), tipografía Nunito, sin cards innecesarias.

### 5.2 Entrada UX

| Superficie | Cómo abrir |
| --- | --- |
| Play | Si último turn tiene `compose_failed` **y** debug activo → chip «Ver diagnóstico» bajo el mensaje de reintento |
| Ajustes | Bloque Avanzado → «Diagnóstico IA» (solo si `debug_allowed`) |
| Query | `?debugAi=1` muestra FAB pequeño «DBG» (esquina, z-index bajo shell) |

### 5.3 Copy

- Títulos en castellano de España.
- Errores técnicos en monospace corto; no asustar al tutor con stacks.

---

## 6. Logging servidor (local)

Ver contrato completo en [SPEC_APP_FILE_LOGGING.md](SPEC_APP_FILE_LOGGING.md).

| Destino | Contenido |
| --- | --- |
| `web/logs/{channel}-{Y-m-d}.log` (JSONL) | Canales `api`, `ai`, `compose`; niveles según `LOG_LEVEL`; con `APP_DEBUG_AI=true` umbral **debug** en esos canales |
| Contenedor | Volumen Docker `web/logs` → `/var/www/html/logs` |
| Sin PII | No loguear texto del niño, tokens ni API keys (`[redacted]`) |

---

## 7. Relación con specs existentes

| Spec | Cambio |
| --- | --- |
| SPEC_AI_GEMINI_GATEWAY | Telemetría de intentos + tracker mínimo |
| SPEC_APP_SETTINGS_SECTION §2.6 | Sustituir «fuera de UI» por enlace a esta spec |
| SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE | Meta `compose_debug` en fallo |
| SPEC_APP_ADVENTURE_DIALOGUE | Campo opcional `debug` en response de turn |
| SPEC_APP_DEBUG_JOURNEY_REWIND | Rebobinar viaje a un turno en play (solo debug local) |
| DESIGN.md | Nota panel diagnóstico glass |
| Diagrama 11 | Nodo DebugAi opcional |

---

## 8. Fases de implementación (tras aprobación)

| Fase | Entrega |
| --- | --- |
| **A** | Traza en `AiGateway` + `compose_debug` en fallo + `GET /debug/ai/status|queues|resolve` + panel tras compose_failed |
| **B** | Persistencia `ai_call_attempts` + `GET /debug/ai/attempts` + escritura `api_usage` en éxitos |
| **C** | `POST /debug/ai/ping` + FAB DBG + toggle Ajustes |

---

## 9. Criterios de aceptación

1. Con `APP_ENV=local` y `APP_DEBUG_AI=true`, tras «Reintentar prueba» fallido, el tutor puede abrir diagnóstico y ver **lista de modelos intentados** (o «ningún intento: key/disabled/cola vacía»).
2. `GET /debug/ai/queues?purpose=placement_exam_composer` lista las filas BD en orden (hoy 12 tras migración expand).
3. `GET /debug/ai/resolve?purpose=…` muestra la cola efectiva (BD primero).
4. En prod, las rutas `/debug/ai/*` responden 404 y el front no pinta panel aunque `?debugAi=1`.
5. El mensaje al explorador sigue siendo narrativo; sin IDs de modelo en burbujas.
6. Tests PHPUnit: traza con gateway stub (2 fails + 1 ok); compose_failed incluye outcome; guard de prod.
7. Playwright 390×844: captura `tmp/playwright-output/debug-ai-compose-fail-v1.png` con panel abierto (mock fallo).

---

## 10. Decisiones a confirmar

| ID | Decisión propuesta |
| --- | --- |
| A | Modo debug solo no-prod + opt-in (`APP_DEBUG_AI` / `?debugAi=1`) |
| B | Traza de intentos en gateway (obligatoria para diagnosticar fallback) |
| C | Panel UI en play tras `compose_failed` + sección Ajustes |
| D | Endpoints `/api/v1/debug/ai/*` con 404 en prod |
| E | Persistencia `ai_call_attempts` en Fase B (Fase A puede ser solo response) |
| F | Spec nueva `SPEC_APP_DEBUG_MODE.md` + delta gateway (no solo chat) |

---

## 11. Diagnóstico actual (investigación previa a esta spec)

Hecho el 1 ago 2026 en POC local:

| Hallazgo | Detalle |
| --- | --- |
| Cola BD `placement_exam_composer` | **12 modelos** tras aplicar `20260801002000_expand_free_model_queues.sql` (Nemotron Ultra → … → Laguna XS) |
| Fallback en código | Sí: `AiGateway::complete` itera `resolveAttempts` |
| Observabilidad | **No**: excepciones tragadas; sin log de intento; sin `AiUsageTracker` |
| `api_usage` | Tabla existe (`model`, no `model_id`); **sin escrituras** en runtime actual |
| Compose fail | `PlacementExamComposer` → `[]` → `placement_compose_failed`; meta solo `compose_failed: true` |
| Tope intentos | `Config` default 12; `docker/compose.yaml` aún documenta/env default **8** → alinear en implementación |

**Conclusión:** no se puede saber desde la app qué modelos se probaron; hace falta esta spec antes de seguir «a ciegas» con OpenRouter.
