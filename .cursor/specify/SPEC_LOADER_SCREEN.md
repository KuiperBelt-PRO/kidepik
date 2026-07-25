# Spec: Pantalla Loader (splash de arranque)

> Estado: **aprobada e implementada** (junio 2026); salida a producto supersedida por [SPEC_LOADER_APP_GATE.md](SPEC_LOADER_APP_GATE.md) (jul 2026).  
> Relacionado: [SPEC_APP_VISUAL_DESIGN_V3.md](SPEC_APP_VISUAL_DESIGN_V3.md), [SPEC_WEB_FRONTEND_ARCHITECTURE.md](SPEC_WEB_FRONTEND_ARCHITECTURE.md), [LOADER_SCREEN_AI_PROMPTS.md](LOADER_SCREEN_AI_PROMPTS.md), [docs/kidepik.md](../../docs/kidepik.md) §2  
> Limpieza dead code / rutas: [SPEC_WEB_LOADER_AUTH_LEGAL_DEAD_CODE.md](SPEC_WEB_LOADER_AUTH_LEGAL_DEAD_CODE.md)

## Contexto

La pantalla loader es el **primer contacto visual** con KidepiK: comunica la promesa de producto (aprendizaje gamificado, dos mundos) y termina en la **puerta de auth** (gate), no en una galería de mockups.

> **Histórico:** una versión temprana del POC usaba placeholder SVG + `navigate("/gallery")`. Esa galería **ya no existe** en `web/`; no reintroducir `#/gallery` ni `#/mockup/*`.

## Objetivo

Pantalla de carga **premium, muy visual**, que muestre **simultáneamente** los dos universos (Fantasía y Space Opera), con logo, progreso, motion y eslogan — sin depender del tema ya elegido por el usuario.

## Principios de diseño

| Principio | Decisión |
| --- | --- |
| Dual mundo visible | Composición **diptico vertical** (mitad superior fantasía, mitad inferior space opera) con **frontera luminosa** central donde vive el logo |
| No es selector | No hay botones de mundo aquí; solo **preview** de ambas ambientaciones |
| Arte raster | Fondo hero ilustrado (`loader-bg-dual.webp`); sin SVG procedural como destino final |
| Logo | Wordmark **ambigrama** `KidepiK` (asset raster o SVG); ver § Logo |
| Progreso | Barra o anillo **bicolor** (verde/dorado ↔ azul/blanco) sincronizado con carga real + mínimo de tiempo |
| Motion | CSS + Lottie opcional (partículas); Rive en fase 2 si hay asset |
| Accesibilidad | `prefers-reduced-motion`: progreso estático, sin partículas |
| Público | Niños 7–9 y padres; texto legible en 390×844 |

## Composición (wire ASCII)

```
┌─────────────────────────────┐
│  [Fantasy illustration]     │  ← bosque encantado, runas, dorado/verde
│         ·  ✦  ·             │
├ ─ ─ ─ ─ ✦ LOGO ✦ ─ ─ ─ ─ ─ ┤  ← franja central ~22% altura, logo + glow
│  [Space illustration]       │  ← nebulosa, estrellas, azul/blanco
│         ·  ★  ·             │
├─────────────────────────────┤
│  ████████░░░░  72%          │  ← barra progreso bicolor
│  «Dos mundos. Un viaje      │  ← eslogan fijo (display)
│     épico.»                  │
│  Despertando las runas…      │  ← frase rotatoria (status)
│  Toca para continuar         │  ← hint tras 1,5 s o 30% progreso
└─────────────────────────────┘
```

## Logo — ambigrama KidepiK

Requisitos tipográficos (marca):

- Palabra: **KidepiK** (K mayúscula, i minúscula, d, e, p, i, K).
- **e central**: simetría rotacional 180° — se lee igual al derecho y al revés.
- **i y K finales**: diseñadas como par ambigráfico para que, al **invertir la imagen 180°**, sigan leyendo como `i` + `K` finales (y el conjunto mantenga legibilidad de marca).
- **d y p**: intercambio visual al rotar 180° (coherente con [docs/kidepik.md](../../docs/kidepik.md) §2).
- Estilo: limpio, premium, sin mascotas ni personajes dentro del wordmark.
- Variantes de entrega: `wordmark-ambigram-light.webp` (sobre oscuro), `wordmark-ambigram-dark.webp` (sobre claro), opcional SVG.

## Copy (español)

| Elemento | Texto |
| --- | --- |
| **Eslogan principal** | «Dos mundos. Un viaje épico.» |
| **Eslogan alternativo** (A/B futuro) | «Aprende jugando. Elige tu universo.» |
| **Frases de estado** (rotación 2,5 s) | Ver tabla § Frases rotatorias |
| **Hint skip** | «Toca para continuar» (visible tras delay o progreso > 25%) |

### Frases rotatorias

Mezcla **ambos mundos** en una misma secuencia (no dependen de `localStorage`):

1. «Despertando reinos de luz verde…»
2. «Calibrando rutas entre estrellas…»
3. «Las runas y las nebulosas conspiran…»
4. «Preparando tu aventura…»
5. «Casi listo, explorador…»

## Comportamiento

| Requisito | Detalle |
| --- | --- |
| **Entrada** | Ruta `#/loader` (default al abrir app) |
| **Progreso** | Simulado 0→100% en **3,5–4,5 s** con easing; opcional: avanzar más rápido si `GET /health` responde antes |
| **Salida** | Tras 100 % + gate: morph a auth embebido (ver [SPEC_LOADER_APP_GATE.md](SPEC_LOADER_APP_GATE.md)). **No** `navigate("/gallery")` (ruta eliminada). |
| **Skip** | Tap en cualquier parte del contenido tras 1,5 s o progreso ≥ 25% |
| **Tema `data-theme`** | Loader **no** cambia tema global; usa tokens neutros en chrome (barra, texto) sobre arte dual |
| **Assets** | Manifest en `web/js/lib/assets.manifest.js` (nuevo) |
| **Offline** | Fondo y logo en cache SW |

## Assets requeridos

| ID | Ruta objetivo | Dimensiones | Notas |
| --- | --- | --- | --- |
| `loader.bg.dual` | `web/assets/shared/screens/loader-bg-dual.webp` | 1080×1920 (9:16) | Diptico fantasía/space, **sin texto** |
| `loader.logo` | `web/assets/shared/logo/wordmark-ambigram-light.webp` | ~800×280 px transparente | Sobre franja central oscura |
| `loader.logo.alt` | `web/assets/shared/logo/wordmark-ambigram-dark.webp` | idem | Reserva |
| `loader.particles.fantasy` | `web/assets/themes/fantasy/lottie/fireflies.json` | — | Opcional fase 1 |
| `loader.particles.space` | `web/assets/themes/spaceOpera/lottie/stars-drift.json` | — | Opcional fase 1 |
| `loader.accent.fantasy` | `web/assets/themes/fantasy/screens/loader-runes-glow.webp` | 1080×960 top half | Overlay multiply/screen opcional |
| `loader.accent.space` | `web/assets/themes/spaceOpera/screens/loader-nebula-glow.webp` | 1080×960 bottom | Overlay opcional |

Hasta tener arte final: gradiente + `PLACEHOLDER` badge discreto en dev (no en producción).

## Implementación prevista (tras OK + assets)

| Fichero | Cambio |
| --- | --- |
| `web/js/scenes/loader.js` | Reescritura: capas ilustración, logo `<img>`, barra progreso, frases, skip |
| `web/js/components/loader-chrome.js` | Nuevo: montaje capas y animación progreso |
| `web/js/lib/assets.manifest.js` | Nuevo: URLs por slot |
| `web/css/components.css` | Estilos loader v2 (barra bicolor, franja central) |
| `web/css/scenes/loader.css` | Opcional: estilos acotados a escena |
| `web/sw.js` | Precache assets shared |

## Criterios de aceptación

1. Viewport **390×844**: logo legible, eslogan ≥ 18px efectivos, barra visible.
2. Usuario identifica **fantasía arriba y space abajo** sin leer texto.
3. Progreso avanza de forma fluida; al completar → galería.
4. Tap skip funciona tras condición definida.
5. `prefers-reduced-motion`: sin animación de partículas ni pulso excesivo.
6. Sin errores consola en flujo feliz.
7. Playwright: captura en `tmp/playwright-output/loader-dual.png`.

### Capa orbital — naves procedurales (jun 2026)

- Siluetas **modulares hard sci-fi** (`loader-ship-procedural.js`), inspiradas en concept art industrial (espina segmentada, pods, bloques asimétricos, greebles, antenas). **Sin fuselaje continuo tipo pepino.**
- Archetypes → layouts: **fighter** (caza falcata / torre), **interceptor** (fragata de espina), **gunship** (bulk capital), **shuttle** (rig modular / torre). **14+ capas** SVG por nave.
- Carriles **paralelos** a arcos orbitales; blanco puro `#fff`; sin propulsión/flama.
- Tamaño ~38–44 px; tests en `web/tests/loader-ship-procedural.test.js`.

## Fuera de alcance

- Selección de mundo (pantalla P1 separada).
- Integración auth / bootstrap Supabase en loader (fase posterior).
- Rive del anillo (fase 2 si hay diseño motion).

## Prompts IA

Ver [LOADER_SCREEN_AI_PROMPTS.md](LOADER_SCREEN_AI_PROMPTS.md) — prompts listos para copiar y checklist de entrega.

## Aprobación

- [x] Usuario aprueba composición diptico + copy.
- [x] Prompts en fichero aparte para generación de assets.
- [x] Implementación en `web/` (placeholder CSS hasta arte final).
