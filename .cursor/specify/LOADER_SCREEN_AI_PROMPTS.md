# Prompts IA — Pantalla Loader (KidepiK)

> Spec runtime: [SPEC_LOADER_SCREEN.md](SPEC_LOADER_SCREEN.md)  
> Copia cada bloque tal cual en tu herramienta de generación de imágenes.  
> **Sin texto** en ilustraciones salvo el logo (prompt 4).

> **Estado jul 2026 (archivo vs runtime):** este documento es **banco de prompts / backlog de arte**.  
> En el cliente **no** se usan `loader-bg-dual` ni `wordmark-ambigram-dark` (eliminados del manifest).  
> Runtime: fondo plain + world procedural + `wordmark-ambigram-light.png`. Conservar prompts por si se vuelve a arte raster dual o tema oscuro.

---

## 1. Fondo hero dual (P0)

| Campo | Valor |
| --- | --- |
| **Archivo** | `web/assets/shared/screens/loader-bg-dual.webp` |
| **Tamaño** | 1080 × 1920 px (9:16) |
| **Formato** | WebP, calidad ~85 |

### Prompt

```
Mobile game splash screen illustration, vertical split composition. TOP HALF: enchanted fantasy realm for children ages 7-9 — lush emerald forest canopy, golden magical light rays, ancient mossy ruins, floating luminous runes, fireflies, soft painterly style like premium children's adventure game art, palette emerald green #3DDB7E and warm gold #F0C14A, dreamy atmosphere, no characters, no text, no logos. BOTTOM HALF: space opera cosmos for kids — deep navy void #000510, bright nebula blues #4DA3FF, distant stars, subtle planetary curve at horizon, sleek sci-fi wonder, same painterly premium game art style, no spaceships in foreground, no text. CENTER: soft horizontal luminous bridge where both worlds meet — magical green-gold glow blending into stellar blue-white light, gentle vignette at edges, cinematic, high detail, clean safe areas in center for UI overlay. --no text, watermark, letters, UI, buttons, frame, border, logo, scary elements, photorealistic faces
```

### Negativo (si la herramienta lo admite por separado)

```
text, logo, watermark, scary, horror, blood, weapons, realistic human, cluttered center
```

---

## 2. Overlay fantasía — runas (P1)

| Campo | Valor |
| --- | --- |
| **Archivo** | `web/assets/themes/fantasy/screens/loader-runes-glow.webp` |
| **Tamaño** | 1080 × 960 px (mitad superior) |
| **Formato** | WebP/PNG con transparencia |

### Prompt

```
Transparent overlay layer for mobile game UI, top half only. Floating golden arcane runes and soft green magical particles, subtle Celtic-fantasy motifs, glowing embers and firefly trails, emerald and gold palette, painterly light effects on transparent background, designed to overlay a forest illustration, ethereal, no solid background, no text, no characters. Game VFX sheet style.
```

---

## 3. Overlay space opera — nebulosa (P1)

| Campo | Valor |
| --- | --- |
| **Archivo** | `web/assets/themes/spaceOpera/screens/loader-nebula-glow.webp` |
| **Tamaño** | 1080 × 960 px (mitad inferior) |
| **Formato** | WebP/PNG con transparencia |

### Prompt

```
Transparent overlay layer for mobile game UI, bottom half only. Drifting star particles, soft lens flares, subtle hexagonal HUD light accents, nebula wisps in blue #4DA3FF and white, gentle parallax star field, sci-fi wonder for children, no solid background, no text, no spaceships, no characters. Game VFX sheet style.
```

---

## 4. Logo ambigrama KidepiK (P0)

| Campo | Valor |
| --- | --- |
| **Archivo claro** | `web/assets/shared/logo/wordmark-ambigram-light.webp` |
| **Archivo oscuro** | `web/assets/shared/logo/wordmark-ambigram-dark.webp` |
| **Tamaño** | ~800 × 280 px, fondo transparente |
| **Formato** | WebP o SVG |

### Prompt — versión sobre fondo oscuro (principal)

```
Typographic logo design, single wordmark: "KidepiK" — premium children's educational game brand. STRICT AMBIGRAM RULES for 180-degree rotation symmetry: (1) Central letter "e" must use rotational symmetry — reads identically upside down. (2) Letters "d" and "p" must swap visually when rotated 180 degrees. (3) Final "i" and final "K" must be designed as a mirrored pair so when the entire logo is flipped 180°, the ending still reads as lowercase i + capital K. (4) Opening capital K balances the composition. Custom lettering, NOT a standard font. Style: clean, modern, friendly, high-end mobile game studio wordmark — no mascot, no icon, no extra symbols. Color: luminous white and soft gold-green gradient on transparent background (version for dark backgrounds). Vector-sharp edges, generous letter spacing, legible at small mobile size. Flat design, no 3D bevel, no drop shadow baked in. --no cartoon character, no planet, no sword, no rocket, no subtitle, no tagline text
```

### Prompt — versión sobre fondo claro (reserva)

```
Same KidepiK ambigram wordmark with identical rotational symmetry rules (central e rotational, d/p swap, final i and K as flip pair). Color: deep forest green #0F3320 and cosmic navy #051428 gradient on transparent background, for light panels.
```

### Nota de producción

El ambigrama suele requerir **retoque vectorial** (Illustrator, Figma, generadores ambigrama) si la IA no respeta la simetría. Prioridad: **e** central rotacional y par **d/p**.

---

## 5. Anillo de progreso dual (P2, opcional)

| Campo | Valor |
| --- | --- |
| **Archivo** | `web/assets/shared/ui/loader-ring-dual.webp` |
| **Tamaño** | 512 × 512 px, transparente |

### Prompt

```
Circular loading ring icon for mobile game, split design: left semicircle emerald green and gold magical energy, right semicircle stellar blue and white light, thin elegant stroke, subtle inner glow, transparent background, no text, game UI asset, crisp vector style.
```

> La implementación actual usa **barra de progreso CSS** bicolor; este asset es opcional.

---

## 6. Spritesheets para Lottie (P2, opcional)

### Luciérnagas (fantasía)

| Campo | Valor |
| --- | --- |
| **Archivo destino** | `web/assets/themes/fantasy/lottie/fireflies.json` |

```
Spritesheet 8 frames, small golden-green fireflies on pure black background, soft glow, loop animation reference, game VFX, no text.
```

### Estrellas (space opera)

| Campo | Valor |
| --- | --- |
| **Archivo destino** | `web/assets/themes/spaceOpera/lottie/stars-drift.json` |

```
Spritesheet 8 frames, tiny white and blue stars drifting slowly, subtle twinkle, pure black background, loop animation, no text.
```

---

## Checklist de entrega

| Prioridad | Archivo | ¿Listo? |
| --- | --- | --- |
| P0 | `web/assets/shared/screens/loader-bg-dual.webp` | ☐ |
| P0 | `web/assets/shared/logo/wordmark-ambigram-light.webp` | ☐ |
| P1 | `web/assets/themes/fantasy/screens/loader-runes-glow.webp` | ☐ |
| P1 | `web/assets/themes/spaceOpera/screens/loader-nebula-glow.webp` | ☐ |
| P1 | `web/assets/shared/logo/wordmark-ambigram-dark.webp` | ☐ |
| P2 | Overlays Lottie / anillo raster | ☐ |

Tras colocar los ficheros, recarga `http://localhost:8082/#/loader` — la app los detecta automáticamente vía `assets.manifest.js`.
