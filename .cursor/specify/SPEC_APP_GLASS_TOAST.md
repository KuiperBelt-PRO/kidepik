# SPEC — Notificaciones glass flotantes

**Estado:** implementada · jul 2026  
**Ámbito:** cliente `web/` — componente reutilizable  
**Relacionado:** [DESIGN.md](../DESIGN.md), [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md)

## Objetivo

Mostrar avisos transitorios (errores API, confirmaciones, información) sin ensuciar el contenido de la escena. Mismo lenguaje visual glass que el resto de la app autenticada.

## API JS

Módulo: `web/js/components/glass-toast.js`

| Función | Uso |
| --- | --- |
| `showGlassToast(message, { variant, durationMs })` | Muestra toast; `variant`: `error` \| `warning` \| `success` \| `info` |
| `mapPlayApiError(code)` | Traduce códigos `detail` de play/dialogue a copy amigable |

El host `#glass-toast-host` se crea bajo `document.body` si no existe.

## Variantes visuales

| Variant | Color acento | Icono glass | `role` ARIA |
| --- | --- | --- | --- |
| `error` | rojizo (`#FF6B63`) | `danger` | `alert` |
| `warning` | amarillento (`#FFD166`) | `note` | `status` |
| `success` | verde (`#7BE495`) | `save` | `status` |
| `info` | blanco/azulado | `note` | `status` |

Estilos: `web/css/components/glass-toast.css`.

## Comportamiento

1. Aparece con animación suave desde abajo (220 ms).
2. Auto-dismiss ~5,2 s (configurable).
3. Tap/click cierra inmediatamente.
4. Múltiples toasts apilados en columna; no bloquean interacción del marco salvo el propio toast.
5. Posición: abajo a la derecha, apiladas en columna; no tapan el compose.
6. Cierre con botón ✕; errores persistentes por defecto (`persist: true` o `durationMs: 0`).

## Integración actual

- **Play / diálogo:** errores de turno (`display_name invalid`, sesión caducada, etc.) vía toast; el log de chat no muestra texto de error inline.
- **Tripulación (ficha):** botones «Guardar perfil», «Guardar permisos» y «Guardar materias» — estado busy en el botón (`pending` + «Guardando…») y toast `success` / `error` / `warning` (validación cliente).
- **Cuenta:** botón «Guardar» del nombre — mismo patrón busy + toast `success`; errores API también en texto inline del campo.
- **Ajustes:** auto-guardado con debounce mantiene feedback inline breve; acciones puntuales (p. ej. limpiar caché) usan toast cuando aplique.

### Acciones PATCH sin recarga de vista

Para botones que **no** navegan ni reemplazan el panel:

| Fase | Comportamiento |
| --- | --- |
| Durante request | Botón `disabled` + `aria-busy` + icono `pending` + label «Guardando…» (`runGlassButtonAction`) |
| Éxito | Toast `success` ~2,4 s |
| Error API | Toast `error` (persistente por defecto) |
| Validación cliente | Toast `warning` sin entrar en estado busy |

Helper: `runGlassButtonAction(btn, run, { successMessage, errorMessage, busyLabel })` en `glass-controls.js`.

## Criterios de aceptación

- [x] Cuatro variantes con icono y color distintivo
- [x] Reutilizable desde cualquier escena autenticada
- [x] Demo interactiva en `web/tmp/glass-controls-demo.html`
- [x] Play no muestra `display_name invalid` como texto plano en el log
- [x] CSS enlazado en `web/index.html`
- [x] Guardados explícitos en ficha tripulante y cuenta muestran progreso en botón + toast final
