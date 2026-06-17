# Spec: Sistema visual v3 — web premium (KidepiK)

> Estado: **borrador para aprobación** (junio 2026)  
> Relacionado: [SPEC_WEB_FRONTEND_ARCHITECTURE.md](SPEC_WEB_FRONTEND_ARCHITECTURE.md), [docs/kidepik.md](../../docs/kidepik.md) §2

## Objetivo

Definir un sistema visual **premium, tipo estudio de videojuegos / diseño editorial**, para cliente **web** (HTML + CSS + JavaScript), con dual theme **fantasía (verde + dorado)** y **space opera (azul + blanco)**, priorizando:

- **Ilustración a pantalla completa** como capa principal (no fondos procedural en código).
- **UI como overlay ligero** (HUD, diálogo, botones) que no compite con el arte.
- **Motion design** con archivos dedicados (Rive / Lottie), no solo CSS genérico.
- **Sustituibilidad de assets** (IA + retoque humano) sin reescribir layout.

## Principios de dirección de arte

| Principio | Implicación técnica |
| --- | --- |
| **Una escena = una composición** | Cada pantalla clave tiene `background.webp` (+ capas opcionales). |
| **Menos capas de efecto** | Máx. 1 overlay atmosférico (partículas Lottie o vídeo loop corto). |
| **Legibilidad 7–9 años** | Cuerpo Nunito; contraste WCAG AA en texto sobre paneles; touch ≥ 48px. |
| **Fantasía ≠ Space** | Misma estructura de pantalla; arte y paleta distintos (no recolorear el mismo PNG). |
| **Marca limpia** | Wordmark tipográfico; sin gimmicks en logo (ver docs/kidepik.md §2). |

## Paletas (mantener identidad acordada)

### Fantasía — verde + dorado

| Token CSS | Valor | Uso |
| --- | --- | --- |
| `--color-primary` | `#3DDB7E` | Acentos vivos, brillos |
| `--color-secondary` | `#F0C14A` | Dorado, highlights |
| `--color-bg-deep` | `#03180A` | Cielo / sombras |
| `--color-surface` | `rgba(255, 248, 230, 0.92)` | Paneles narrativos |
| `--color-on-surface` | `#0F3320` | Texto en panel |
| `--color-glow` | `rgba(61, 219, 126, 0.4)` | Halo suave |

### Space opera — azul + blanco

| Token CSS | Valor | Uso |
| --- | --- | --- |
| `--color-primary` | `#4DA3FF` | Acentos, luces |
| `--color-secondary` | `#FFFFFF` | Estrellas, texto sobre oscuro |
| `--color-bg-deep` | `#000510` | Espacio profundo |
| `--color-surface` | `rgba(248, 251, 255, 0.92)` | Paneles |
| `--color-on-surface` | `#051428` | Texto en panel |
| `--color-glow` | `rgba(77, 163, 255, 0.35)` | Nebulosa / HUD |

Temas: `document.documentElement.dataset.theme = "fantasy" | "spaceOpera"`.

## Tipografía

| Rol | Fantasía | Space | Cuerpo |
| --- | --- | --- | --- |
| Display | **Cinzel** (woff2 local) | **Orbitron** (woff2 local) | **Nunito** 600 |

Cargar fuentes desde `web/assets/fonts/` (woff2 local; `<link>` o `@font-face` en CSS).

## Stack visual (tecnologías)

| Capa | Tecnología | Uso |
| --- | --- | --- |
| Layout / responsive móvil | CSS Grid + Flexbox, `max-width` contenedor 430px centrado en desktop | Marco “teléfono” en PC |
| Ilustraciones | WebP (AVIF opcional), `@2x` para retina | Fondos, retratos, iconos |
| Animación personaje / loader | **Rive** (`.riv`) preferente; Lottie JSON como fallback | Loader, recompensas, transiciones |
| Micro-UI | CSS transitions + `prefers-reduced-motion` | Botones, hover (solo desktop dev) |
| Partículas ambientales | Lottie loop ligero o CSS `background-image` tile | Opcional, 1 por tema |
| Minijuegos (futuro) | PixiJS en `<canvas>` | Fuera de fase 1 |

**Prohibido en v3:** fondos “procedural” dibujados en código como sustituto del arte final (salvo placeholder temporal marcado `PLACEHOLDER_ART`).

## Anatomía de pantalla (patrón)

```
┌─────────────────────────────┐
│  [IllustrationLayer]        │  ← 100% ancho, object-fit: cover
│  (background + parallax?)   │
├─────────────────────────────┤
│  [AtmosphereLayer]          │  ← opcional: Lottie partículas, vignette CSS
├─────────────────────────────┤
│  [GameChrome]               │  ← HUD, safe-area padding
│    [DialoguePanel]          │  ← panel inferior semitransparente
│    [ChoiceButtons]          │
└─────────────────────────────┘
```

## Componentes web (design system)

| Componente | Responsabilidad |
| --- | --- |
| `IllustrationLayer` | `<picture>` / `<img>` con art direction por tema |
| `AtmosphereLayer` | Vignette CSS + Lottie opcional |
| `GamePanel` | Marco narrativo (borde con imagen 9-slice o SVG) |
| `DialogueBox` | Retrato + texto + CTA |
| `ChoiceList` | 2–3 decisiones táctiles |
| `ChallengeCard` | Reto + respuestas + pista |
| `SessionHud` | Materia, zona, progreso |
| `ThemeToggle` | Pill fantasy / space (dev y galería) |
| `Wordmark` | Logo tipográfico |

Cada componente con slot `// ART_SLOT: <id>` mapeado en `web/src/themes/assets.manifest.ts`.

## Pipeline de assets

### Convención de archivos

```
web/assets/themes/
  fantasy/
    screens/
      loader-bg.webp
      gallery-bg.webp
      world-picker-fantasy.webp
    ui/
      panel-frame.webp          # o .svg nine-patch
      button-primary.webp
    rive/
      loader.riv
    lottie/
      fireflies.json
  spaceOpera/
    screens/
      ...
```

### Generación IA + producción

1. **Moodboard** por tema (6–12 referencias fijas en `.cursor/specify/visual-references/` — fase posterior).
2. **Prompt base** documentado por pantalla (estilo, paleta, sin texto en imagen).
3. **Post-proceso:** recorte, compresión WebP, revisión humana de coherencia.
4. **Manifest:** `web/js/lib/assets.manifest.js` resuelve URL por `themeId` + `slotId`.

### Placeholders (hasta tener arte)

- Usar **fotografías/ilustraciones stock coherentes** o frames IA aprobados — **no** gradientes SVG como destino final.
- Marcar en UI dev badge `PLACEHOLDER` discreto.

## Pantallas fase 1 (paridad galería)

1. **Loader** — ilustración hero + Rive/Lottie anillo o personaje + frase rotatoria.
2. **Galería** — lista de mockups sobre fondo pintado.
3. **Mockups** — diálogo, elección, reto, mapa, HUD, recompensa, minijuego shell.
4. **Selector de mundo** — dos tarjetas ilustradas full-bleed.

## Motion (criterios de calidad)

| Elemento | Duración | Easing |
| --- | --- | --- |
| Entrada pantalla | 400–600 ms | ease-out |
| Tap botón | 120 ms scale 0.97 | ease-in-out |
| Transición tema | 300 ms crossfade ilustración | ease |
| Loader loop | 2–4 s ciclo | lineal en Rive |

Respetar `prefers-reduced-motion: reduce` → estático o fade simple.

## Criterios de éxito visual

1. Al menos **2 fondos ilustrados reales por tema** (loader + galería) antes de cerrar fase 1.
2. Un observador externo no describe la UI como “hecha con CSS de demo”.
3. Toggle tema cambia **ilustración y tokens**, no solo colores de botones.
4. Texto de reto legible en viewport 390×844 sin zoom.
5. Lighthouse Performance ≥ 85 en build prod (assets optimizados).

## Excluido

- 3D, avatar monstruito (post-MVP).
- Localización.

## Aprobación

- [ ] Usuario aprueba enfoque ilustración + Rive/Lottie.
- [ ] Usuario aprueba paletas verde/dorado y azul/blanco como base.
- [ ] Tras OK → implementación en `web/` según [WEB_FRONTEND_PIVOT_EXECUTION_PLAN.md](../tasks/WEB_FRONTEND_PIVOT_EXECUTION_PLAN.md).
