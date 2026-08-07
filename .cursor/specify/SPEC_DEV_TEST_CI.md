# Spec: CI, cobertura y suites de test

**Estado:** implementada jul 2026; actualizada ago 2026 (pytest FastAPI).

## Objetivo

Garantizar regresión en API FastAPI, lógica JS testable y flujos UI críticos mientras el producto crece.

## Suites

| Suite | Herramienta | Umbral líneas | Alcance |
| --- | --- | --- | --- |
| API FastAPI | pytest + pytest-asyncio + httpx + respx | **≥ 55%** (objetivo 85% — ver SPEC_DEV_FASTAPI_PYTEST) | `backend/app/**` |
| JS unit | Node `node:test` + c8 | **≥ 90%** | `web/js/lib/**`, `web/js/components/**` importados por tests; excluye runtime DOM pesado (ver `web/.c8rc.json`) |
| E2E API + humo | `@playwright/test` (390×844) | contratos API + status | `web/e2e/smoke.spec.js` |
| E2E autenticado | `@playwright/test` + storageState | UI post-login local | `web/e2e/authenticated-*.spec.js` + [SPEC_DEV_LOCAL_AUTH_PLAYWRIGHT.md](SPEC_DEV_LOCAL_AUTH_PLAYWRIGHT.md) |

## Comandos

```powershell
./scripts/poc-up.ps1
./scripts/e2e-auth-setup.ps1   # opcional: precalienta web/e2e/.auth/tutor.json
./scripts/test-all.ps1
```

Por suite:

```powershell
docker compose --env-file .env.poc -f docker/compose.yaml exec api pytest -q --cov=app --cov-report=term-missing --cov-fail-under=55
cd web && npm run test:coverage
cd web && npm run test:e2e
```

## CI

GitHub Actions: `.github/workflows/ci.yml` — Supabase local + Docker + tres suites.

## Exclusiones de cobertura JS (E2E / runtime visual)

Documentadas en `web/.c8rc.json`: render DOM del loader (`loader-fx-render`, `loader-fantasy-render`, `loader-fantasy-scene`, space orbit/ships/layout, gate/chrome/auth-morph), glue shell (`router`, `supabase`, navegación shell), `world-layers`.
