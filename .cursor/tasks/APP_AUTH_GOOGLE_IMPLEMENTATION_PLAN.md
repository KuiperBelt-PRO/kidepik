# Plan de ejecución: Auth Google + Supabase

> Spec: [SPEC_APP_AUTH_GOOGLE_IMPLEMENTATION.md](../specify/SPEC_APP_AUTH_GOOGLE_IMPLEMENTATION.md)  
> Spec producto: [SPEC_APP_AUTH.md](../specify/SPEC_APP_AUTH.md) (aprobada)

## Orden recomendado

### Bloque 0 — Prerrequisitos (humano / ops)

- [ ] Crear OAuth Client en Google Cloud Console (ver spec § A.1).
- [ ] Copiar `.secrets.sample/gcp-oauth.env.sample` → `.secrets/gcp-oauth.env`.
- [ ] Crear `supabase/.env` con `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.
- [ ] `./scripts/poc-up.ps1` — stack Docker + Supabase + `config.js`.

### Bloque 1 — Fase A (OAuth cliente)

| # | Tarea | Verificación |
| --- | --- | --- |
| 1.1 | Añadir `[auth.external.google]` en `supabase/config.toml` | ✅ |
| 1.2 | Endurecer `exchangeCodeFromUrl()` en `web/js/lib/supabase.js` | ✅ |
| 1.3 | Timeout 15 s en `auth-callback.js` | ✅ |
| 1.4 | Revisar estilos auth (loader.css + auth.css) vs spec visual | ✅ Playwright |

### Bloque 2 — Fase B (Bootstrap padre)

| # | Tarea | Verificación |
| --- | --- | --- |
| 2.1 | Migración `parent_accounts` | ✅ aplicada |
| 2.2 | `ParentsController` + `Router` | ✅ POST sin token → 401 |
| 2.3 | `web/js/lib/parent-account.js` + hook en callback | ✅ |
| 2.4 | Idempotencia bootstrap | ✅ PHPUnit mock |

### Bloque 3 — Fase C (Tests y cierre)

| # | Tarea | Verificación |
| --- | --- | --- |
| 3.1 | `api/tests/ParentsBootstrapTest.php` | ✅ 3/3 |
| 3.2 | Playwright flujos 1, 4, 5 (y 2 si OAuth configurado) | ✅ flujos 1 y 5; flujo 2 pendiente credenciales GCP |
| 3.3 | Config Supabase cloud (prod) | Pendiente deploy |
| 3.4 | Actualizar `CURRENT_SPECS.md` estado → implementada | ✅ |

## Estimación

| Bloque | Esfuerzo orientativo |
| --- | --- |
| 0 | 30–60 min (setup GCP + secretos) |
| 1 | 2–4 h |
| 2 | 3–5 h |
| 3 | 2–3 h |

## Dependencias

- Stack local: [SPEC_POC_DOCKER_LOCAL_DEV.md](../specify/SPEC_POC_DOCKER_LOCAL_DEV.md).
- Gate/morph loader: [SPEC_LOADER_APP_GATE.md](../specify/SPEC_LOADER_APP_GATE.md) (ya implementado).
- Validación navegador: skill [web-mobile-preview](../skills/web-mobile-preview/SKILL.md).

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `code` OAuth fuera del hash | `exchangeCodeFromUrl` lee search + hash (spec § A.6) |
| Google redirect mal configurado | Checklist redirect `localhost:54321/auth/v1/callback` |
| Bootstrap falla en prod sin `DATABASE_URL` | Health + architecture/status antes de cerrar deploy |
