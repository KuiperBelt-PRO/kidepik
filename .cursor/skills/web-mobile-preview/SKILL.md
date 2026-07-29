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

## Arranque (canónico)

```powershell
cd kidepik
./scripts/poc-up.ps1              # Docker nginx + PHP + web → :8082
./scripts/poc-web-preview.ps1     # Electron 390×844 (usa :8082 si ya está arriba)
```

**Arranque canónico:** `./scripts/poc-up.ps1`.  
**Opcional estático (sin API):** `./scripts/poc-web-preview.ps1 -Static` (`pnpm exec serve` en `web/`).

## Playwright (agente)

- URL: `http://localhost:8082`
- Viewport: **390 × 844**
- Capturas: `tmp/playwright-output/`
- Flujos mínimos: loader → tap → auth → legal (términos/privacidad) → volver; `#/auth` ≡ loader

## Stack

- Sin React/Vite — ES modules servidos por **Docker nginx** (`poc-up.ps1`)
- Config: `web/js/config.js` (generado por `poc-write-config` / `poc-up`)
- Query params de depuración del loader: ver JSDoc de `parseWorldLayerQuery` en `web/js/components/loader-world-utils.js`
