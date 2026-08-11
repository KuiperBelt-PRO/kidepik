# Spec: Vista Equipaje en play (toggle conversación ↔ equipaje)

> Estado: **aprobada — implementada parcialmente** (ago 2026)  
> Relacionado: [SPEC_APP_INVENTORY_BAGGAGE.md](SPEC_APP_INVENTORY_BAGGAGE.md), [SPEC_APP_REWARDS_ECONOMY.md](SPEC_APP_REWARDS_ECONOMY.md), [SPEC_APP_CREW_BAGGAGE_TAB.md](SPEC_APP_CREW_BAGGAGE_TAB.md), [SPEC_APP_PLAY_PROGRESS_HUD.md](SPEC_APP_PLAY_PROGRESS_HUD.md), [SPEC_APP_SECTION_FRAME.md](SPEC_APP_SECTION_FRAME.md), [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md), [SPEC_APP_JOURNEY_CHAPTERS.md](SPEC_APP_JOURNEY_CHAPTERS.md), [DESIGN.md](../DESIGN.md)

## Contexto

El viajero debe poder **consultar su equipaje y moneda** durante la aventura sin salir de `#/play/:childId`. La conversación y el equipaje comparten el cajetín; un **toggle** en la esquina superior derecha (slot del botón «adelante» de navegación) cambia de vista.

## Objetivo

1. Sustituir el control **forward** del marco en play por un toggle Equipaje / Conversación.
2. Vista equipaje: wallet + grid scrollable (paridad conceptual con tutor, copy niño).
3. No perder estado de diálogo al volver (solo ocultar, no desmontar historial si es viable).
4. Mantener pie (compose / opciones) coherente por modo.

---

## 1. Decisiones

| # | Decisión | Valor |
| --- | --- | --- |
| P1 | Slot UI | Esquina **superior derecha** del cajetín = `section-frame__nav-btn--forward` |
| P2 | Forward en play | **Desactivado**: `mountSectionFrame({ navigation: { forward: false } })` **o** reutilizar el nodo derecho como toggle (preferido: **reemplazar** el botón derecho) |
| P3 | Atrás | Se mantiene (salida / pila shell) |
| P4 | Modos | `dialogue` \| `baggage` |
| P5 | Persistencia modo | Solo en memoria de escena; al reentrar play → `dialogue` |
| P6 | Capítulos + HUD nivel | Siguen visibles en **ambos** modos (cabecera fija) |
| P7 | Footer | En `baggage`: ocultar compose/opciones/exam-progress; mostrar hint corto opcional |
| P8 | Onboarding / placement | Toggle **visible** pero baggage puede estar vacío; no bloquea |
| P9 | Uso de ítems | P2 ([SPEC_APP_REWARD_EFFECTS](SPEC_APP_REWARD_EFFECTS.md)); MVP = ver + detalle |

---

## 2. Control toggle (cabecera)

### 2.1 Apariencia

| Estado modo | Icono | `aria-label` | `aria-pressed` |
| --- | --- | --- | --- |
| `dialogue` (default) | `baggage` (mochila / cofre) | «Ver equipaje» | `false` |
| `baggage` | `chat` / `dialogue` (burbujas) | «Volver a la conversación» | `true` (pressed = estamos en baggage; o invertir: pressed cuando baggage) |

Norma a11y: `aria-pressed="true"` cuando la vista activa es **baggage**.

Clase: `section-frame__nav-btn section-frame__nav-btn--baggage-toggle` (misma hit area que forward, ≥ 44px).

### 2.2 Implementación en `section-frame` / play

Opciones (elegir una en implementación; preferida **A**):

| Opción | Descripción |
| --- | --- |
| **A (preferida)** | Play monta frame con `{ forward: false }` y **inyecta** botón derecho custom en el header via API `setHeaderTrailing(el)` |
| **B** | `navigation: true` pero play **reemplaza** listener/icono del forward por toggle (frágil) |

Nueva API sugerida en `mountSectionFrame`:

```ts
setHeaderTrailing(node: HTMLElement | null): void
```

Si `node` no null: no se monta forward; se monta `node` a la derecha.

### 2.3 Motion

- Tap: cambio de vista ≤ 200 ms fade cruzado del contenido scroll (reduced-motion: instantáneo).
- Icono toggle: swap inmediato.

---

## 3. Vista `dialogue` (actual)

Sin cambios de contrato de burbujas / historial / footer salvo que el toggle exista.

---

## 4. Vista `baggage`

### 4.1 Estructura en `.section-frame__scroll`

```
┌─ cabecera fija: logo + capítulo + barra nivel + toggle ─┐
├─ scroll ───────────────────────────────────────────────┤
│  Tus créditos          ✦ 128                           │
│  ───────────────────────────────────────────────────── │
│  ┌────┐ ┌────┐ ┌────┐                                  │
│  │    │ │    │ │    │   grid 3 cols                    │
│  └────┘ └────┘ └────┘                                  │
│  …                                                     │
└────────────────────────────────────────────────────────┘
┌─ footer: vacío o «Elige un objeto para ver qué hace» ──┐
```

### 4.2 Wallet (niño)

| Campo | Copy |
| --- | --- |
| Label | `wallet.label_child` («Monedas» / «Créditos») |
| Balance | número grande legible |
| Helper | «Las ganas al superar retos.» |

### 4.3 Grid

Mismas reglas de columnas que tutor (3). Copy:

- `label_child` bajo el icono (ellipsis 1 línea) **o** solo icono + qty (preferir icono+qty; nombre en detalle).
- `!usable_now`: candado suave / opacidad 0.55.

Tap celda → panel detalle **inline** bajo el wallet (no modal a pantalla completa) o bottom-sheet glass:

| Campo | Niño |
| --- | --- |
| Título | `label_child` |
| Texto | `description_child` |
| Materias | «Sirve para: Matemáticas» (labels) |
| Acción | Si `can_use`: botón «Usar» (P2). Si no: texto `use_blocked_reason` |

### 4.4 Empty / loading

| Estado | UI |
| --- | --- |
| Loading | Skeleton grid (no «Cargando…») |
| Empty | Ilustración mínima + «Tu equipaje está vacío. ¡Sigue la aventura!» |
| Error | Toast error + botón Reintentar en vista |

### 4.5 Datos

- Al **primera** apertura de baggage en la sesión play: `GET /api/v1/play/{id}/baggage`.
- Revalidar al recibir `reward_granted` en effects de turno (si estaba en dialogue, badge opcional en icono toggle: punto).
- Badge punto: clase `is-badge` en el botón hasta que el usuario abra baggage.

---

## 5. Footer por modo

| Modo | Footer |
| --- | --- |
| `dialogue` | Compose / opciones / exam-progress (actual) |
| `baggage` | Footer colapsado o mensaje estático una línea; **sin** input |

Al volver a `dialogue`, restaurar footer según `lastPendingTurn` (estado ya en play.js).

---

## 6. Convivencia con navegación shell

- Pila atrás/adelante del **browser/shell**: el toggle **no** empuja hash ni entradas en `shell-nav-stack`.
- URL permanece `#/play/:childId`.
- Prohibido: `#/play/:id/baggage` en MVP (evita deep-link frágil).

---

## 7. Criterios de aceptación

1. En play, esquina superior derecha = toggle equipaje (no flecha adelante).
2. Tap abre vista baggage; segundo tap (o icono chat) vuelve al diálogo con historial intacto.
3. Wallet + grid reflejan API del mundo activo.
4. Capítulo + barra de nivel (PROGRESS_HUD) visibles en ambos modos.
5. Footer de chat oculto en baggage.
6. Tras `reward_granted`, badge en toggle hasta abrir baggage.
7. Playwright 390×844: `tmp/playwright-output/play-baggage-toggle-v1.png` (dialogue + baggage).
8. Reduced motion sin animación larga.

## 8. Fases

| Fase | Entregable |
| --- | --- |
| **V1** | Toggle + vistas + GET baggage + empty/skeleton |
| **V2** | Detalle ítem + badge on grant |
| **V3** | Usar ítem (effects) desde detalle |

## Aprobación

- [ ] Reemplazo del slot forward en play
- [ ] Modos dialogue/baggage sin cambiar hash
- [ ] Copy niño §4
- [ ] Uso de ítems aplazado a V3 / EFFECTS
