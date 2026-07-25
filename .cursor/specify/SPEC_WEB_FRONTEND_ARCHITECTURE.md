# Spec: Arquitectura frontend web-first (KidepiK)

> Estado: **aprobada** (junio 2026)  
> Cliente de producto: **HTML/CSS/JS** en `web/`.  
> Relacionado: [SPEC_APP_VISUAL_DESIGN_V3.md](SPEC_APP_VISUAL_DESIGN_V3.md), [SPEC_WEB_DEV_PREVIEW.md](SPEC_WEB_DEV_PREVIEW.md), [SPEC_CAPACITOR_MOBILE_SHELL.md](SPEC_CAPACITOR_MOBILE_SHELL.md), [SPEC_POC_LOCAL_ARCHITECTURE.md](SPEC_POC_LOCAL_ARCHITECTURE.md), [docs/kidepik.md](../../docs/kidepik.md)

## Objetivo

Migrar el **cliente de producto** a una **aplicación web** en **HTML + CSS + JavaScript** (sin framework de UI), optimizada para **calidad visual premium** y **iteración rápida de diseño**, con:

1. **Desarrollo y pruebas** en navegador y shell Electron (viewport móvil fijo).
2. **Distribución móvil** vía **Capacitor** (Android/iOS) cuando corresponda — empaqueta los mismos ficheros estáticos.
3. **Backend (jul 2026):** API **PHP** en el mismo origen que `web/`; Supabase + R2/MinIO como fuente de datos y media. Ver [SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md](SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md).

## ¿Hace falta Vite (u otro bundler)?

**No, para KidepiK no es obligatorio.**

Vite (o Webpack, Parcel, etc.) son herramientas que suelen hacer tres cosas:

| Qué hace Vite | ¿Lo necesitamos? | Alternativa en este proyecto |
| --- | --- | --- |
| Servidor local con recarga al guardar | Útil, no imprescindible | **Docker nginx** en `:8082` con bind mount ([SPEC_POC_DOCKER_LOCAL_DEV.md](SPEC_POC_DOCKER_LOCAL_DEV.md)); F5 en el navegador |
| Unir muchos ficheros en uno (bundle) | No al inicio | Ficheros estáticos servidos tal cual; ES modules entre `<script type="module">` |
| Variables `import.meta.env` | No | `web/js/config.js` (copia de `config.sample.js`, gitignored en local) |
| PWA / Service Worker automático | Fase offline | `sw.js` manual o Workbox en fase posterior |

**La app es el contenido de `web/`:** HTML, CSS, JS y assets. Capacitor y Electron cargan esa misma URL o carpeta. No hay capa React ni compilación obligatoria.

Si en el futuro el número de módulos o el tamaño del JS lo exigen, se puede añadir un bundler **entonces** — no es decisión de arquitectura del MVP visual.

## Motivación (decisión de producto)

| Necesidad | Solución web-first |
| --- | --- |
| UI “programada” en código no alcanza look de estudio | Ilustración raster, capas HTML/CSS, Rive/Lottie, PixiJS cuando haga falta |
| Iteración visual rápida | Web estándar en cualquier navegador |
| Un solo cliente para web y tiendas (fase Capacitor) | HTML/CSS/JS en `web/` |

## Decisiones cerradas (pendientes de tu OK)

| # | Decisión |
| --- | --- |
| 1 | **Runtime UI:** HTML5 + CSS3 + **JavaScript ES modules** (sin React, Vue, Svelte). |
| 2 | **Sin bundler obligatorio** en fase 1; servidor estático HTTP para desarrollo. |
| 3 | **Estilos:** CSS con variables en `:root` / `[data-theme="fantasy\|spaceOpera"]`; un fichero por capa (tokens, layout, componentes). |
| 4 | **UI reusable:** Web Components ligeros (`<kidepik-dialogue>`, etc.) o módulos JS que montan DOM — a definir en implementación. |
| 5 | **Animación:** Rive (`.riv`) y/o Lottie (`.json`) vía sus runtimes JS; CSS solo para micro-transiciones. |
| 6 | **Minijuegos (post-MVP):** PixiJS o Phaser en `<canvas>` — misma página o escena dedicada. |
| 7 | **3D (post-MVP avatar):** Three.js solo si hace falta; fuera de fase 1. |
| 8 | **Cliente móvil tiendas:** Capacitor envolviendo `web/` — fase posterior. |
| 9 | **Auth:** `@supabase/supabase-js` desde CDN o `npm` en `web/package.json` solo para dependencias JS (Supabase, Rive, Lottie). |
| 10 | **Config:** `web/js/config.js` con `API_URL` (relativo `/api/v1` en mismo origen), `SUPABASE_URL`, `SUPABASE_ANON_KEY` (plantilla `config.sample.js`). |

### Incluido (fase 1 — tras aprobación)

- Carpeta `web/` con `index.html`, CSS, JS modular, temas fantasy / space opera.
- Stack Docker (`./scripts/poc-up.ps1`) → sirve `web/` + API PHP en **`http://localhost:8082`** (ver [SPEC_POC_DOCKER_LOCAL_DEV.md](SPEC_POC_DOCKER_LOCAL_DEV.md)).
- Preview Electron + Playwright ([SPEC_WEB_DEV_PREVIEW.md](SPEC_WEB_DEV_PREVIEW.md)).
- Offline mínimo (Service Worker en `web/sw.js`).

### Excluido (fases posteriores)

- Vite, React, TypeScript como requisito.
- Capacitor build en CI.
- Push, biométrico, políticas de tienda.
- PixiJS / Three.js en producción (solo spec).

## Estructura de repositorio (objetivo)

```
kidepik/
  web/
    index.html
    css/
      tokens.css
      layout.css
      components.css
      themes/
        fantasy.css
        space-opera.css
    js/
      main.js                 # entrada, router mínimo
      config.sample.js
      config.js               # local, no secretos reales en git
      lib/
        api.js
        supabase.js
        theme.js
        rive.js
        lottie.js
      scenes/
        loader.js
        legal.js
        home.js
        auth-callback.js
      components/             # factories DOM (loader-*, auth-panel, world-layers)
    assets/
      themes/
        fantasy/
        spaceOpera/
    sw.js                     # offline mínimo
    package.json              # solo deps JS (supabase, @rive-app/canvas, lottie-web)
  tools/
    preview-electron/
  api/                      # Backend PHP (mismo origen en prod)
  scripts/
    poc-up.ps1              # Docker: web + PHP + MinIO
    poc-web-preview.ps1
```

## Contratos con backend (API PHP)

| Origen web | Destino |
| --- | --- |
| `GET /api/v1/health` | Smoke |
| `GET /api/v1/architecture/*` | POC arquitectura |
| Supabase Auth + `poc_health` | POC datos |
| `POST /api/v1/storage/prepare-upload` | POC storage (driver local) |

**CORS:** Mínimo — cliente y API comparten origen (`localhost:8082` en Docker, dominio DreamHost en prod). Sin puerto API separado.

## Offline mínimo (fase 1)

| Capa | Comportamiento |
| --- | --- |
| **Assets** | `sw.js`: cache-first para `assets/`, CSS, JS, fuentes, `.riv`, Lottie JSON |
| **HTML** | network-first; fallback a cache tras primera visita |
| **API** | Sin cola offline; banner “sin conexión” |
| **Auth** | Supabase `localStorage` |

## Pantallas P0 (checklist)

| Pantalla / módulo | Prioridad |
| --- | --- |
| Tema dual (`data-theme`) | P0 |
| Loader + gate + auth embebido | P0 |
| Legal (términos / privacidad) | P0 |
| Selector de mundo / home | P1 |
| ~~Galería + mockups~~ | Eliminado (POC) |

## Criterios de éxito (fase 1)

1. `./scripts/poc-up.ps1` → app en `http://localhost:8082` (nginx Docker).
2. Loader → auth → legal; `#/auth` ≡ loader.
3. Electron preview 390×844 OK.
4. Playwright agente con viewport móvil + capturas en `tmp/playwright-output/`.
5. Tras primera carga online, galería visible offline (assets cacheados).
6. Sin errores en consola en flujo feliz.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| JS disperso sin estructura | Carpetas `scenes/`, `components/`, convenciones en patterns.md |
| `file://` no sirve para ES modules | Siempre HTTP local (script dev) |
| CORS backend | Mismo origen vía nginx; evitar API en puerto distinto |
| Tamaño muchos JS sueltos | Bundler opcional en fase 2 si hace falta |

## Aprobación

- [x] Usuario aprueba enfoque **HTML/CSS/JS** sin framework de UI.
- [x] Usuario prefiere **sin Vite** (servidor estático).
- [x] Cliente en `web/` implementado.
- [x] Implementación según [WEB_FRONTEND_PIVOT_EXECUTION_PLAN.md](../tasks/WEB_FRONTEND_PIVOT_EXECUTION_PLAN.md).
