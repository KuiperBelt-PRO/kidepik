---
name: spec-driven-dev-kidepik
description: >-
  SDD + TDD en el repositorio kidepik (producto Kuiper Belt). Usar cuando el
  cambio sea código de este repo y se pida especificación, tests primero o
  feature con cobertura. Delega el método en la skill genérica spec-driven-dev
  del hub Vibe-Coding; esta skill solo acota ámbito y convenciones de kidepik.
---

# SDD + TDD para kidepik

## Autoridad metodológica (leer primero)

El **método completo** — cuándo usar o no, conceptos SDD/TDD, fases 1–5, ciclo Red-Green-Refactor, reglas críticas, TDD sin spec formal, escalado de specs y validación en navegador — está en:

**`Vibe-Coding/.cursor/skills/spec-driven-dev/SKILL.md`**

Activa **esta** skill cuando el trabajo sea en **kidepik**; a continuación **lee y aplica** la skill del hub. No improvises un flujo paralelo ni dupliques sus pasos aquí.

Esta skill **no sustituye** a `spec-driven-dev` ni a las skills SDD de otros repos (`spec-driven-dev-pda`, `spec-driven-dev-kuiper`, `spec-driven-dev-kuiper-auto`, `spec-driven-dev-misc`).

---

## Ámbito del repositorio

- Código bajo **kidepik**: `backend/` (FastAPI), `mobile/` (Expo), `supabase/`, `docker/`, scripts `scripts/poc-*.ps1`.
- Specs formales en [.cursor/specify/](../../specify/) y enlazadas desde [CURRENT_SPECS.md](../../CURRENT_SPECS.md).
- Fases del repo documentadas en [.cursor/SDD.md](../../SDD.md) (Specify → Plan → Task → Implement → Validate).
- Respeta versiones en `backend/pyproject.toml`, `mobile/package.json` y manifiestos del stack POC.

---

## Cuándo usar (además de los criterios del hub)

- Implementar o extender el **POC local** (FastAPI + Supabase CLI + MinIO + Expo Go).
- Añadir rutas API, auth JWT Supabase, storage S3-compatible, migraciones SQL o pantallas móvil con contrato en spec.
- El usuario pide SDD/TDD y el cambio vive claramente en este repo.

## Cuándo NO usar

- Los casos del hub (`spec-driven-dev` § Cuándo NO usar) aplican igual.
- Infra OCI / hosting sin lógica testeable → skill [oci-mcp-ops](../oci-mcp-ops/SKILL.md) u operaciones, no SDD de producto.
- Code review sin implementación → `Vibe-Coding/.cursor/skills/code-review/SKILL.md`.

---

## Contexto de stack (lectura rápida)

| Capa | Tecnología | Código típico |
| --- | --- | --- |
| API | FastAPI, Pydantic, pytest | `backend/app/`, `backend/tests/` |
| Datos / auth | Supabase (Postgres, Auth, PostgREST) | `supabase/migrations/`, `supabase/config.toml` |
| Object storage (POC) | MinIO (S3-compatible) | `docker/compose.yaml`, `backend/app/storage.py` |
| Cliente móvil | Expo SDK 54, React Native | `mobile/` |
| Orquestación local | Docker Compose + Supabase CLI | `docker/compose.yaml`, `scripts/poc-up.ps1` |

**Spec de referencia del POC:** [.cursor/specify/SPEC_POC_LOCAL_ARCHITECTURE.md](../../specify/SPEC_POC_LOCAL_ARCHITECTURE.md).  
**URLs y arranque local:** [.cursor/plan/PROJECT_OVERVIEW.md](../../plan/PROJECT_OVERVIEW.md), [docs/POC_LOCAL.md](../../../docs/POC_LOCAL.md).

---

## Ajustes kidepik por fase (sobre el flujo del hub)

Tras leer cada fase en `spec-driven-dev`, aplica estos matices:

### Fase 1 — Especificar

- Features que cambien contratos HTTP, auth, storage o flujos móvil: spec en `.cursor/specify/` (o resumen estructurado en chat si el cambio es pequeño).
- Seguir [.cursor/SDD.md](../../SDD.md): no implementar producto funcional sin spec acordada cuando el cambio sea relevante.

### Fase 2 — Planificar

| Superficie | Tests / código |
| --- | --- |
| API | `backend/tests/test_*.py` junto a `backend/app/` |
| SQL | Nueva migración en `supabase/migrations/` con nombre timestamp |
| Móvil | `mobile/` — si no hay suite automatizada, definir criterios reproducibles en la spec (pantalla POC, llamadas a API) |
| Compose / env | Cambios en `docker/compose.yaml`, `.env.poc.sample` — documentar impacto en `docs/POC_LOCAL.md` si afecta al arranque |

Estructura backend actual: paquete `app/` bajo `backend/`, tests en `backend/tests/` (ver [patterns.md](patterns.md#estructura-de-archivos)).

### Fase 3 — Test First

**Backend (pytest):** desde `backend/`, con dependencias dev instaladas:

```powershell
cd backend
python -m pytest tests/test_modulo.py::test_nombre -x
python -m pytest tests/
```

- Usar `httpx` / `TestClient` de FastAPI para rutas HTTP; `pytest-asyncio` ya configurado (`asyncio_mode = auto` en `pyproject.toml`).
- Para integración con Postgres/MinIO en POC: levantar stack con `./scripts/poc-up.ps1` o mockear según la spec (preferir mocks en tests unitarios; reservar integración para casos explícitos).

**Supabase:** validar migraciones con `supabase db reset` / stack local antes de dar por cerrada la fase.

**Móvil:** si no hay Jest/Detox en el repo, la “prueba” de la fase 3 puede ser el checklist de la spec ejecutado en Expo Go; la fase 4 confirma en dispositivo o emulador.

### Fase 4 — Validar cobertura y superficie observable

1. Cruzar requisitos de spec ↔ tests (tabla del hub y [patterns.md](patterns.md#checklist-de-cruce-spec-tests)).
2. **API:** `GET http://localhost:8080/health` y rutas de la spec con stack levantado.
3. **UI / demos:** reglas en [cursor-browser-mcp-testing.mdc](../../rules/cursor-browser-mcp-testing.mdc) y canónica `Vibe-Coding/.cursor/rules/cursor-browser-mcp-testing-ide.mdc`. **Preferir Expo Web** (`./scripts/poc-expo-web.ps1` → `http://localhost:8081`) vía skill [expo-web-local-preview](../expo-web-local-preview/SKILL.md). Capturas solo bajo `tmp/playwright-output/`.
4. **Móvil nativo:** `./scripts/poc-expo-go.ps1` (QR en `tmp/expo-go-qr.png`); URLs LAN vs emulador (`10.0.2.2`) según [PROJECT_OVERVIEW.md](../../plan/PROJECT_OVERVIEW.md).

### Fase 5 — Cerrar

- Actualizar [CURRENT_SPECS.md](../../CURRENT_SPECS.md) si cambia comportamiento o contratos.
- Linter/type checker del backend si está configurado; suite `pytest` del módulo tocado.
- Resumen al usuario según la skill del hub (implementación, tests, cobertura de spec, validación navegador/móvil).

---

## Referencias

| Tema | Dónde |
| --- | --- |
| Método SDD + TDD (canónico) | `Vibe-Coding/.cursor/skills/spec-driven-dev/SKILL.md` |
| Patrones pytest / estructura en este repo | [patterns.md](patterns.md) |
| Buenas prácticas Python (hub) | `Vibe-Coding/.cursor/skills/python-engineering/SKILL.md` |
| Docker Compose local | `Vibe-Coding/.cursor/skills/docker-compose-operations/SKILL.md` |
| OCI / Always Free | [oci-mcp-ops/SKILL.md](../oci-mcp-ops/SKILL.md) |
| Git commit / push | `Vibe-Coding/.cursor/skills/git-workflow/SKILL.md` |
