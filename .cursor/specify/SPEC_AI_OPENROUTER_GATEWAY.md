# Spec: Gateway LLM (OpenRouter) para KidepiK

> Estado: **aprobada** (julio 2026) — implementación en curso (plan AI_ADVENTURE_SYSTEM_PLAN)  
> Relacionado: [SPEC_AI_PLAY_ORCHESTRATION.md](SPEC_AI_PLAY_ORCHESTRATION.md), [SPEC_PHP_BACKEND_ARCHITECTURE.md](SPEC_PHP_BACKEND_ARCHITECTURE.md), [SPEC_HOSTING_FREE_TIER_STACK.md](SPEC_HOSTING_FREE_TIER_STACK.md), [docs/kidepik.md](../../docs/kidepik.md) §10.6  
> Patrón de transporte: KuiperBelt / PDA (`LLMClient` + fallback). **Política KidepiK:** solo modelos **free** de OpenRouter + **descubrimiento dinámico** y ranking interno.

## Contexto

Toda la IA de producto sale del **servidor PHP** hacia OpenRouter (`POST /api/v1/chat/completions`). La clave **nunca** llega al navegador; local y prod usan claves distintas.

**Decisión de producto:** no usar modelos de pago en el camino feliz. Solo variantes con sufijo `:free` en el id del modelo (tier gratuito explícito de OpenRouter). El sistema **descubre** periódicamente qué free hay disponibles y los ordena con un **ranking interno** (mejores primero, fallback decreciente).

## Máximas de producto (inviolables — ago 2026)

| Máxima | Regla |
| --- | --- |
| **Solo free** | Nunca modelos de pago en runtime. `AI_ALLOW_PAID` ignorado en código de producto; discovery y gateway solo aceptan ids con sufijo **obligatorio** `:free` (precio 0 si OpenRouter lo expone). |
| **Siempre LLM real** | Prohibido `AI_MOCK` en app, Docker local y producción. Sin respuestas deterministas ni `MockAiGateway` en `AiGateway::fromConfig()`. Los tests PHPUnit inyectan `chatFn` explícito si necesitan simular red. |
| **Sin fallback silencioso** | Si todos los modelos fallan → error visible (`compose_failed`, 503, logs `ai`/`compose`). No plantillas narrativas ni copy preescrito sustituto del LLM. |
| **Colas vivas** | `ai_purpose_model_queues` se mantiene al día: discovery periódico **y** refresh reactivo al agotar la cola o recibir 404. |
| **Solo chat texto** | Discovery excluye embeddings, audio (Lyria…), imagen, vídeo y cualquier modelo sin salida `text`. |
| **Autoredescubrimiento** | Tras agotar intentos en un purpose, `FreeModelQueueSync::refreshPurposeOnExhaustion` re-rankea desde OpenRouter y **sustituye** el top de la cola en BD; un reintento inmediato usa la cola nueva. |

## Objetivo

1. Capa `shared/Ai/` (cliente, gateway, cuota, mock).
2. **FreeModelCatalog**: descubrimiento vía `GET /api/v1/models`, caché, ranking.
3. Separar transporte de orquestación de juego.

---

## Principios

| Principio | Decisión |
| --- | --- |
| Solo free | Solo ids con sufijo `:free`; rechazar agregadores (`openrouter/auto`…) y cualquier precio &gt; 0 |
| OpenRouter primero y canónico | Sin depender de Groq/Gemini de pago; opcionales solo si exponen free y flag lo permite |
| Descubrimiento continuo | No confiar solo en lista estática en env |
| Ranking propio | Score interno → orden de intento |
| Fallback decreciente | Mejor rankeado → siguiente → … → error visible (sin mock ni plantilla) |
| Testable | PHPUnit inyecta `AiGateway` con `chatFn`; **no** `AI_MOCK` en runtime |
| Sin LangGraph en MVP | Orquestación PHP |

---

## 1. Ubicación de código

```
shared/Ai/
  LLMClient.php
  LLMException.php
  AiGateway.php
  AiUsageTracker.php
  MockAiGateway.php
  FreeModelCatalog.php      # discovery + cache + rank
  FreeModelRanker.php       # scoring
  ModelCatalogStore.php     # persistencia caché BD o fichero
```

---

## 2. Contrato `AiGateway`

```php
/**
 * @param list<array{role:string,content:string}> $messages
 * @param array{
 *   temperature?: float,
 *   max_tokens?: int,
 *   response_format?: array,
 *   purpose?: string,
 *   child_id?: string,
 *   require_json?: bool,
 * } $opts
 * @return array{content:string,provider:string,model:string,usage?:array}
 */
public function complete(array $messages, array $opts = []): array;
```

Flujo:

1. `AI_ENABLED` off → error configurado.
2. Cuota miembro agotada → `quota_exceeded`.
3. Obtener lista ordenada (cola BD + discovery, solo chat free).
4. Intentar en orden; **404** → deshabilitar modelo en cola BD + cooldown; 429/5xx/timeout/empty → cooldown.
5. Persistir `api_usage`.
6. Si todos fallan → `FreeModelQueueSync::refreshPurposeOnExhaustion` (rate-limited) y **un** reintento con cola refrescada.
7. Si sigue fallando → 503 / `compose_failed` (sin mock ni plantilla).

**Prohibido:** llamar a `openrouter/free` como único mecanismo opaco **sin** registrar qué modelo se usó, si eso impide telemetría. Se puede usar como **último** fallback de emergencia si el catálogo está vacío, logueando la respuesta `model` real si OpenRouter la devuelve.

---

## 3. Descubrimiento de modelos free

### 3.1 Fuente

`GET https://openrouter.ai/api/v1/models?output_modalities=text`

Auth: misma `OPENROUTER_API_KEY`. Cabeceras Referer/Title como en chat.

Documentación: [OpenRouter Models](https://openrouter.ai/docs/guides/overview/models); variantes free con sufijo `:free` ([free variants](https://openrouter.ai/docs/guides/routing/model-variants/free)).

### 3.2 Criterio «es free»

Un modelo entra al catálogo si **todas** se cumplen:

1. `pricing.prompt` y `pricing.completion` son `0` (o string `"0"`), **o** el `id` termina en `:free`.
2. Soporta salida texto (`architecture.modality` / output text).
3. No está en denylist interna (`AI_MODEL_DENYLIST` coma-separada).
4. Opcional: `supported_parameters` incluye lo que necesitemos (p. ej. si `require_json`, preferir modelos que documenten json; si ninguno, prompt-only JSON).

### 3.3 Caché y refresh

| Parámetro | Default |
| --- | --- |
| TTL caché | `AI_MODEL_CATALOG_TTL_SECONDS=3600` (1 h) |
| Refresh forzado | si la lista rankeada falla N veces seguidas (`AI_CATALOG_REFRESH_ON_FAILS=3`) |
| Persistencia | tabla `ai_model_catalog` o fichero bajo storage local del API |
| Job | al bootstrap PHP (lazy) + endpoint interno ops `POST /api/v1/admin/ai/refresh-models` (protegido) opcional |

```sql
create table public.ai_model_catalog (
  model_id text primary key,
  name text null,
  context_length int null,
  pricing_prompt numeric not null default 0,
  pricing_completion numeric not null default 0,
  is_free boolean not null default true,
  top_provider text null,
  raw jsonb null,
  rank_score numeric not null default 0,
  fail_count_window int not null default 0,
  last_success_at timestamptz null,
  last_fail_at timestamptz null,
  fetched_at timestamptz not null default now()
);
```

---

## 4. Ranking interno (mejores free primero)

Score compuesto (pesos configurables; defaults abajo). Mayor score = se intenta antes.

| Señal | Peso default | Notas |
| --- | --- | --- |
| Preferencia estática | +40 … +0 | Lista `AI_MODEL_PREFERENCE` (ids ordenados); match exacto o prefijo |
| Popularidad / top-weekly proxy | +0…15 | Si el payload trae trending; si no, 0 |
| Context length | +0…10 | Más contexto ayuda summaries; cap en 10 |
| Historial éxito local | +0…20 | `last_success` reciente y bajo `fail_count_window` |
| Penalización fallos | −5 por fallo en ventana 1 h (cap −40) | 429/404 cuentan |
| Penalización “novato” | −5 | Nunca usado con éxito en esta instalación |
| Propósito | boost | p. ej. summaries prefieren más contexto; dialogue ok modelos rápidos |

### 4.1 Lista de preferencia (semilla, no única fuente)

`AI_MODEL_PREFERENCE` en env — orden deseado **entre free**, ejemplo:

```
google/gemma-3-27b-it:free,meta-llama/llama-3.3-70b-instruct:free,qwen/qwen3-30b-a3b:free,...
```

Si un id preferido **no** está free/disponible hoy → se omite (no se usa de pago).

`OPENROUTER_MODELS` legacy: se interpreta como preferencia semilla, no como lista exclusiva.

### 4.2 Orden de intento

```
db_queue = ai_purpose_model_queues(purpose)  // si hay filas enabled
ranked = sort_desc(score) ∩ is_free ∩ not_denied
attempts = (db_queue ⊕ ranked_unique)[:AI_MAX_MODEL_ATTEMPTS]  // default 8
```

Ante fallo: siguiente. Éxito: `last_success_at`, reset parcial de fails.

### 4.3 Colas por purpose en BD (B1 — ago 2026)

Tabla `ai_purpose_model_queues` (`purpose`, `model_id`, `position`, `enabled`).

| Regla | Valor |
| --- | --- |
| Prioridad | Filas BD enabled primero; luego discovery rankeado (sin duplicar) |
| Vacío | Si no hay filas para el purpose → semilla env `AI_MODEL_PREFERENCE_*` + discovery (legacy) |
| Operación | `INSERT`/`UPDATE`/`DELETE` sin redeploy; caché PHP ~120 s |
| Código | `PurposeModelQueueStore` + `AiGateway::resolveAttempts` |

Purposes: `placement_exam_composer`, `placement_exam_batch_writer`, `placement_item_writer`, `dialogue`, `journey_summarizer`, `adventure_pitch`, `adventure_scene`, `adventure_challenge`, `adventure_waiting`.

### 4.4 Cooldown temporal de modelos (ago 2026)

Tabla `ai_model_cooldowns` (`purpose`, `model_id`, `error_class`, `expires_at`).

| Regla | Valor |
| --- | --- |
| Trigger | Tras fallo LLM en `AiGateway` (no en cola inyectada de tests) |
| TTL | Por clase: transport/timeout 6 h, HTTP 404 24 h, 429 2 h, empty 4 h, HTTP otro 6 h (env `AI_COOLDOWN_*_HOURS`) |
| Éxito | Borra la fila cooldown para ese purpose+modelo |
| Resolución | Modelos en cooldown se omiten; se rellena con discovery hasta `AI_MAX_MODEL_ATTEMPTS` |
| Presupuesto | `AI_GATEWAY_WALL_BUDGET_SECONDS` (default 90) — aborta fallback antes de timeout nginx |

### 4.5 Discovery periódico en colas BD (ago 2026)

`FreeModelQueueSync`: cada `AI_DISCOVERY_INTERVAL_HOURS` (default 6), `GET /models` → inserta hasta `AI_DISCOVERY_MAX_NEW_PER_PURPOSE` modelos free nuevos por purpose en `ai_purpose_model_queues` (`notes=auto-discovery`).

Arranque contenedor PHP (`sync-ai-discovery.php`) + chequeo ligero en cada request API (`syncIfStale`). Estado en `ai_runtime_state`.

### 4.5.1 Refresh reactivo al agotar cola (ago 2026)

Cuando `AiGateway::complete` agota todos los modelos de un `purpose` **sin** cola inyectada (tests):

1. `FreeModelQueueSync::refreshPurposeOnExhaustion($purpose)` si no hubo refresh en los últimos `AI_QUEUE_REFRESH_MIN_MINUTES` (default **5**).
2. `GET /models` → ranking chat free → `replaceTopModels` en BD (top `AI_DISCOVERY_REBUILD_TOP`, default **15**).
3. Modelos con **404** reciente se marcan `enabled=false` en cola.
4. Un único reintento del request con caché de cola invalidada.
5. Log `free_model_queue_refresh` en canal `ai`.

### 4.6 Prioridad por éxito reciente (delta A2 — implementada)

Complementa §4.4. Objetivo: modelos free que **completan** `placement_exam_composer` (u otros purposes) suben al frente de la cola resuelta.

| Señal | Fuente | Efecto |
| --- | --- | --- |
| Éxito `ok=true` reciente | `ai_call_attempts` (ventana `AI_SUCCESS_BOOST_HOURS`, default **48**) | Boost score / prepend en `resolved_models` |
| Fallos soft (`empty`, JSON inválido post-parse en composer) | Contador opcional o intentos `ok=false` | Soft demote (no cooldown duro salvo umbral) |
| Cooldown activo | `ai_model_cooldowns` | Exclusión dura hasta TTL |

Orden de resolución propuesto:

```
available = db_queue ⊕ discovery  − cooldown
sorted = sort_by(success_count_desc, position_asc, discovery_rank)
attempts = sorted[:AI_MAX_MODEL_ATTEMPTS]
```

Uso en compose paralelo: ver [SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE.md](SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE.md) §A2 (lotes + sticky winner).

---

## 5. Política «nunca de pago» (inviolable)

| Control | Comportamiento |
| --- | --- |
| Código | `Config::aiAllowPaid()` siempre `false`; gateway ignora modelos sin `:free` |
| Catálogo | Filtra precio &gt; 0 |
| CI | Test: fixture con modelo de pago → no entra en ranked |
| Prod / local | Igual; **no** existe flag para activar paid |

No hay fallback a Groq/Gemini de pago. `AI_PROVIDERS=openrouter` únicamente.

---

## 6. Secretos y env

| Variable | Rol |
| --- | --- |
| `OPENROUTER_API_KEY` | Chat + discovery |
| `OPENROUTER_BASE_URL` | default `https://openrouter.ai/api/v1` |
| `AI_MODEL_PREFERENCE` | Semilla de ranking |
| `AI_MODEL_DENYLIST` | Excluir ids rotos |
| `AI_MODEL_CATALOG_TTL_SECONDS` | Caché |
| `AI_MAX_MODEL_ATTEMPTS` | Tope de fallback por request |
| `AI_ALLOW_PAID` | Ignorado (siempre free en código) |
| `AI_DISCOVERY_REBUILD_TOP` | Modelos top al refresh reactivo (default 15) |
| `AI_QUEUE_REFRESH_MIN_MINUTES` | Mínimo entre refresh reactivos por purpose (default 5) |
| `AI_ENABLED` / cuotas | igual que antes |
| `AI_MOCK` | **Prohibido** en runtime; solo tests con gateway inyectado |

Secretos: `.secrets/openrouter.env` local; prod distinta.

---

## 7. Cuotas

Por `child_id` (miembro) / día: `AI_RATE_LIMIT_PER_CHILD_DAY` (nombre histórico; aplica a cualquier edad). 429 amable con voz de mentor.

---

## 8. Criterios de aceptación

1. Discovery marca free solo si precio 0 o `:free`.
2. Modelo de pago en preferencia **no** se llama con `AI_ALLOW_PAID=false`.
3. Ranking pone preferidos disponibles por delante de desconocidos.
4. Tras 429 en modelo A, el mismo request prueba B.
5. Caché TTL: segunda llamada no pega a `/models` si fresca.
6. PHPUnit usa `chatFn` inyectado; runtime nunca `AI_MOCK`.
7. Telemetría guarda `model` real usado.
8. 404 deshabilita modelo en cola; agotar cola dispara refresh reactivo y un reintento.
9. Discovery excluye modelos no-chat (Lyria, embed, imagen…).

---

## 9. Telemetría de intentos y modo debug (delta — ago 2026)

> Contrato UI/API de activación: [SPEC_APP_DEBUG_MODE.md](SPEC_APP_DEBUG_MODE.md).  
> Estado: **pendiente de aprobación** junto a esa spec.

### 9.1 Problema

`complete()` hace fallback silencioso: cada `LLMException` se traga sin registro. Sin traza no se puede distinguir 429 vs JSON vacío vs cola vacía vs validación de placement.

### 9.2 Obligaciones del gateway

| Obligación | Detalle |
| --- | --- |
| Traza por request | Lista de intentos (`model_id`, `ok`, `http_status`, `latency_ms`, `error_class`) |
| Cola resuelta | Incluir snapshot de `resolveAttempts` + `queue_source` |
| Éxito | Seguir devolviendo `model` real; escribir `api_usage` (implementar `AiUsageTracker`) |
| Debug off | Traza solo en memoria/log local si `APP_DEBUG_AI`; no filtrar al cliente |
| Debug on | Adjuntar traza a callers / respuestas según SPEC_APP_DEBUG_MODE |

### 9.3 Clasificación de errores

| `error_class` | Cuándo |
| --- | --- |
| `timeout` | Guzzle timeout / connect |
| `http` | Status ≥ 400 con cuerpo |
| `empty` | HTTP OK sin content |
| `json` | Content no parseable cuando se exige JSON |
| `transport` | Error de red genérico |
| `other` | Resto |

### 9.4 Env

| Variable | Default | Rol |
| --- | --- | --- |
| `APP_DEBUG_AI` | `false` | Habilita traza hacia cliente + endpoints `/debug/ai` (solo si `APP_ENV` no es production) |
| `AI_MAX_MODEL_ATTEMPTS` | `12` | Alinear compose.yaml sample con Config |

### 9.5 Criterios añadidos

8. Con gateway stub (fail, fail, ok), la traza lista 3 intentos y `winner_model` = el tercero.
9. Con todos fail, la traza lista N intentos y la excepción final sigue siendo `all free models failed` / última LLMException.
10. `api_usage` recibe al menos una fila en éxito (purpose + model).

## Aprobación

- [ ] Solo OpenRouter free + discovery `GET /models`
- [ ] Ranking interno + fallback decreciente
- [ ] `AI_ALLOW_PAID=false` por defecto
- [ ] Caché persistida + penalización por fallos
- [ ] §9 Telemetría de intentos + enlace SPEC_APP_DEBUG_MODE
