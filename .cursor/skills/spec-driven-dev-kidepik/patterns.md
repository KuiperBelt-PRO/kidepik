# Patrones para SDD + TDD (kidepik)

Complemento local de [SKILL.md](SKILL.md). El **método** (fases, TDD, reglas) vive en `Vibe-Coding/.cursor/skills/spec-driven-dev/SKILL.md`; aquí solo convenciones acotadas a **kidepik**.

Patrones Python genéricos (herramientas, scripts): `Vibe-Coding/.cursor/skills/python-engineering/patterns.md`.

---

## Backend de producto (FastAPI POC)

```
backend/
  app/                # FastAPI routers + services + ai
  tests/              # pytest
docker/compose.yaml   # nginx + api (uvicorn)
web/media/            # media filesystem
```

Spec: [SPEC_FASTAPI_BACKEND_MIGRATION.md](../../specify/SPEC_FASTAPI_BACKEND_MIGRATION.md).

**Legado:** PHP DreamHost specs siguen documentando el stack anterior.

---

## Spec como contrato

- Contratos HTTP y storage: specs en `.cursor/specify/` + tests PHPUnit / Playwright.
- Índice vivo: [CURRENT_SPECS.md](../../CURRENT_SPECS.md).
- Antes de proponer: puerta de descubrimiento en [SKILL.md § Inventario documental](SKILL.md#inventario-documental--consultar-antes-de-proponer).
- Orientación rápida: [.cursor/diagrams/](../../diagrams/README.md) — actualizar al cerrar si cambió el flujo representado.

### Checklist rápido — nueva iniciativa

| Paso | Hecho cuando… |
| --- | --- |
| Leído CURRENT_SPECS + diagrama 14 | Sé si ya existe spec/diagrama del área |
| Buscado en `.cursor/specify/` por prefijo | No duplico `SPEC_APP_*` / `SPEC_LOADER_*` existente |
| Leído diagrama `0N-*.md` del área | El Mermaid coincide con lo que voy a proponer |
| Spec nueva o delta redactado | Contrato revisable antes de código |
| Aprobación del usuario | Solo entonces Fase 2+ |
| Al cerrar: spec + CURRENT_SPECS + diagrama | Documentación alineada con el código |
| Depuración con logs | Tras reproducir fallo, leí `web/logs/` del día (§ SKILL.md Logs en disco) |

---

## Logs en disco (`web/logs/`)

- **Ruta host:** `kidepik/web/logs/` — volumen Docker → `/var/www/html/logs`.
- **Formato:** JSONL por canal y día (`api-`, `ai-`, `compose-`, `client-`).
- **Spec:** [SPEC_APP_FILE_LOGGING.md](../../specify/SPEC_APP_FILE_LOGGING.md).
- **Activación local:** `LOG_TO_FILES=true` (default en POC); cliente vía `LOG_CLIENT_INGEST`.
- **Depuración IA / placement:** correlacionar `client` (504, clics) → `api` (duración) → `ai` (`llm_attempt`) → `compose` (`placement_compose_failed`).
- **CLI colas + cooldowns:** revisar logs `web/logs/ai-*.log` y panel debug AI.
- **No** commitear `*.log`; el agente debe **leer** estos ficheros (o los que adjunte el usuario) antes de diagnosticar fallos de producto.

---

### Mapa spec ↔ diagrama (atajos)

| Área de trabajo | Specs típicas | Diagrama(s) |
| --- | --- | --- |
| Stack / Docker / puerto | `SPEC_POC_*`, `SPEC_POC_DOCKER_*` | 01, 02, 03 |
| API PHP / Router | `SPEC_PHP_BACKEND_*` | 04 |
| Auth / tablas / migraciones | `SPEC_APP_AUTH*`, `SPEC_PHP_DB_*` | 05 |
| Cliente `web/` / módulos | `SPEC_WEB_FRONTEND_*` | 06 |
| Rutas hash / shell | `SPEC_APP_SHELL_*`, `SPEC_APP_SECTION_*` | 07 |
| Mundo dual / temas | `SPEC_WORLD_*` | 08 |
| Loader / gate / OAuth | `SPEC_LOADER_*`, `SPEC_APP_AUTH*` | 09 |
| Cuenta / crew / ajustes / legal | `SPEC_APP_*_SECTION`, `SPEC_LEGAL_*` | 10 |
| Play / examen / diálogo | `SPEC_APP_PLAY_*`, `SPEC_APP_ADVENTURE_*` | 11 |
| Media filesystem | `SPEC_MEDIA_*` | 12 |
| Tests / validación UI / **logs** | `SPEC_WEB_DEV_PREVIEW`, `SPEC_DEV_TEST_CI`, `SPEC_APP_FILE_LOGGING` | 13 |
| Playwright auth local (agentes) | `SPEC_DEV_LOCAL_AUTH_PLAYWRIGHT` | 13 |
| ¿Qué abrir primero? | — | 14 |
