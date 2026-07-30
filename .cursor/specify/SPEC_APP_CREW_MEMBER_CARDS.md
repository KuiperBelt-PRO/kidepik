# Spec: Fichas de tripulación — cartas coleccionables (estilo TCG)

> Estado: **aprobada e implementada** (julio 2026) — Fase A visual  
> Relacionado: [SPEC_APP_CREW_SECTION.md](SPEC_APP_CREW_SECTION.md), [SPEC_APP_SECTION_FRAME.md](SPEC_APP_SECTION_FRAME.md), [SPEC_APP_VISUAL_DESIGN_V3.md](SPEC_APP_VISUAL_DESIGN_V3.md), [SPEC_APP_PROGRESSION_RANKS.md](SPEC_APP_PROGRESSION_RANKS.md), [DESIGN.md](../DESIGN.md)

## Contexto

La sección Tripulación ([SPEC_APP_CREW_SECTION.md](SPEC_APP_CREW_SECTION.md)) define el contrato funcional de lista, alta y ficha. La implementación actual usa **tarjetas glass compactas** (`crew-panel__card`) homogéneas con Ajustes y Cuenta.

El tutor debe percibir cada miembro como un **explorador único** dentro de una colección familiar. La dirección deseada es la de una **carta de juego de rol / TCG** (referencia: *Magic: The Gathering*): marco con identidad, «arte», línea de tipo, caja de texto y esquinas de estado — **sin** romper el lenguaje visual glass del shell ni convertir la gestión en un minijuego.

Esta spec es **solo presentación** en `#/crew` y cabecera de `#/crew/:id`. No cambia API, permisos ni flujos de onboarding.

---

## Objetivo

1. Sustituir las tarjetas planas actuales por **fichas tipo carta** reconocibles y táctiles.
2. Mantener **homogeneidad** con controles glass ([DESIGN.md](../DESIGN.md)), tipografía del shell (`data-shell-theme`) y marco de sección.
3. Expresar el **mundo del niño** (`world_theme`) como identidad de carta (acento de marco), no como tema UI del tutor.
4. Dejar **slots** para rango narrativo ([SPEC_APP_PROGRESSION_RANKS.md](SPEC_APP_PROGRESSION_RANKS.md)) y retrato ilustrado (v3) sin bloquear el MVP con assets finales.

**No implementar código** hasta aprobación explícita de esta spec.

---

## Principios de diseño

| Principio | Decisión |
| --- | --- |
| Glass primero | Relleno y blur del catálogo glass; la carta es un **marco** sobre glass, no un PNG opaco |
| Shell ≠ mundo | Tipografía y chrome de sección siguen `data-shell-theme` del tutor; acentos de borde/brillo siguen `world_theme` del miembro |
| Legible en 390×844 | Cuerpo Nunito; touch ≥ 48px en toda la carta clicable; contraste AA en textos |
| TCG sin parodia | Inspiración estructural (zonas, esquinas, marco doble); **no** copiar layout Wizards ni tipografías con copyright |
| Datos existentes | Misma fuente `GET /api/v1/crew`; sin campos API nuevos en Fase visual A |
| Progresión futura | Esquina inferior reservada para tier/rango; placeholder hasta cablear `rank_id` |
| `prefers-reduced-motion` | Sin tilt 3D ni brillos animados si el usuario lo pide |

---

## 1. Anatomía de la carta

Proporción objetivo **5:7** (análoga a carta física; tolerancia ±2 % en CSS). En lista móvil la altura puede acotarse con `min-height` pero **debe** leerse como carta (marco + arte + pie), no como fila.

```
┌─────────────────────────────┐  ← Marco exterior (borde doble + glow mundo)
│ ┌─ Título ─────────── [◆] ┐ │  ← Nombre + gemelo de estado (badge)
│ │  N O R A                 │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │                          │ │
│ │     CAJA DE ARTE         │ │  ← Ilustración o placeholder iconográfico
│ │     (ratio 4:3)          │ │
│ │                          │ │
│ └──────────────────────────┘ │
│ Línea de tipo · Fantasía · 8 años   ← Mundo + edad (o pendientes)
│ ┌──────────────────────────┐ │
│ │ Caja de texto            │ │  ← Nota tutor / copy onboarding / rango
│ │ «La de Marta»            │ │
│ └──────────────────────────┘ │
│ [Rango tier — Fase B]                                    │
└─────────────────────────────┘
```

### 1.1 Zonas y clases BEM (propuesta)

| Zona | Clase raíz | Contenido |
| --- | --- | --- |
| Carta | `crew-card` | `button` o `a` en lista; `article` en ficha hero |
| Marco | `crew-card__frame` | Bordes, glow, variante `--world-fantasy` \| `--world-scifi` \| `--world-neutral` |
| Título | `crew-card__title` | `display_name` o placeholders de spec crew |
| Insignia estado | `crew-card__status-gem` | Única etiqueta de estado (Nuevo / Examen / Listo / Pausa / Tú) |
| Arte | `crew-card__art` | `img` futuro o `data-icon` procedural |
| Línea de tipo | `crew-card__type-line` | Mundo · edad · banda opcional |
| Texto | `crew-card__text-box` | `tutor_label`, helper onboarding o rango tutor |
| Esquina rango (Fase B) | `crew-card__corner crew-card__corner--rank` | Tier 1–5; pie de carta, no duplica estado |

Las clases `crew-panel__card*` actuales quedan **obsoletas** tras migración; el panel conserva prefijo `crew-panel__` solo en layout (grid, título sección).

### 1.2 Variantes de carta

| Variante | Clase modificadora | Cuándo |
| --- | --- | --- |
| Plaza vacía / pendiente | `crew-card--pending` | `onboarding_step !== 'complete'` y no examen |
| En examen | `crew-card--exam` | `placement_status === 'in_progress'` o step `placement` |
| Lista | `crew-card--ready` | `onboarding_step === 'complete'` |
| Pausada | `crew-card--paused` | `status === 'paused'` |
| Tutor | `crew-card--tutor` | `is_tutor_profile` |
| Slot «añadir» | `crew-card--slot` | CTA visual en grid (opcional Fase B; MVP mantiene botón inferior) |

---

## 2. Sistema visual (tokens)

Reutilizar tokens glass de [DESIGN.md](../DESIGN.md). Añadir tokens de carta en `web/css/components/crew-card.css` (nuevo) importado desde `settings-crew.css` o `main.css`.

### 2.1 Base glass (heredada)

```css
--crew-card-bg: var(--glass-bg);              /* rgba(255,255,255,0.10) */
--crew-card-bg-hover: var(--glass-bg-hover);
--crew-card-border: var(--glass-border);
--crew-card-radius: 14px;
--crew-card-inner-radius: 10px;
--crew-card-blur: var(--glass-panel-blur);
```

### 2.2 Acento por mundo del miembro (marco exterior)

| Mundo | Borde activo | Glow suave | Gemelo estado |
| --- | --- | --- | --- |
| `fantasy` | `rgba(61, 219, 126, 0.55)` | `rgba(240, 193, 74, 0.25)` | Verde + halo dorado |
| `sci-fi` | `rgba(77, 163, 255, 0.55)` | `rgba(255, 255, 255, 0.18)` | Azul + halo blanco |
| neutral (sin mundo) | `var(--glass-border)` | ninguno | Gris glass |

Los valores alinean con [SPEC_APP_VISUAL_DESIGN_V3.md](SPEC_APP_VISUAL_DESIGN_V3.md) § paletas; **no** recolorear el fondo del panel entero.

### 2.3 Marco doble (efecto TCG)

- **Exterior:** 2px solid acento mundo + `box-shadow` glow 0 0 12px acento al 35 %.
- **Interior:** 1px `rgba(255,255,255,0.22)` inset, padding 6px.
- **Esquinas:** pseudo-elementos opcionales en las cuatro esquinas (triángulos 6×6px blanco 40 %) — sutiles, no ornamentación medieval literal.

### 2.4 Tipografía

| Elemento | Fuente |
| --- | --- |
| Título carta | Misma que título de sección según `data-shell-theme` (Uncial/Cinzel fantasía shell, Bruno Ace/Orbitron sci-fi shell) |
| Línea de tipo, caja texto, esquinas | Nunito 600–700 |
| Título en mayúsculas tracking | `letter-spacing: 0.04em`; máx. 2 líneas con ellipsis |

### 2.5 Caja de arte (MVP)

| Estado | Contenido |
| --- | --- |
| Sin mundo | Icono `pending` centrado, fondo glass `--glass-bg-strong` |
| Fantasía / sci-fi | Icono tema (`theme-to-fantasy` / `theme-to-scifi`) a 40 % del ancho |
| Futuro v3 | `// ART_SLOT: crew-card-portrait-{childId}` WebP en `web/assets/themes/...` |

Ratio arte **4:3**; `border-radius` interior; viñeta CSS inferior (`linear-gradient` transparent → `rgba(0,0,0,0.35)`) para fusionar con línea de tipo.

---

## 3. Mapeo de datos (sin API nueva)

Fuente: DTO de [SPEC_APP_CREW_SECTION.md](SPEC_APP_CREW_SECTION.md) §4.

| Campo API | Zona carta |
| --- | --- |
| `display_name` | Título; fallback `crew.placeholderName` / «Tú» |
| `world_theme` | Modificador marco + icono arte + línea de tipo |
| `age_years` | Línea de tipo; «Edad pendiente» si null |
| `tutor_label` | Caja de texto (prioridad si existe) |
| `onboarding_step`, `placement_status`, `status` | Variante + gemelo + esquina estado |
| `is_tutor_profile` | Variante tutor; arte icono `account` |
| `rank_id` (futuro) | Esquina rango — oculta en Fase A |

### 3.1 Estado en carta

Un solo control visible: el **gemelo** (`crew-card__status-gem`) en la cabecera. No repetir el estado en el pie (la esquina inferior queda reservada para **rango**, Fase B).

| Condición | Label gemelo (≤12 caracteres) |
| --- | --- |
| Tutor | «Tú» |
| Pausa | «Pausa» |
| Examen | «Examen» |
| Pendiente | «Nuevo» |
| Completo | «Listo» |

---

## 4. Superficies

### 4.1 Lista `#/crew`

- Grid existente (1 → 2 → 3 columnas por `@container crew-panel`) se mantiene.
- Cada miembro: `<button type="button" class="crew-card crew-card--{variant}">` con anatomía §1.
- **Altura mínima lista:** 168px en viewport 390px; la carta escala con `width: 100%` y `aspect-ratio: 5 / 7` con `max-height` para no desbordar el marco scroll.
- CTA «Añadir tripulante» permanece **fuera** del grid (spec crew); no es carta coleccionable.
- Contador «X de Y tripulantes» sin cambios.

### 4.2 Ficha `#/crew/:id` — hero card

- Cabecera actual (nombre suelto + badge) se sustituye por **una carta hero** (`crew-card crew-card--hero`):
  - Ancho ~72 % del panel, centrada, `max-width: 280px`.
  - Misma anatomía; caja de texto puede mostrar rango tutor + nota.
  - No clicable (no navega); `article` con `aria-label` descriptivo.
- Bloques inferiores (perfil editable, permisos, zona peligrosa) **sin cambio** de contrato funcional; solo separador visual `crew-panel__block` bajo la hero.

### 4.3 Alta `#/crew/new`

- Sin carta; pantalla de confirmación intacta.

---

## 5. Interacción y motion

| Acción | Comportamiento |
| --- | --- |
| Tap lista | Navega a `#/crew/:id` (igual que ahora) |
| `:hover` (desktop dev) | `background → --crew-card-bg-hover`; elevación `translateY(-2px)`; glow +10 % |
| `:focus-visible` | Anillo `--glass-focus`, offset 3px |
| `:active` | `scale(0.98)` 120ms |
| Tilt 3D opcional | Solo `@media (hover: hover)` y **sin** `prefers-reduced-motion`; máx. 4° — Fase B, no MVP |
| Carta pausada | `opacity: 0.88`; sin desaturar el acento mundo |

---

## 6. Accesibilidad

- Carta lista: `button` con nombre accesible `{displayName}, {estado}, {mundo}, {edad}`.
- Arte decorativo: `aria-hidden="true"`.
- Contraste texto blanco sobre glass: mantener opacidades ≥ 0.78 en cuerpo.
- Touch target: toda la carta ≥ 48×48px (cumplido por min-height).
- Orden de foco: grid en orden DOM; hero en ficha antes de formularios.

---

## 7. Rangos y progresión (Fase B visual)

Cuando [SPEC_APP_PROGRESSION_RANKS.md](SPEC_APP_PROGRESSION_RANKS.md) esté cableado:

- Esquina `--rank` muestra **tier** (1–5) como rombo numérico o icono insignia.
- Caja de texto puede alternar `label_tutor` del rango.
- Marco gana **brillo adicional** por tier (tier 4–5: segundo anillo exterior sutil); sin rarezas estilo «foil» que distraigan en gestión.

Hasta entonces: esquina oculta (`display: none`) o guion «—».

---

## 8. Assets y placeholders

| ID manifest | Descripción |
| --- | --- |
| `crew-card-frame-fantasy` | SVG 9-slice opcional; MVP CSS puro |
| `crew-card-frame-scifi` | Idem |
| `crew-card-portrait-{id}` | Retrato niño post-v3 |

MVP **no exige** PNG/SVG de marco; CSS + glow es suficiente para aceptación.

---

## 9. Módulos afectados (implementación futura)

| Área | Fichero |
| --- | --- |
| Estilos | `web/css/components/crew-card.css` (nuevo), ajuste imports |
| Markup lista/ficha | `web/js/components/crew-panel.js` — `buildCrewCardHtml` → `buildCrewMemberCard` |
| Tests web | Snapshot DOM / clases variantes en `web/tests/` |
| E2E | Playwright: lista muestra `.crew-card`, tap abre ficha con `.crew-card--hero` |
| Docs | Actualizar §1.2 de [SPEC_APP_CREW_SECTION.md](SPEC_APP_CREW_SECTION.md); diagrama [10-parent-surfaces.md](../diagrams/10-parent-surfaces.md) |

**Fuera de alcance:** cambios API, play, examen, impresión/export PDF de cartas, animación de «robar carta».

---

## 10. Criterios de aceptación

1. En `#/crew`, cada miembro se renderiza como `crew-card` con marco doble, caja de arte, línea de tipo y caja de texto.
2. El acento de marco refleja `world_theme`; sin mundo usa variante neutral.
3. Variantes visuales `pending`, `exam`, `ready`, `paused`, `tutor` distinguibles sin depender solo del color (texto + gemelo).
4. Tipografía y glass coherentes con Ajustes/Cuenta en el mismo shell theme.
5. Ficha muestra hero card centrada; formularios debajo funcionan igual que antes.
6. `prefers-reduced-motion: reduce` desactiva hover translate y scale active opcional (mantener focus).
7. Viewport 390×844: grid 1 columna legible; sin overflow horizontal.
8. Playwright smoke: lista → tap carta → ficha con hero visible.

---

## 11. Fases de entrega sugeridas

| Fase | Entregable |
| --- | --- |
| **A** | CSS carta + lista + hero ficha + placeholders icono |
| **B** | Esquina rango + tier glow cuando exista `rank_id` |
| **C** | Retratos WebP v3 + tilt opcional |

---

## 12. Relación con specs hermanas

| Spec | Relación |
| --- | --- |
| CREW_SECTION | Contrato funcional; §1.2 lista actualizado por referencia a esta spec |
| SECTION_FRAME | Cartas viven dentro del scroll glass existente |
| VISUAL_DESIGN_V3 | Paletas mundo; retratos futuros |
| PROGRESSION_RANKS | Esquina rango y copy tutor |
| DESIGN.md | Tokens glass compartidos |

---

## Aprobación

- [x] Dirección TCG / marco doble / zonas aceptada
- [x] Acento por `world_theme` del niño (no shell) aceptado
- [x] Hero card en ficha aceptada; bloques formulario sin rediseño
- [x] Fase A (CSS + iconos) autorizada para implementar

Tras aprobación: actualizar estado a **aprobada**, índice [CURRENT_SPECS.md](../CURRENT_SPECS.md) y §1.2 de [SPEC_APP_CREW_SECTION.md](SPEC_APP_CREW_SECTION.md).
