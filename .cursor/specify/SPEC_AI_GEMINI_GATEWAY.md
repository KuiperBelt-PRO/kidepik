# Spec: Gateway LLM Gemini (tier free) — FastAPI / agentes

> Estado: **aprobada** (ago 2026)  
> Hilo: IA agentic FastAPI (aparte de la paridad PHP/OpenRouter)  
> Relacionado: [SPEC_AI_PYDANTIC_AGENTS.md](SPEC_AI_PYDANTIC_AGENTS.md), [SPEC_AI_AGENT_SKILLS.md](SPEC_AI_AGENT_SKILLS.md), [SPEC_AI_JOURNEY_FILE_LEDGER.md](SPEC_AI_JOURNEY_FILE_LEDGER.md), [SPEC_FASTAPI_BACKEND_MIGRATION.md](SPEC_FASTAPI_BACKEND_MIGRATION.md), [SPEC_APP_FILE_LOGGING.md](SPEC_APP_FILE_LOGGING.md), [SPEC_APP_DEBUG_MODE.md](SPEC_APP_DEBUG_MODE.md)

## Contexto

El stack OpenRouter PHP fue retirado (ago 2026). En el **hilo agentic FastAPI** el transporte de producto es **Google Gemini API (AI Studio)** vía Pydantic AI (`google:<model>` + `GOOGLE_API_KEY` / `GEMINI_API_KEY`).

POC: lista ordenada de modelos Gemini free, **sin plantillas** de sustitución y **sin LangGraph**.

## Objetivo

1. Proveedor canónico Gemini para `backend/`.
2. Modelo primario + **fallback por lista estática** cuando un modelo agote cuota o falle de forma no recuperable.
3. Errores de producto visibles cuando **toda** la lista esté agotada o indisponible.
4. Coexistencia temporal con OpenRouter solo en PHP legado.

---

## 1. Decisiones de producto (POC)

| # | Decisión | Valor |
| --- | --- | --- |
| G1 | Proveedor | **Google Gemini API** (AI Studio); Vertex no obligatorio en POC |
| G2 | Framework | **Pydantic AI** `Agent('google:…')` / `GoogleProvider` |
| G3 | Modelo primario | **`gemini-3-flash-preview`** |
| G4 | Tier | **Solo free** del proyecto Gemini; sin facturación de producto en POC |
| G5 | Fallback | **Lista estática ordenada** de modelos Gemini free (`AI_GEMINI_MODEL_LIST`); **nunca** OpenRouter ni plantillas |
| G6 | Mock runtime | **Prohibido** en app/Docker producto. Tests: `TestModel` / fake |
| G7 | Clave | Solo servidor; nunca en `web/` |

### 1.1 Relación con OpenRouter

| Camino | Gateway | Estado |
| --- | --- | --- |
| PHP `/api/v1/play/*` (mientras exista) | OpenRouter free | Legado; no ampliar |
| FastAPI play / agentes | Gemini free + lista | **Canónico nuevo** |
| Cutover play → FastAPI | Gemini | OpenRouter fuera del camino feliz |

Sin discovery OpenRouter. La lista de modelos Gemini se configura por env (y se puede ampliar a mano).

---

## 2. Configuración

| Variable | Obligatorio | Descripción |
| --- | --- | --- |
| `GOOGLE_API_KEY` o `GEMINI_API_KEY` | Sí (si IA on) | Clave AI Studio |
| `AI_ENABLED` | Sí | Master switch |
| `AI_GEMINI_MODEL_LIST` | No | CSV ordenado; default abajo |
| `AI_PROVIDER` | No | Default `gemini` |

**Default POC de lista** (ajustable sin código si el id de modelo cambia en Google):

```
gemini-3-flash-preview,gemini-2.5-flash,gemini-2.0-flash
```

- Primer id = primario.
- Tras fallo de cuota **por modelo** (`ai_quota_exhausted` / rate limit diario de ese id) → probar el siguiente.
- Si el fallo es RPM corto (`ai_rate_limited`) → 1 retry breve en el **mismo** modelo; si persiste, pasar al siguiente de la lista.
- Si **todos** fallan → error de producto con el último `error_code` relevante (prioridad: `ai_quota_exhausted` si alguno lo fue).

Secretos: `kidepik/.secrets/` (p. ej. `gemini.env`); no versionar claves.

Deps: `pydantic-ai` (+ Google). Sin `langgraph` / `langchain`.

---

## 3. Modelo, cuota y política de lista

### 3.1 Prefijo Pydantic AI

```
google:{model_id}
```

Ej.: `google:gemini-3-flash-preview`. Structured output: `output_type=<Pydantic model>`.

### 3.2 Límites free

Los límites RPM/TPM/RPD dependen del proyecto ([AI Studio rate limits](https://aistudio.google.com/rate-limit)). **No** hardcodear números como verdad de negocio. Clasificar `429` / `RESOURCE_EXHAUSTED` y avanzar en la lista según §2.

**Referencia capturada (proyecto `kidepik`):** [.cursor/operations/GEMINI_API_FREE_TIER_LIMITS_KIDEPIK.md](../operations/GEMINI_API_FREE_TIER_LIMITS_KIDEPIK.md).

### 3.3 Listas por purpose (fallback ordenado)

`backend/app/config.py` define `GEMINI_PURPOSE_MODEL_DEFAULTS`: cada agente tiene lista propia (preferente → reserva si cuota/RPM agotada). Composes batch (`path_composer`, `placement_item_writer`) priorizan **lite** (≈500 RPD); diálogo prioriza **quality** y reserva lite.

Override global opcional: `AI_GEMINI_MODEL_LIST` / `AI_GEMINI_MODEL_LIST_LITE` solo para purposes sin entrada explícita en el mapa.

### 3.4 Matriz de reintentos

| Situación | Acción |
| --- | --- |
| 429 RPD / cuota diaria del modelo | Marcar modelo agotado (cooldown hasta reset día o flag en memoria de proceso); **siguiente** de la lista |
| 429 RPM/TPM | 1 retry corto mismo modelo; si falla → siguiente |
| 503 / timeout | Hasta 2 retries mismo modelo; luego siguiente |
| 400 / 401 / 403 | Sin retry de lista útil; `ai_not_configured` o error de config |
| Schema vacío / inválido | Reintentos acotados **mismo** modelo; luego `ai_compose_failed` (no cambiar modelo solo por schema, salvo política ops) |
| Lista agotada | `ai_quota_exhausted` o `ai_provider_unavailable` según mayoría de causas |

**Sin plantillas narrativas** ([SPEC_APP_ADVENTURE_LLM_NARRATIVE](SPEC_APP_ADVENTURE_LLM_NARRATIVE.md)).

---

## 4. Contratos de error

| `error_code` | HTTP | Cuándo | Copy (ES, neutro) |
| --- | --- | --- | --- |
| `ai_quota_exhausted` | 503 | Toda la lista sin cuota usable | «Se ha acabado la cuota gratuita de IA por ahora. Vuelve más tarde.» |
| `ai_rate_limited` | 429 | Rate limit y aún hay esperanza de retry corto (antes de agotar lista) | «La IA está muy ocupada ahora. Espera un momento e inténtalo de nuevo.» |
| `ai_provider_unavailable` | 503 | 5xx/timeout en todos | «No hemos podido hablar con la IA. Reinténtalo.» |
| `ai_not_configured` | 503 | Sin key / `AI_ENABLED=false` | «La IA no está configurada en este entorno.» |
| `ai_compose_failed` | 503 | Schema/vacío tras reintentos | Copy play existente |
| `ai_safety_blocked` | 422 | Safety Gemini | «No podemos continuar con ese mensaje. Prueba otra respuesta.» |

```json
{
  "detail": "…",
  "error_code": "ai_quota_exhausted",
  "provider": "gemini",
  "model": "gemini-3-flash-preview",
  "models_tried": ["gemini-3-flash-preview", "gemini-2.5-flash"],
  "retryable": false
}
```

UI: toast glass; debug tutor con `models_tried`. Logs `ai`: un `llm_attempt` por modelo intentado.

---

## 5. Código

```
backend/app/ai/
  gemini_gateway.py   # lista, clasificación errores, factory modelo
  models.py
```

Gateway delgado: no juego, no skills, no ledger.

---

## 6. Criterios de aceptación

1. Smoke con primario `gemini-3-flash-preview`.
2. Simular cuota agotada en el primero → intenta el segundo; log con ambos `llm_attempt`.
3. Lista entera fallida → `ai_quota_exhausted` (o código acordado) + toast.
4. Sin OpenRouter en `backend/` agentic.
5. Tests del clasificador y del avance de lista **sin** red.

## Aprobación

- [x] Gemini free + Flash 3 primario *(propuesto)*
- [x] Fallback por lista estática Gemini *(decidido)*
- [ ] Errores explícitos al agotar la lista
- [ ] OpenRouter solo PHP legado
