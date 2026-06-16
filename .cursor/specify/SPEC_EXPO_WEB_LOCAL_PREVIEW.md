# Spec: Expo Web — vista previa local (PC + agentes)

> Estado: **implementada** (junio 2026)  
> Relacionado: [SPEC_APP_VISUAL_DESIGN.md](SPEC_APP_VISUAL_DESIGN.md), [SPEC_POC_LOCAL_ARCHITECTURE.md](SPEC_POC_LOCAL_ARCHITECTURE.md)

## Objetivo

Permitir desarrollo y validación de la app Expo en **navegador local** (`http://localhost:8081`) para iteración rápida en PC y automatización por agentes Cursor (MCP browser / Playwright), complementando Expo Go en móvil físico.

## Decisiones

| # | Decisión |
| --- | --- |
| 1 | **Expo Web con Metro** (`expo start --web --port 8081`), no emulador como canal principal de agentes. |
| 2 | **`mobile/.env` con localhost** cuando se usa web; LAN solo vía `poc-expo-go.ps1`. |
| 3 | **Galería/UI sin Docker** por defecto; flag `-Backend` en script para POC arquitectura. |
| 4 | **Capturas de agentes** solo bajo `tmp/playwright-output/`. |
| 5 | **Smoke nativo** (Expo Go) sigue siendo recomendable antes de cerrar cambios visuales críticos. |

## Alcance

### Incluido

- Deps web: `react-native-web`, `react-dom`; config `web.bundler: metro` en `app.json`.
- Script `scripts/poc-expo-web.ps1`.
- Skill `.cursor/skills/expo-web-local-preview/SKILL.md` y regla homónima.
- Actualización de docs (`POC_LOCAL.md`, `PROJECT_OVERVIEW.md`) y browser testing.

### Excluido

- Maestro / Detox E2E nativo.
- Paridad pixel-perfect web vs Android/iOS.
- CI con Playwright (fase posterior).

## Criterios de aceptación

1. `./scripts/poc-expo-web.ps1` sirve la app en `http://localhost:8081` (loader → galería).
2. Agente puede `browser_navigate` + snapshot + captura PNG en `tmp/playwright-output/`.
3. `./scripts/poc-expo-web.ps1 -Backend` permite ejecutar pruebas POC arquitectura desde la galería.
4. `poc-expo-go.ps1` sigue funcionando para móvil físico sin regresión.

## Validación manual / agente

| Paso | Esperado |
| --- | --- |
| Arrancar web | Loader animado → galería de mockups |
| Toggle tema | Cambio fantasy / space opera |
| Abrir mockup | Pantalla mockup + botón volver |
| `-Backend` + POC | Tres checks verdes (API, Supabase, MinIO) |
