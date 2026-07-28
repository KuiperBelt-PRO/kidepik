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
--glass-bg-strong: rgba(255, 255, 255, 0.22);
--glass-border: rgba(255, 255, 255, 0.28);
--glass-border-strong: rgba(255, 255, 255, 0.55);
--glass-focus: rgba(255, 255, 255, 0.85);
--glass-text: #ffffff;
--glass-radius-field: 12px;
--glass-radius-pill: 999px;
--glass-touch: 48px;
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

### 3. Radio / segment chips (`glass-chip`)

- Píldoras **redondas** (`border-radius: 999px`); si el contenido es un dígito corto, forzar **círculo** (`aspect-ratio: 1`, `min-width: 48px`).
- Uso: tipografía Normal/Grande/Muy grande, sesiones/día, temas, etc.
- **No** usar chips para duración máxima de sesión (ver slider).

### 4. Slider de duración (`glass-slider`)

- Rango **5–120 minutos**, step **5**.
- Track: línea blanca semitransparente; thumb: círculo blanco glass.
- Label vivo al lado: `10 min` / `1 h 15 min` / `2 h`.
- Mismo foco blanco.

### 5. Select / dropdown (`glass-select`)

- **No** depender del menú nativo del SO (fondo blanco + highlight azul).
- Trigger glass + chevron procedural.
- Lista: al abrir se **portaliza** a `body`; panel con tinte suave + blur (~28px), texto blanco, sin velo ni sombra en opciones.
- Cierre al elegir / Escape / click fuera.

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

### 10. Stepper ± (edad, cantidades)

- Dos botones circulares glass con chevron; valor en field central readonly o editable.

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

---

## Implementación

| Pieza | Path |
| --- | --- |
| Tokens + CSS | `web/css/components/glass-controls.css` |
| Helpers JS | `web/js/components/glass-controls.js` |
| Iconos | `web/js/components/shell-ui-icons.js` |
| Consumo | Cuenta, Ajustes, Tripulación (y futuras secciones glass) |
| Demo local | `http://localhost:8082/tmp/glass-controls-demo.html` (loader real + `poc-up.ps1`) |

Al añadir un control nuevo: documentarlo aquí **antes** o en el mismo PR, y reutilizar clases `glass-*`.
