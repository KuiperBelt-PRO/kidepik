# Spec: Compose compacto en play (móvil)

> Estado: **aprobada — implementada** (21 ago 2026)  
> Relacionado: [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md), [SPEC_APP_PLAY_CHALLENGE_BAGGAGE_OFFER.md](SPEC_APP_PLAY_CHALLENGE_BAGGAGE_OFFER.md), [SPEC_APP_JOURNEY_CHAPTERS.md](SPEC_APP_JOURNEY_CHAPTERS.md), [SPEC_APP_PLAY_FIRST_RUN.md](SPEC_APP_PLAY_FIRST_RUN.md), [SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE.md](SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE.md), [SPEC_APP_PLAY_PROGRESS_HUD.md](SPEC_APP_PLAY_PROGRESS_HUD.md), [SPEC_APP_SECTION_FRAME.md](SPEC_APP_SECTION_FRAME.md)  
> **Diagrama:** [11-child-adventure-pipeline.md](../diagrams/11-child-adventure-pipeline.md), [19-rewards-inventory.md](../diagrams/19-rewards-inventory.md)

## Contexto

En viewport 390×844 el pie de `#/play/:childId` acumula hotbar de equipaje **expandida**, chips MCQ en varias filas y el compose. El texto del viaje queda aplastado. El título de capítulo (`nowrap` + `max-width: 18rem`) se corta (p. ej. «Cartografía de Sectores Inexplorados»).

El motor de diálogo es **uno** ([SPEC_APP_ADVENTURE_DIALOGUE](SPEC_APP_ADVENTURE_DIALOGUE.md)): first-run, examen de acceso y aventura. El cambio de chips **no** es solo del reto.

Código actual: `web/js/scenes/play.js` (`baggageHotbarCollapsed = false`), `web/js/lib/play-baggage-offer.js`, `web/css/scenes/play.css`, `web/css/components/section-frame.css`.

## Objetivo

1. Hotbar de equipaje **plegada por defecto**; cabecera compacta en móvil.
2. Título de capítulo **legible** (hasta 2 líneas; sin recorte a 18 rem).
3. Chips de respuesta **en el viaje** (log), junto al turno mentor vigente.
4. Pie fijo: **solo** compose de texto (+ hotbar plegada si hay oferta). Mismo contrato en umbral, rito y aventura.

**Fuera de alcance:** API HTTP, `input_mode`, catálogo de effects, toggle de vista equipaje completa ([SPEC_APP_PLAY_BAGGAGE_TOGGLE](SPEC_APP_PLAY_BAGGAGE_TOGGLE.md)).

---

## 1. Decisiones

| # | Decisión | Valor |
| --- | --- | --- |
| C1 | Viewport de diseño | 390×844; el layout unificado aplica también en anchos mayores (un motor) |
| C2 | Equipaje inline | **Plegado por defecto**; persistir abierto/cerrado **en la sesión play** (no re-expandir al cambiar de turno) |
| C3 | Cabecera plegada | Una sola línea (~32–36 px): chevron + `Equipaje (N)`. **Sin** hint ni «Ver equipaje completo» |
| C4 | Cuerpo expandido | Tira horizontal de icono + nombre (sin botón «Usar ahora» por slot). Tap icono → detalle + acción |
| C5 | «Ver equipaje completo» | Solo con hotbar **expandida** (abre el toggle de vista baggage) |
| C6 | Título de capítulo | Hasta **2 líneas** (`line-clamp: 2`); brand usa el hueco entre nav back y toggle; **sin** `max-width: 18rem`; `title` = texto completo; **sin** marquee |
| C7 | Chips MCQ / continue | Viven en el **log**, anclados al último turno mentor pendiente; **no** en `section-frame__footer` |
| C8 | Pie | Compose (`options_or_text` / `text_only`) + hotbar plegada si hay `baggage_offers`. Sin chips |
| C9 | Alcance de chips | `first_run`, `placement`, `adventure` — mismo `play.js` |
| C10 | Cartas con `description` | Mundo / zona / camino: las **cartas en el log** son el selector. **No** duplicar chips |
| C11 | Historial | Turnos pasados **no** reactivan chips ([SPEC_APP_ADVENTURE_DIALOGUE_HISTORY](SPEC_APP_ADVENTURE_DIALOGUE_HISTORY.md)) |
| C12 | Progreso examen | «Prueba N de M» pasa al log, encima de los chips del ítem; **no** ocupa el pie |

---

## 2. Anatomía (390×844)

```
┌─────────────────────────────────────┐
│ [←]  [logo]                         │
│      Cartografía de Sectores        │  ← hasta 2 líneas, sin ellipsis a 18rem
│      Inexplorados                   │
│      Recluta · ████░░  Cadete       │  ← HUD (sin cambio de contrato)
├─────────────────────────────────────┤
│ ▲ scroll                            │
│ │  burbuja mentor (pregunta)        │
│ │  Prueba 1 de 3                    │  ← solo placement
│ │  [La hidrosfera] [La litosfera]   │  ← chips del turno vigente
│ │  [La biosfera]                    │
│ ▼                                   │
├─────────────────────────────────────┤
│ [v] Equipaje (1)                    │  ← plegado; se oculta si no hay oferta
│ [ Escribe tu respuesta…        ➤ ]  │
└─────────────────────────────────────┘
```

`options_only` (examen, género, mundo-con-cartas, continue): **sin** compose. Si tampoco hay oferta de equipaje, el pie puede quedar vacío (borde mínimo / hidden).

---

## 3. Equipaje inline (hotbar)

Extiende [SPEC_APP_PLAY_CHALLENGE_BAGGAGE_OFFER](SPEC_APP_PLAY_CHALLENGE_BAGGAGE_OFFER.md). Sigue en el pie (no en el log) para no mezclar objetos con la pregunta.

### 3.1 Default y persistencia

- `baggageHotbarCollapsed` inicial = **`true`**.
- El tap del chevron invierte el estado y se mantiene hasta salir de play.
- Un reto nuevo **no** fuerza expandido.

### 3.2 Compacto (plegado)

| Visible | Oculto |
| --- | --- |
| Chevron, `Equipaje (N)` | Hint («Desliza…» / «N listos…»), «Ver equipaje completo», tira de slots, detalle |

Hit area del chevron ≥ 32 px; el título puede ser tappable para expandir (mismo toggle).

### 3.3 Compacto (expandido)

- Slots: icono cuadrado + nombre 2 líneas; **sin** `play-baggage-hotbar__action` en cada slot.
- «Usar ahora» / «Reintentar» solo en el panel de detalle tras `data-baggage-offer-preview`.
- «Ver equipaje completo» en la cabecera expandida.
- En ≤ 430 px de ancho de marco, slots ≤ `4.2rem` (hoy `5.35rem`).

---

## 4. Título de capítulo

Extiende [SPEC_APP_JOURNEY_CHAPTERS](SPEC_APP_JOURNEY_CHAPTERS.md) §4.1. Validación servidor 4–48 caracteres **sin cambio**.

| Regla | Valor |
| --- | --- |
| Wrap | `white-space: normal`; máximo 2 líneas; overflow hidden |
| Ancho | Brand `max-width` = hueco entre botones de nav (no `18rem`) |
| Fallback | `title` / `aria-label` con el texto íntegro |
| Prohibido | Marquee, recorte a una línea con ellipsis como único recurso en play |
| HUD | Sigue bajo el título ([SPEC_APP_PLAY_PROGRESS_HUD](SPEC_APP_PLAY_PROGRESS_HUD.md)); cabecera puede crecer ~1 línea extra |

Rutas de gestión (`#/crew`, `#/settings`, …) **no** cambian: siguen ellipsis de una línea.

---

## 5. Chips en el viaje

Extiende [SPEC_APP_ADVENTURE_DIALOGUE](SPEC_APP_ADVENTURE_DIALOGUE.md) §1.

### 5.1 Dónde

Host en el log, **después** de la última burbuja mentor del turno pendiente (o de las cartas mundo/zona/camino si existen). Clase propuesta: `.play-panel__choices` (`data-play-choices`).

No se montan en `[data-options]` del footer. Ese nodo se retira o queda vacío permanente.

### 5.2 Por `input_mode`

| Modo | Log | Pie |
| --- | --- | --- |
| `options_only` | Chips (o cartas C10) | Sin compose |
| `options_or_text` | Chips | Compose |
| `text_only` | Sin chips | Compose |
| `continue` | Un CTA en el log | Sin compose |
| `blocked` | Sin chips | Sin compose (spinner en burbuja) |

Tap de chip / CTA: mismo `sendReply` que hoy (envío inmediato; no rellenar el textarea).

### 5.3 First-run y examen

| Fase | Selector |
| --- | --- |
| `choose_world` / `choose_zone` / `choose_path` | Cartas `.play-world-hints` **solo**. Quitar chips duplicados del pie |
| `choose_gender`, edad, traits, resto `options_*` | Chips en el log |
| `placement_item` | Chips en el log + rótulo «Prueba N de M» encima; compose sigue oculto |

### 5.4 Layout de chips

Wrap permitido (ya no roba pie). Hit ≥ 44 px de alto. Estilo `crew-panel__chip` / `play-panel__option` sin cambio de tokens ([DESIGN.md](../DESIGN.md)).

Tras responder: el host de chips del turno vigente se vacía; la elección aparece como burbuja explorador. Historial **no** rehidrata chips.

### 5.5 Carga

Skeleton de opciones (si aplica) en el log, no en el pie.

---

## 6. Implementación prevista (tras aprobación)

| Pieza | Dónde |
| --- | --- |
| Default plegado + cabecera compacta | `play-baggage-offer.js` + `play.js` (`baggageHotbarCollapsed = true`) |
| CSS hotbar / título / choices | `web/css/scenes/play.css`, `section-frame.css` (solo override play) |
| Mover chips + progreso examen | `web/js/scenes/play.js` |
| Tests Node | `web/tests/play-baggage-offer.test.js` (default collapsed, head compacta); test de host de choices si se extrae helper |
| Playwright 390×844 | `tmp/playwright-output/play-compose-compact-v1.png` (viaje); un frame first-run chips-en-log; un frame placement |

Sin cambios backend.

---

## 7. Criterios de aceptación

1. Al abrir un reto con oferta de equipaje, la hotbar está **plegada**; el texto del mentor es visible en 390×844.
2. Expandir/plegar persiste entre turnos de la misma sesión play.
3. Plegado: no se ve hint ni «Ver equipaje completo».
4. Expandido: no hay «Usar ahora» por slot; la acción está en el detalle.
5. Título de capítulo de hasta ~48 caracteres se lee completo en ≤ 2 líneas; no desborda los botones de nav.
6. MCQ de aventura: chips en el log; pie = compose (+ hotbar si hay oferta).
7. Placement: chips en el log; «Prueba N de M» no está en el pie; sin textarea.
8. First-run `choose_world`: cartas en el log, **sin** chips duplicados; `choose_gender` y similares: chips en el log.
9. Historial hacia arriba no reactiva chips viejos.
10. Capturas 390×844 en `tmp/playwright-output/` (viaje + umbral o rito).

## Aprobación

- [x] Hotbar plegada por defecto + cabecera de una línea
- [x] Expandido: acción solo en detalle (no botón por slot)
- [x] Título de capítulo: 2 líneas, sin cap 18 rem
- [x] Chips / continue / progreso examen en el log
- [x] Pie = compose (+ hotbar plegada); mismo motor umbral / rito / aventura
- [x] Cartas mundo/zona/camino sin chips duplicados
