# Spec: Preview de desarrollo web (Electron + Playwright móvil)

> Estado: **borrador para aprobación** (junio 2026)  
> Relacionado: [SPEC_WEB_FRONTEND_ARCHITECTURE.md](SPEC_WEB_FRONTEND_ARCHITECTURE.md)

## Objetivo

Estandarizar cómo **desarrolladores y agentes Cursor** previsualizan KidepiK **siempre en formato móvil** durante el desarrollo web, sin depender de Expo Go ni de redimensionar el navegador a mano.

Dos canales complementarios:

| Canal | Usuario | Uso |
| --- | --- | --- |
| **Electron shell** | Humano en PC | Ventana fija tipo teléfono, `pnpm` local |
| **Playwright (MCP)** | Agente Cursor | Automatización con viewport móvil forzado |

## Decisiones

| # | Decisión |
| --- | --- |
| 1 | Viewport canónico dev: **390 × 844** (iPhone 14 logical; relación ~19.5:9). |
| 2 | Viewport alternativo documentado: **360 × 780** (Android medio) — solo para smoke opcional. |
| 3 | URL por defecto: `http://localhost:8082` (servidor estático de `web/`). Configurable por env. |
| 4 | Electron en `tools/preview-electron/` — paquete pnpm independiente. |
| 5 | Playwright: MCP `playwright` del hub con `viewport` fijo; capturas en `tmp/playwright-output/`. |
| 6 | No sustituye prueba en dispositivo real (Capacitor fase posterior). |

## Electron shell

### Comportamiento

- Ventana **no redimensionable** (390×844 + chrome mínimo) o área útil exacta 390×844.
- Carga URL del servidor estático (misma que el navegador).
- Recarga con `Ctrl+R` / `F5`.
- Título: `KidepiK Preview (390×844)`.
- `nodeIntegration: false`, `contextIsolation: true`.

### Scripts (objetivo)

```powershell
./scripts/poc-web-preview.ps1          # arranca serve si no está + Electron
```

### Variables

| Variable | Default |
| --- | --- |
| `KIDEPIK_PREVIEW_URL` | `http://localhost:8082` |
| `KIDEPIK_PREVIEW_WIDTH` | `390` |
| `KIDEPIK_PREVIEW_HEIGHT` | `844` |

## Playwright (agentes)

### Regla Cursor

Nueva regla `.cursor/rules/web-mobile-preview.mdc`:

- Validación UI de `web/` con MCP **playwright** o **cursor-ide-browser**, viewport **390×844**.
- Capturas solo en `kidepik/tmp/playwright-output/`.

### Casos mínimos agente

| Flujo | Esperado |
| --- | --- |
| Loader | Wordmark + animación visible; tap salta |
| Galería | Toggle tema cambia `data-theme` en `<html>` |
| Mockup diálogo | Panel + texto legible |
| Sin backend | Galería carga sin error en consola |

## Integración con `poc-web-dev.ps1`

1. `poc-up.ps1` — solo si se prueba POC arquitectura.
2. `poc-web-dev.ps1` — sirve carpeta `web/` en **8082**.
3. `poc-web-preview.ps1` — Electron, o agente Playwright contra 8082.

## Criterios de aceptación

1. `pnpm install` en `tools/preview-electron/` + script raíz abre ventana 390×844.
2. Agente documenta: MCP, URL, viewport, pasos.
3. Captura PNG de galería en `tmp/playwright-output/`.
4. Documentado en `docs/POC_LOCAL.md` y README.

## Excluido

- Empaquetado Electron para distribución.
- Playwright en CI (fase posterior).

## Aprobación

- [ ] Usuario aprueba viewport 390×844 como estándar.
- [ ] Usuario aprueba paquete Electron en `tools/preview-electron/`.
