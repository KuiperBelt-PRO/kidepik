# Spec: Preview de desarrollo web (Electron + Playwright móvil)

> Estado: **actualizada** (julio 2026) — URL única Docker `:8082`  
> Relacionado: [SPEC_WEB_FRONTEND_ARCHITECTURE.md](SPEC_WEB_FRONTEND_ARCHITECTURE.md), [SPEC_POC_DOCKER_LOCAL_DEV.md](SPEC_POC_DOCKER_LOCAL_DEV.md)

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
| 3 | URL por defecto: `http://localhost:8082` (nginx Docker — app + API PHP). Configurable por env. **Precondición:** `./scripts/poc-up.ps1` en verde. |
| 4 | Electron en `tools/preview-electron/` — paquete pnpm independiente. |
| 5 | Playwright: MCP `playwright` del hub con `viewport` fijo; capturas en `tmp/playwright-output/`. |
| 6 | No sustituye prueba en dispositivo real (Capacitor fase posterior). |

## Electron shell

### Comportamiento

- Ventana **no redimensionable** (390×844 + chrome mínimo) o área útil exacta 390×844.
- Carga URL del stack Docker (misma que el navegador en `:8082`).
- Recarga con `Ctrl+R` / `F5`.
- Título: `KidepiK Preview (390×844)`.
- `nodeIntegration: false`, `contextIsolation: true`.

### Scripts (objetivo)

```powershell
./scripts/poc-web-preview.ps1          # requiere poc-up; abre Electron contra :8082
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
| Loader | Wordmark + anillo; tras progreso, hint; tap → auth |
| Auth embebido | CTA Google + enlaces legales |
| Legal | `#/legal/terminos` o `#/legal/privacidad` carga markdown; FAB volver → loader/auth |
| `#/auth` | Misma escena que loader (no standalone) |

## Integración con arranque POC

1. `poc-up.ps1` — **obligatorio** (Supabase contenedores + Docker nginx/php; media en `web/media/`).
2. ~~`poc-web-dev.ps1`~~ — **deprecado** (stub → `poc-up`).
3. `poc-web-preview.ps1` — Electron contra `:8082` (arranca `poc-up` si el puerto está libre); `-Static` usa `serve` solo sin API.

## Criterios de aceptación

1. `pnpm install` en `tools/preview-electron/` + script raíz abre ventana 390×844.
2. Agente documenta: MCP, URL, viewport, pasos.
3. Captura PNG del flujo loader/auth/legal en `tmp/playwright-output/`.
4. Documentado en `docs/POC_LOCAL.md` / overview y skill `web-mobile-preview`.

## Excluido

- Empaquetado Electron para distribución.
- Playwright en CI (fase posterior).

## Aprobación

- [ ] Usuario aprueba viewport 390×844 como estándar.
- [ ] Usuario aprueba paquete Electron en `tools/preview-electron/`.
