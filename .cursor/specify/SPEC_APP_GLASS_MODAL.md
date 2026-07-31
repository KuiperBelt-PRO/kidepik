# SPEC — Modales glass (alerta y confirmación)

**Estado:** implementada · jul 2026  
**Ámbito:** cliente `web/` — componente reutilizable  
**Relacionado:** [DESIGN.md](../DESIGN.md), [SPEC_APP_GLASS_TOAST.md](SPEC_APP_GLASS_TOAST.md), [SPEC_APP_CREW_SECTION.md](SPEC_APP_CREW_SECTION.md), [SPEC_APP_ACCOUNT_SECTION.md](SPEC_APP_ACCOUNT_SECTION.md)

## Objetivo

Diálogos centrados con lenguaje glass para avisos informativos y confirmaciones destructivas, sustituyendo `window.alert` / `window.confirm` en superficies autenticadas.

## API JS

Módulo: `web/js/components/glass-modal.js`

| Función | Uso |
| --- | --- |
| `showGlassAlert(options)` | Modal informativo; un botón «Aceptar» / «OK» |
| `showGlassConfirm(options)` | Confirmación; «Cancelar» + CTA principal; devuelve `Promise<boolean>` |
| `syncGlassModalBodyScrollFade(el)` | Sincroniza clase fade en un cuerpo de modal (overflow real) |

Opciones comunes:

| Opción | Tipo | Default |
| --- | --- | --- |
| `title` | `string` | obligatorio |
| `body` | `string \| HTMLElement` | — |
| `footer` | `string` | aviso secundario (p. ej. «no se puede deshacer») |
| `size` | `'sm' \| 'md' \| 'lg' \| 'auto'` | `'md'` |
| `confirmLabel` | `string` | «Aceptar» (alert) / «Aceptar» (confirm) |
| `cancelLabel` | `string` | «Cancelar» |
| `danger` | `boolean` | icono rojizo en CTA principal |
| `closeOnScrim` | `boolean` | `true` (alert: cierra; confirm: cancela) |
| `closeOnEscape` | `boolean` | `true` (igual que scrim) |
| `onConfirm` | `() => Promise<void> \| void` | async handler; deshabilita botones mientras corre |

Estilos: `web/css/components/glass-modal.css`.

## Tipos de modal

### Informativo (`showGlassAlert`)

- Título + cuerpo (texto o HTML).
- Un botón «Aceptar» / «OK» que cierra.
- Sin acción secundaria.

### Confirmación (`showGlassConfirm`)

- Título + cuerpo + opcional `footer` en negrita (aviso irreversible).
- Botones en columna: secundario «Cancelar» (foco inicial) + CTA principal.
- `danger: true` → CTA con icono `danger` coloreado (no chrome rojo).
- Resuelve `true` si confirma, `false` si cancela / scrim / Escape.

### Futuro (no MVP)

- Variante con radiobuttons o checkboxes para elección antes de confirmar.

## Alturas configurables

| `size` | Uso |
| --- | --- |
| `sm` | Avisos cortos (1–2 líneas) |
| `md` | Confirmaciones estándar |
| `lg` | Listas o copy largo |
| `auto` | Crece con contenido hasta el máximo del diálogo |

El **cuerpo** tiene `overflow-y: auto` y altura máxima según `size`. La clase compartida `.glass-scroll-fade` (máscara superior/inferior) se aplica **solo** cuando `scrollHeight > clientHeight`, vía `syncGlassModalBodyScrollFade` al montar y con `ResizeObserver`. Sin overflow: texto completo, sin fade ni scrollbar visible.

## Comportamiento y accesibilidad

1. Montaje bajo `document.body`; scrim semitransparente con blur ligero.
2. `role="dialog"`, `aria-modal="true"`, `aria-labelledby` en el título.
3. Escape y tap en scrim: cerrar (alert) o cancelar (confirm).
4. Foco inicial: botón secundario en confirmación (evitar borrado accidental).
5. Animación entrada fade + scale ≤ 200 ms; `prefers-reduced-motion` → instantáneo.
6. Solo un modal activo; abrir otro cierra el anterior.
7. `z-index` por encima del marco autenticado (mismo nivel que modal cuenta histórico).

## Integración

| Superficie | Uso |
| --- | --- |
| **Tripulación** ficha | `showGlassConfirm` al eliminar tripulante |
| **Cuenta** | `showGlassConfirm` al eliminar cuenta (sustituye modal ad hoc) |
| **Demo** | `web/tmp/glass-controls-demo.html` — alert + confirm + copy largo |

## Criterios de aceptación

- [x] Modal glass informativo con un botón OK/Aceptar
- [x] Modal glass de confirmación con Cancelar + Aceptar
- [x] Cuerpo largo con scroll; fade solo si hay overflow (no en copy corto)
- [x] Alturas `sm` / `md` / `lg` / `auto`
- [x] Eliminar tripulante abre confirmación con aviso de no-undo (no `window.confirm`)
- [x] Eliminar cuenta reutiliza el mismo componente
- [x] Demo interactiva en `glass-controls-demo.html`
