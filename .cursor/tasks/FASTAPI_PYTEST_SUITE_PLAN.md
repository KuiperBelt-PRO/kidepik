# Plan: Suite pytest FastAPI

> Estado: fases 0–3 cerradas; fase 4 parcial (fail_under **55 %**, objetivo 85 %).

## Hecho

- [x] Fase 0 — `conftest.py`, markers, deps, layout `unit/` / `contract/` / `integration/`
- [x] Fase 1 — contract `parents`, `settings`, `crew` (`tests/contract/test_*_routes.py`)
- [x] Fase 2 — contract `play`, `debug_ai`, `storage`, `architecture`, `legal`
- [x] Fase 3 — `tests/integration/test_live_stack.py` (opt-in `KIDEPIK_INTEGRATION_TESTS=1`)
- [x] CI + `test-all.ps1` con `--cov-fail-under=55`
- [x] Unit `DialogueService` — `tests/unit/test_dialogue_service.py` (~49 tests, `dialogue.py` ~69 %)

## Pendiente (cobertura 85 %)

- [ ] Más fases de `DialogueService`: `_start_placement`, `_finish_placement`, `_path_challenge_answer` OK, `_maybe_write_session_summary`
- [ ] Tests de `CrewService` / `ParentAccountService` con sesión async mockeada (o integración DB)
- [ ] Subir `fail_under` progresivamente: **70 → 85**

## Comandos

```powershell
docker compose --env-file .env.poc -f docker/compose.yaml exec api pytest -q --cov=app --cov-fail-under=55
docker compose ... exec api pytest -q -m integration  # con KIDEPIK_INTEGRATION_TESTS=1 en el contenedor
```
