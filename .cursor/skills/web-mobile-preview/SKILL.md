---
name: web-mobile-preview
description: >-
  Arranca y valida el cliente web KidepiK (HTML/CSS/JS) en localhost:8082 con
  viewport movil 390x844, Electron preview y MCP Playwright. Activar para
  cambios en web/, scripts poc-web-* o tools/preview-electron.
---

# Preview web móvil — KidepiK

## Cuándo usar

- Cambios en `web/` (UI, temas, escenas, SW).
- Validación agente o humana del cliente producto.
- Sustituye el antiguo flujo Expo para desarrollo de producto.

## Arranque

```powershell
cd kidepik
./scripts/poc-web-dev.ps1           # galería/UI
./scripts/poc-web-dev.ps1 -Backend  # + POC arquitectura
./scripts/poc-web-preview.ps1       # Electron 390×844
```

## Playwright (agente)

- URL: `http://localhost:8082`
- Viewport: **390 × 844**
- Capturas: `tmp/playwright-output/`
- Flujos mínimos: loader → galería; toggle fantasía/espacio; un mockup

## Stack

- Sin React/Vite — ES modules + `serve` vía `pnpm dev` en `web/`
- Config: `web/js/config.js` (generado por script desde sample + Supabase status)
