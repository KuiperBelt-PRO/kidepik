# Spec: Gateway LLM (OpenRouter) para KidepiK

> Estado: **aprobada** (julio 2026) — implementación en curso (plan AI_ADVENTURE_SYSTEM_PLAN)  
> Relacionado: [SPEC_AI_PLAY_ORCHESTRATION.md](SPEC_AI_PLAY_ORCHESTRATION.md), [SPEC_PHP_BACKEND_ARCHITECTURE.md](SPEC_PHP_BACKEND_ARCHITECTURE.md), [SPEC_HOSTING_FREE_TIER_STACK.md](SPEC_HOSTING_FREE_TIER_STACK.md), [docs/kidepik.md](../../docs/kidepik.md) §10.6  
> Patrón de transporte: KuiperBelt / PDA (`LLMClient` + fallback). **Política KidepiK:** solo modelos **free** de OpenRouter + **descubrimiento dinámico** y ranking interno.

## Contexto

Toda la IA de producto sale del **servidor PHP** hacia OpenRouter (`POST /api/v1/chat/completions`). La clave **nunca** llega al navegador; local y prod usan claves distintas.

**Decisión de producto:** no usar modelos de pago en el camino feliz. Solo variantes free (`pricing` a 0 / sufijo `:free`). El sistema **descubre** periódicamente qué free hay disponibles y los ordena con un **ranking interno** (mejores primero, fallback decreciente).

## Objetivo

1. Capa `shared/Ai/` (cliente, gateway, cuota, mock).
2. **FreeModelCatalog**: descubrimiento vía `GET /api/v1/models`, caché, ranking.
3. Separar transporte de orquestación de juego.

---

## Principios

| Principio | Decisión |
| --- | --- |
| Solo free | Rechazar cualquier modelo con precio &gt; 0 en prompt o completion |
| OpenRouter primero y canónico | Sin depender de Groq/Gemini de pago; opcionales solo si exponen free y flag lo permite |
| Descubrimiento continuo | No confiar solo en lista estática en env |
| Ranking propio | Score interno → orden de intento |
| Fallback decreciente | Mejor rankeado → siguiente → … → mensaje amable |
| Testable | `AI_MOCK=true` sin red |
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
2. `AI_MOCK` → mock.
3. Cuota miembro agotada → `quota_exceeded`.
4. Obtener lista ordenada de `FreeModelCatalog::rankedFor($purpose)`.
5. Intentar en orden; 404/429/5xx/timeout → siguiente; registrar fallo en ranking (penalización temporal).
6. Persistir `api_usage`.
7. Si todos fallan → 503 «Tu mentor medita entre estrellas; vuelve en un rato.»

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

Purposes semilla: `placement_exam_composer`, `placement_exam_batch_writer`, `placement_item_writer`, `dialogue`, `journey_summarizer`.

---

## 5. Política «nunca de pago»

| Control | Comportamiento |
| --- | --- |
| `AI_ALLOW_PAID=false` (default) | Gateway aborta si alguien configura un modelo con precio &gt; 0 |
| Catálogo | Filtra precio &gt; 0 |
| CI | Test: fixture con modelo de pago → no entra en ranked |
| Prod | Misma flag; activar paid solo con decisión explícita de negocio (fuera de MVP) |

No hay fallback a Groq/Gemini de pago en el camino por defecto. `AI_PROVIDERS=openrouter` únicamente salvo ampliación futura free-compatible.

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
| `AI_ALLOW_PAID` | `false` |
| `AI_MOCK` / `AI_ENABLED` / cuotas | igual que antes |

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
6. Mock no usa red; PHPUnit con fixture de catálogo.
7. Telemetría guarda `model` real usado.

## Aprobación

- [ ] Solo OpenRouter free + discovery `GET /models`
- [ ] Ranking interno + fallback decreciente
- [ ] `AI_ALLOW_PAID=false` por defecto
- [ ] Caché persistida + penalización por fallos
