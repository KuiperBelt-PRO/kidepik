# Spec: Shell móvil Capacitor (fase posterior)

> Estado: **borrador — no implementar hasta cerrar fase 1 web** (junio 2026)  
> Relacionado: [SPEC_WEB_FRONTEND_ARCHITECTURE.md](SPEC_WEB_FRONTEND_ARCHITECTURE.md)

## Objetivo

Documentar cómo el build web de KidepiK se empaqueta para **Google Play** y **App Store** mediante **Capacitor**, sin repetir lógica de producto en nativo.

## Alcance (cuando se active)

- `npx cap add android` / `ios` desde `web/` tras `pnpm build`.
- `capacitor.config.ts`: `webDir: 'dist'`, `server` solo en dev.
- Iconos y splash nativos generados desde assets de marca.
- Safe areas: `viewport-fit=cover` + env(`safe-area-inset-*`) en CSS.

## Excluido explícitamente (acordado: más adelante)

- Login biométrico.
- Push notifications.
- Background sync offline avanzado.
- Justificación de valor añadido para tiendas (documento aparte pre-submit).

## Criterios de éxito (futuro)

1. APK debug instala y muestra misma UI que `web/dist` en Electron preview.
2. POC arquitectura funciona con URLs LAN configurables en build.
3. Sin regresión visual vs preview 390×844.

## Dependencia

Requiere **fase 1 web** completada y aprobada visualmente ([SPEC_APP_VISUAL_DESIGN_V3.md](SPEC_APP_VISUAL_DESIGN_V3.md)).
