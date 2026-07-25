# Spec: Pantalla Loader (splash de arranque)

> Estado: **implementada** (jun–jul 2026). Salida a producto: [SPEC_LOADER_APP_GATE.md](SPEC_LOADER_APP_GATE.md).  
> Relacionado: [SPEC_APP_VISUAL_DESIGN_V3.md](SPEC_APP_VISUAL_DESIGN_V3.md), [SPEC_WEB_FRONTEND_ARCHITECTURE.md](SPEC_WEB_FRONTEND_ARCHITECTURE.md), [LOADER_SCREEN_AI_PROMPTS.md](LOADER_SCREEN_AI_PROMPTS.md), [SPEC_WEB_LOADER_AUTH_LEGAL_DEAD_CODE.md](SPEC_WEB_LOADER_AUTH_LEGAL_DEAD_CODE.md)

## Contexto

La pantalla loader es el **primer contacto visual** con KidepiK: comunica la promesa de producto (aprendizaje gamificado, dos mundos) y termina en la **puerta de auth** (gate + morph), no en una galería de mockups.

> **Histórico:** el POC temprano usaba placeholder SVG + `navigate("/gallery")`. Esa galería **no existe** en `web/`; no reintroducir `#/gallery` ni `#/mockup/*`.

## Objetivo

Pantalla de carga **premium, muy visual**, que muestre **simultáneamente** los dos universos (fantasía abajo / space arriba en bandas procedurales), con logo ambigrama, anillo de progreso y eslogan — sin depender del tema elegido por el usuario para el contenido dual.

## Principios de diseño (vigentes)

| Principio | Decisión actual |
| --- | --- |
| Dual mundo visible | Capas procedurales + clip de bandas: **space** (órbita, meteoritos) y **fantasía** (terreno, cielo, elementos). Fondo raster `loader.bg.plain` |
| No es selector | Sin botones de mundo; preview de ambas ambientaciones |
| Arte | Fondo plano + motor procedural (ver specs `SPEC_LOADER_FANTASY_*` / meteor / space). Un diptico raster único **no** es el runtime actual |
| Logo | Wordmark ambigrama `loader.logo` (`wordmark-ambigram-light.png`) |
| Progreso | Anillo SVG bicolor + textos circulares «DOS MUNDOS» / «UN VIAJE ÉPICO»; ~4,5 s (`DURATION_MS`) |
| Accesibilidad | `prefers-reduced-motion`: progreso y revelado colapsados |
| Público | Niños 7–9 y padres; viewport canónico 390×844 |

## Logo — ambigrama KidepiK

- Palabra: **KidepiK**; e central con simetría 180° (ver [docs/kidepik.md](../../docs/kidepik.md) §2).
- **Runtime:** solo variante light sobre fondo oscuro (`web/assets/shared/logo/wordmark-ambigram-light.png`).
- Variante dark / WebP dual: prompts históricos en [LOADER_SCREEN_AI_PROMPTS.md](LOADER_SCREEN_AI_PROMPTS.md); **no** están en el manifest de runtime.

## Copy (español)

| Elemento | Texto |
| --- | --- |
| **Eslogan** | «Dos mundos. Un viaje épico.» (en anillo → dos líneas en auth) |
| **Hint gate** | Ver [SPEC_LOADER_APP_GATE.md](SPEC_LOADER_APP_GATE.md) («Pulsa para comenzar» / «tu viaje épico») |

## Comportamiento

| Requisito | Detalle |
| --- | --- |
| **Entrada** | `#/loader` (default) |
| **Progreso** | 0→100 % en ~4,5 s; `gateDemo=1` acelera (~800 ms). Ver flags en `loader-world-utils.js` |
| **Salida** | Gate → morph auth embebido o `#/home` si hay sesión ([SPEC_LOADER_APP_GATE.md](SPEC_LOADER_APP_GATE.md)) |
| **Tema `data-theme`** | Se inicializa (`initTheme`); el loader dual no es un toggle de mundo |
| **Assets** | `web/js/lib/assets.manifest.js` — slots activos: `loader.bg.plain`, `loader.logo` |
| **Offline** | Precache SW de fondo + logo + CSS/JS núcleo |

## Assets en runtime (manifest)

| ID | Ruta | Notas |
| --- | --- | --- |
| `loader.bg.plain` | `web/assets/shared/screens/loader-bg-plain.png` | Fondo base |
| `loader.logo` | `web/assets/shared/logo/wordmark-ambigram-light.png` | Ambigrama |

Slots retirados del runtime (dead code jul 2026): `loader.bg.dual`, `loader.logo.alt`, `loader.particles.*`, `loader.ring`, accents webp inexistentes.

## Implementación (código)

| Fichero | Rol |
| --- | --- |
| `web/js/scenes/loader.js` | Escena → `mountLoaderChrome` |
| `web/js/components/loader-chrome.js` | Capas, anillo, revelado, gate, resume legal→auth |
| `web/js/components/loader-world-utils.js` | Query params de depuración + helpers de montaje |
| `web/css/scenes/loader.css` | Estilos escena + auth embebido |
| Specs hijas | Fantasy engine, FX, meteoritos, etc. |

## Criterios de aceptación

1. Viewport **390×844**: logo legible; anillo y hint visibles.
2. Se perciben **ambos mundos** (bandas space / fantasía) sin leer texto.
3. Progreso fluido; al completar → gate → auth o home (no galería).
4. `prefers-reduced-motion` no rompe el flujo.
5. Playwright: capturas bajo `tmp/playwright-output/`.

### Capa orbital — naves procedurales

- Siluetas hard sci-fi (`loader-ship-procedural.js`); tests en `web/tests/loader-ship-procedural.test.js`.

## Fuera de alcance

- Selección de mundo (spec futura).
- Rive del anillo (fase posterior si hay asset).
- Galería de mockups (eliminada del cliente).

## Prompts IA

Ver [LOADER_SCREEN_AI_PROMPTS.md](LOADER_SCREEN_AI_PROMPTS.md) — archivo de prompts / checklist de arte; varios assets listados allí **no** están cableados en runtime.

## Aprobación

- [x] Composición dual + copy.
- [x] Implementación en `web/` con motor procedural.
- [x] Salida vía gate/auth ([SPEC_LOADER_APP_GATE.md](SPEC_LOADER_APP_GATE.md)).
