# Plan: Suite pytest FastAPI

> Estado: **fases 0–4 cerradas** — `fail_under` **85 %** en CI y `pyproject.toml` (ago 2026).

## Hecho

- [x] Fase 0 — `conftest.py`, markers, deps, layout `unit/` / `contract/` / `integration/`
- [x] Fase 1 — contract `parents`, `settings`, `crew` (`tests/contract/test_*_routes.py`)
- [x] Fase 2 — contract `play`, `debug_ai`, `storage`, `architecture`, `legal`, `client_logs`
- [x] Fase 3 — `tests/integration/test_live_stack.py` (opt-in `KIDEPIK_INTEGRATION_TESTS=1`)
- [x] Fase 4 — cobertura global **≥ 85 %** (~333 tests); CI + `test-all.ps1` con `--cov-fail-under=85`
- [x] Unit servicios: `crew`, `parents`, `placement`, `dialogue`, `journey_*`, `ai/*`, `config`, `text_utils`, etc.

## Comandos

```powershell
docker compose --env-file .env.poc -f docker/compose.yaml exec api pytest -q --cov=app --cov-fail-under=85
docker compose ... exec api pytest -q -m integration  # con KIDEPIK_INTEGRATION_TESTS=1 en el contenedor
```
