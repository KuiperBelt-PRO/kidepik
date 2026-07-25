# Plan: Limpieza dead code Loader / Auth / Legal

Spec: [SPEC_WEB_LOADER_AUTH_LEGAL_DEAD_CODE.md](../specify/SPEC_WEB_LOADER_AUTH_LEGAL_DEAD_CODE.md)

## Fases

### Fase 0 — Documentar (hecho)

- Inventario completo en la spec.
- Este plan por prioridades P0–P3.
- Enlace en `CURRENT_SPECS.md`.

### Fase 1 — P0 (esta entrega) — hecha

1. Eliminar exports muertos en `world-session.js` y `world-transition.js`.
2. Reducir `theme.js` a `initTheme` / `getThemeId` (+ scanlines).
3. Quitar alias `CRYSTAL_*` deprecados en `loader-fantasy-scene.js`.
4. Limpiar `AUTH_COPY.legal` y re-exports de `loader-gate.js`.
5. Manifest: quitar slots huérfanos; borrar PNGs dual/alt; dejar de montar accents inexistentes.
6. Podar `components.css` a scanlines genérico.
7. Quitar `.legal-body__title` huérfano.
8. Actualizar `sw.js` PRECACHE (v161).

### Fase 2 — P1 (esta entrega) — hecha

1. `#/auth` → `renderLoader()`; eliminado `scenes/auth.js`; callback OAuth falla → `#/loader`.
2. CSS auth-panel solo en `loader.css`; `auth.css` = callback + home.
3. Eliminado `loader-fx-fantasy-palette.js`; tests ajustados.
4. Extraído `loader-world-utils.js` (probe/mount/parse query) usado por chrome y world-layers.

### Fase 3 — P2 (posterior)

- API mínima de flechas legales.
- Módulo único de query params de desarrollo.
- Actualizar specs `SPEC_LOADER_SCREEN` / galería obsoleta.

### Fase 4 — P3 (posterior)

- Docs tooling (`poc-web-dev`, `serve`).
- Comentarios router mockup.

## Verificación

```powershell
cd web
pnpm test   # o: node --test tests/*.test.js
```

Playwright MCP contra `http://localhost:8082` (stack `./scripts/poc-up.ps1`):

1. Loader visible → tap → panel Google.
2. Enlace Términos → legal → FAB volver → auth embebido.
3. `#/auth` → acaba en loader.
4. Caso borde: legal sin red / reintentar (si API cae).

## No hacer en esta entrega

- PR automática.
- Borrar `backend/` FastAPI.
- Refactor masivo del motor fantasy.
