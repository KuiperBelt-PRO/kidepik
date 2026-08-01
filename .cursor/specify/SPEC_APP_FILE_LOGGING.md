# Spec: logs de aplicación en disco (local / debug)

> Estado: **implementada** (1 ago 2026)  
> Relaciona: [SPEC_APP_DEBUG_MODE.md](SPEC_APP_DEBUG_MODE.md), [SPEC_POC_DOCKER_LOCAL_DEV.md](SPEC_POC_DOCKER_LOCAL_DEV.md), [SPEC_DEV_TEST_CI.md](SPEC_DEV_TEST_CI.md)

## Objetivo

Persistir logs JSONL en `web/logs/` (accesible desde el host y el contenedor PHP) para diagnosticar fallos de IA, compose y API sin depender solo de `docker logs`.

## Ubicación

| Entorno | Ruta en host | Ruta en contenedor PHP |
| --- | --- | --- |
| POC Docker | `kidepik/web/logs/` | `/var/www/html/logs` |

**No versionar** contenido (`web/logs/*` en `.gitignore`; solo `.gitkeep`).

## Formato

Una línea JSON por evento (JSONL):

```json
{"ts":"2026-08-01T10:00:00.000000Z","level":"warning","channel":"compose","message":"placement_compose_failed","context":{...},"env":"local","debug_ai":true}
```

Archivos: `{channel}-{YYYY-MM-DD}.log` (p. ej. `api-2026-08-01.log`, `ai-2026-08-01.log`, `compose-2026-08-01.log`).

## Niveles

`debug` < `info` < `notice` < `warning` < `error`

| Variable | Default local | Default prod |
| --- | --- | --- |
| `LOG_LEVEL` | `info` | `warning` |
| `LOG_TO_FILES` | `true` | `false` |
| `LOG_DIR` | `/var/www/html/logs` | igual |

Con `APP_DEBUG_AI=true` en entornos permitidos, los canales `api`, `ai`, `compose` y `client` bajan el umbral efectivo a **debug** (más detalle en intentos LLM, requests y acciones UI).

## Canales

| Canal | Contenido |
| --- | --- |
| `api` | Cada request HTTP (method, path, status, duration_ms) |
| `ai` | Intentos LLM (modelo, ok/fail, latencia, cola) |
| `compose` | Fallos de placement compose (`compose_debug` completo) |
| `client` | Acciones del cliente web (navegación, errores JS, fallos API, clics en debug) |

## Cliente web → disco

El front **no escribe** directamente al filesystem; envía lotes a `POST /api/v1/client/logs` (sin auth obligatoria en local; con JWT se adjunta `auth_user_id`).

| Campo architecture/config | Uso |
| --- | --- |
| `client_logging` | Si `true`, el módulo `app-logger.js` activa la cola |
| `client_log_level` | Umbral mínimo (`info` o `debug` con `APP_DEBUG_AI`) |

Variables:

| Variable | Default local | Default prod |
| --- | --- | --- |
| `LOG_CLIENT_INGEST` | `true` | `false` |

Eventos típicos en `client-*.log`: `route_change`, `api_call`, `window_error`, `ui_click` (solo debug).

## Seguridad

- No se registran tokens JWT, API keys ni contraseñas (`[redacted]`).
- Strings largos truncados; arrays grandes acotados en contexto.

## Implementación

- `shared/Logging/AppLogger.php`, `LogLevel.php`
- Integración: `api/public/index.php`, `AiGateway`, `PlacementExamComposer`, `DialogueService`, `ClientLogController`, `web/js/lib/app-logger.js`
- Docker: volumen `../web/logs:/var/www/html/logs`

## Consulta rápida

```powershell
Get-Content web\logs\compose-2026-08-01.log -Tail 20
Get-Content web\logs\ai-2026-08-01.log -Tail 30
Get-Content web\logs\client-2026-08-01.log -Tail 30
```

Tras fallo de prueba, buscar `placement_compose_failed` en `compose-*.log` y `llm_attempt` en `ai-*.log`.
