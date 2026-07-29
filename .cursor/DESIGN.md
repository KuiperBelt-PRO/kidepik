# Diseño de controles UI — KidepiK (gestión tutor)

> Estado: **vigente** (julio 2026)  
> Ámbito: pantallas de gestión autenticada (Cuenta, Ajustes, Tripulación, Legal con shell).  
> Relacionado: [specify/SPEC_APP_VISUAL_DESIGN_V3.md](specify/SPEC_APP_VISUAL_DESIGN_V3.md), [specify/SPEC_APP_SHELL_CHROME.md](specify/SPEC_APP_SHELL_CHROME.md), [specify/SPEC_APP_SECTION_FRAME.md](specify/SPEC_APP_SECTION_FRAME.md)

## Principio rector

Sobre el **mundo dual animado** + marco **glass**, los controles son **blancos con transparencias**.  
**Prohibido:** acentos de color de sistema (naranja/azul/verde de focus nativo), fills de marca en checkboxes/radios, botones de peligro en rojo/coral.

| Señal | Cómo se expresa |
| --- | --- |
| Reposo | `rgba(255,255,255,0.10–0.14)` fondo · borde `0.28` |
| Hover / pressed | fondo `0.20–0.28` · borde `0.45–0.55` |
| Focus visible | anillo blanco `2px solid rgba(255,255,255,0.85)` + offset 2px · **nunca** outline naranja del SO |
| Seleccionado (chip/toggle) | fondo `0.28` · borde `0.55` |
| Deshabilitado | `opacity: 0.45` |
| Texto / iconos | `#FFFFFF` por defecto; iconos semánticos (p. ej. `danger` → `#FF6B63`) |

`color-scheme: dark` en superficies de formulario para que el navegador no pinte widgets claros.

---

## Tokens (CSS)

Definidos en `web/css/components/glass-controls.css`:

```css
--glass-bg: rgba(255, 255, 255, 0.10);
--glass-bg-hover: rgba(255, 255, 255, 0.20);
--glass-bg-strong: rgba(255, 255, 255, 0.22);
--glass-bg-selected: rgba(255, 255, 255, 0.28);
--glass-border: rgba(255, 255, 255, 0.28);
--glass-border-strong: rgba(255, 255, 255, 0.55);
--glass-focus: rgba(255, 255, 255, 0.85);
--glass-text: #ffffff;
--glass-radius-field: 12px;
--glass-radius-pill: 999px;
--glass-touch: 48px;
/* Panel dropdown (popover top-layer) */
--glass-panel-tint: rgba(255, 255, 255, 0.10);
--glass-panel-fallback: rgba(255, 255, 255, 0.22);
--glass-panel-border: rgba(255, 255, 255, 0.50);
--glass-panel-blur: blur(40px) saturate(1.55);
```

---

## Catálogo de controles

### 1. Campo de texto / password / number (`glass-field`)

- Min-height 48px, radius 12px, glass fill + borde blanco.
- Focus: borde + outline blancos (sin glow de color).
- Number: **ocultar spinners nativos**; usar stepper glass (±) con icono chevron del generador procedural.
- Placeholder: blanco ~40 % opacidad.

### 2. Checkbox (`glass-check`)

- Caja 22–24 px, borde blanco, fondo transparente / `0.10`.
- Checked: fondo `rgba(255,255,255,0.35)`, checkmark blanco (SVG o `::after`), **sin** `accent-color` de sistema.
- Hit area ≥ 48 px de alto en la fila label.

### 3. Radio / segment chips (`glass-chip` / `crew-panel__chip`)

- Píldoras **redondas** (`border-radius: 999px`); si el contenido es un dígito corto, forzar **círculo** (`aspect-ratio: 1`, `min-width: 48px`).
- En Tripulación/Ajustes la clase de producto es `crew-panel__chip` (estilos compartidos con `.glass-chip` en `glass-controls.css`).
- Uso: tipografía Normal/Grande/Muy grande, sesiones/día, temas UI, etc.
- **No** usar chips para duración máxima de sesión (ver slider).

### 4. Slider de duración (`glass-slider`)

- Rango **5–120 minutos**, step **5**.
- Track: línea blanca semitransparente; thumb: círculo blanco glass.
- Label vivo al lado: `10 min` / `1 h 15 min` / `2 h`.
- Mismo foco blanco.

### 5. Select / dropdown (`glass-select`)

Implementación: `mountGlassSelect()` en `glass-controls.js`.

- **No** depender del menú nativo del SO (fondo blanco + highlight azul).
- Trigger glass + chevron procedural (`createGlassIconSvg('chevron')`).
- Opciones: texto **blanco**; hover/seleccionado con fill blanco semitransparente (`0.18` / `0.26`).

#### Glass del panel (prioridad visual)

| Capa | Valor |
| --- | --- |
| Tinte | `--glass-panel-tint` = mismo nivel que trigger (`rgba(255,255,255,0.10)`) |
| Blur | `--glass-panel-blur` = `blur(40px) saturate(1.55)` |
| Borde / sombra | `--glass-panel-border` · sombra exterior suave + `inset` blanco ~38 % |

**No** usar tinte oscuro (`rgba(12,28,38,…)`) ni degradados blancos tipo “escarcha” encima del blur: leen como bloque opaco o velo blanco feo. El **blur** aporta el cristal; el tinte solo unifica con el trigger.

#### Top-layer vs marco (`section-frame__scroll`)

En Chromium, `backdrop-filter` **no funciona** dentro del scroll del marco (ancestros con `overflow` + `mask-image` del fade). Por eso el panel abierto usa, cuando el navegador lo permite:

1. `popover="manual"` + clase `glass-select--top-layer`
2. `position: fixed` + posición calculada al **abrir** y en **resize** (no en cada frame de scroll)
3. `hidePopover()` al cerrar; `[hidden]` + `display: none !important` para que `:popover-open` no deje el panel visible

**Fallback** sin `showPopover`: panel `position: absolute` bajo el trigger, mismo tinte, **sin** blur real.

| Enfoque | Scroll con panel abierto | Glass (blur) | Fade del marco |
| --- | --- | --- | --- |
| `absolute` en el scroll | Sin lag (va pegado al trigger) | No real | Nativo del marco |
| Popover top-layer + cierre al scroll | Fluido (no sync JS al scroll) | Real | El panel desaparece al scrollear el marco |

**Decisión de producto:** priorizar glass real → popover + **cerrar al scroll** del marco (no seguir el trigger mientras scrolleas).

#### Cierre del panel

| Evento | Acción |
| --- | --- |
| `pointerup` en opción | Selecciona valor + cierra (ratón y táctil; no usar solo `click` con popover) |
| `Escape` | Cierra |
| Click fuera (`composedPath` sin root/panel) | Cierra |
| `scroll` / `wheel` en `.section-frame__scroll` | Cierra si el evento **no** incluye el panel en `composedPath()` |
| Toggle del trigger | Abre / cierra |

Tras cerrar: **400 ms** sin reabrir el trigger (evita “ghost click” del popover en móvil).

#### Anti-patrones técnicos (select)

- Sincronizar `top/left` del panel en cada `scroll` (lag en touch).
- `touchstart` en el marco para cerrar (compite con el tap en la opción).
- `stopPropagation` en **captura** sobre el panel (bloquea el tap en opciones).
- `selectOption` que aborta si `dataset.open` ya es `false` (deja valor sin aplicar o panel colgado).

### 6. Botón (`glass-btn`)

- Siempre **icono + texto**.
- Icono: `renderShellUiIconSvgInner` (`shell-ui-icons.js`); se **regenera** al cambiar `uiTheme` sci-fi ↔ fantasy.
- Variantes: default / primary (fondo un poco más opaco) / ghost (link).
- Peligro (eliminar): **misma** cromática glass que el resto; icono `danger` en **coral** (`#FF6B63`), igual que Cuenta. El color va en el **glyph**, no en el borde/fondo del botón.

### 7. Toggle / switch (reserva)

- Pista glass; knob blanco; on = pista `0.35` blanco, off = `0.12`. Sin verde/azul de sistema.

### 8. Textarea (reserva)

- Igual que field; **sin** asa de resize nativa (`resize: none`); scroll vertical con scrollbar fino blanco; min-height ~96 px.

### 9. Progress / meter (reserva)

- Track `0.15` blanco; fill `0.55` blanco (sin color de materia).

### 10. Stepper ± (`glass-stepper` + `mountAgeStepper`)

- Dos botones circulares glass con chevron; field central `type="number"` (edad tripulante **5–14** en Cuenta/Tripulación).
- Helper: `mountAgeStepper(host, { value, min, max, onChange })`.

---

## Uso en pantallas (julio 2026)

| Pantalla | Controles glass |
| --- | --- |
| **Tripulación** (detalle) | `mountGlassSelect` estado Activo/En pausa · `mountDurationSlider` 5–120 min · `mountAgeStepper` · chips texto aventuras · chips sesiones/día · botones icono+texto (`crew`, `save`, `close`, `danger`) |
| **Ajustes** | `mountDurationSlider` · chips tema UI / texto · botones `save` / `close` |
| **Cuenta** | Fields · checkboxes · botones (`signout`, etc.) |
| **Demo** | `web/tmp/glass-controls-demo.html` — catálogo completo sobre loader real |

Duración de sesión: **solo** slider (`normalizeSessionMinutes`, `formatDurationMinutes`), nunca chips.

---

## Iconografía

| Acción típica | `UiIconId` |
| --- | --- |
| Guardar | `save` |
| Eliminar / warning | `danger` |
| Tripulación | `crew` |
| Añadir | `add` |
| Cancelar / cerrar | `close` |
| Volver | `chevron` (rotado 90°) |
| Cerrar sesión | `signout` |
| Ajustes | `settings` |
| Cuenta | `account` |

Nuevos ids se añaden en `shell-ui-icons.js` con variantes sci-fi y fantasy.

---

## Tipografía en controles

- Labels / títulos de bloque: display según `data-shell-theme` (Cinzel/Uncial vs Bruno Ace/Orbitron).
- Valores y helpers: Nunito.
- Escala: `data-font-scale-ui` (`md|lg|xl` → 1 / 1.12 / 1.24).

---

## Anti-patrones

- Outline / glow naranja, azul o verde de sistema en `:focus`.
- `accent-color` distinto de blanco/gris claro.
- Dropdown nativo sin personalizar.
- Spinners nativos de `<input type="number">`.
- Botón destructivo con **chrome** rojo/coral (el aviso es el **icono** coloreado + copy).
- Botón solo texto sin icono en CTAs de gestión.
- Chips para rangos largos (usar slider).
- Panel select con tinte oscuro o degradado blanco “lechoso” encima del blur.
- Panel select `position: fixed` + sync JS en cada scroll (lag).
- Listeners de cierre en el marco que no filtran interacción dentro del panel (`composedPath`).

---

## Implementación

| Pieza | Path |
| --- | --- |
| Tokens + CSS | `web/css/components/glass-controls.css` |
| Helpers JS | `web/js/components/glass-controls.js` |
| Iconos | `web/js/components/shell-ui-icons.js` |
| Consumo | `crew-panel.js`, `settings-panel.js`, `account-panel.js` |
| Demo local | `http://localhost:8082/tmp/glass-controls-demo.html` (loader real + `poc-up.ps1`) |

### Helpers JS exportados

| Función | Uso |
| --- | --- |
| `mountGlassSelect` | Select custom con popover glass |
| `mountDurationSlider` | Slider 5–120 min (step 5) |
| `mountAgeStepper` | Stepper edad |
| `setGlassButton` / `bindGlassIconTheme` | Botones icono + texto |
| `createGlassIconSvg` | Iconos inline (chevron select, stepper) |
| `normalizeSessionMinutes` / `formatDurationMinutes` | Duración sesión |
| `renderGlassSkeletonHtml` / `fillGlassSkeleton` / `mountGlassSkeleton` | Placeholder de carga (barras + shimmer) |
| `GLASS_ICON_FILL` | `#FFFFFF` · danger `#FF6B63` |

### Skeleton de carga

Barras redondeadas con brillo deslizante (mismo patrón que Privacidad/Términos). Clases: `.glass-skeleton`, `.glass-skeleton__line`, variantes `--title|--heading|--full|--wide|--medium|--narrow`.

| Preset | Uso |
| --- | --- |
| `document` | Texto largo (legal, artículos) |
| `panel` | Lista tripulación, ficha miembro |
| `lines` | Bloques cortos (ajustes, estados breves) |

Sustituir `<p>Cargando…</p>` por `fillGlassSkeleton(host, { preset, ariaLabel })`.

### Cache bust

Tras cambiar CSS/JS de controles, subir `?v=` en:

- `web/index.html` → `glass-controls.css`, `main.js`
- Cadena de imports: `main.js` → `scenes/crew.js` / `settings.js` → `crew-panel.js` / `settings-panel.js` → `glass-controls.js`
- Demo: `glass-controls-demo.html` (css + import del módulo)

Al añadir un control nuevo: documentarlo aquí **antes** o en el mismo PR, y reutilizar clases `glass-*`.
