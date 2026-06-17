# Plan de ejecución: pivot web-first KidepiK

> Pivot completado (jun 2026). Specs: [SPEC_WEB_FRONTEND_ARCHITECTURE.md](../specify/SPEC_WEB_FRONTEND_ARCHITECTURE.md), [SPEC_APP_VISUAL_DESIGN_V3.md](../specify/SPEC_APP_VISUAL_DESIGN_V3.md), [SPEC_WEB_DEV_PREVIEW.md](../specify/SPEC_WEB_DEV_PREVIEW.md).

## Fase 0 — Aprobación (usuario)

- [x] OK HTML/CSS/JS sin framework.
- [x] OK sin Vite (servidor estático).
- [x] OK cliente en `web/` (sin Expo/RN).

## Fase 1 — Bootstrap `web/`

- [x] Estructura `web/` (index.html, css/, js/, assets/).
- [x] Tokens CSS fantasy / spaceOpera.
- [x] `js/lib/theme.js` + `data-theme` en `<html>`.
- [x] Router mínimo en `js/main.js` (hash).
- [x] `js/config.sample.js` + script genera `config.js`.
- [x] `web/package.json` + `serve` puerto **8082**.
- [x] `scripts/poc-web-dev.ps1`.

## Fase 2 — Preview tooling

- [x] `tools/preview-electron/` + `scripts/poc-web-preview.ps1`.
- [x] Regla `.cursor/rules/web-mobile-preview.mdc`.
- [x] Skill `.cursor/skills/web-mobile-preview/SKILL.md`.

## Fase 3 — Pantallas P0

- [x] Escena loader + capas ilustración (placeholder).
- [x] Galería + catálogo mockups.
- [x] Toggle tema.
- [ ] 2 fondos ilustrados por tema (assets reales).

## Fase 4 — Offline mínimo

- [x] `web/sw.js` + registro en `main.js`.
- [ ] Banner offline para API.

## Fase 5 — Paridad POC

- [x] Escena POC arquitectura (Supabase + API).
- [x] CORS FastAPI para `:8082`.
- [x] Actualizar `docs/POC_LOCAL.md`, README, `PROJECT_OVERVIEW.md`.

## Fase 6 — Limpieza

- [x] Eliminar `mobile/` (Expo) y artefactos Expo del repo.
- [x] Eliminar skills/reglas/scripts Expo.

## Fase 7 — Capacitor (posterior)

- [ ] [SPEC_CAPACITOR_MOBILE_SHELL.md](../specify/SPEC_CAPACITOR_MOBILE_SHELL.md).

## Validación final fase 1–5

- [x] App en `http://localhost:8082` sin errores consola (flujo feliz).
- [ ] Electron preview OK.
- [x] Playwright: loader + galería + toggle tema.
- [ ] Offline smoke tras cache.
