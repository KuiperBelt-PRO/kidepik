# Spec: Pestaña Equipaje en ficha de tripulante (tutor)

> Estado: **aprobada — implementada parcialmente** (ago 2026)  
> **Delta 15 ago 2026:** inventario tipo RPG (slots + glifos por `icon_id` + currency chip). Nombre visible = `instance_name`. Tabs ficha: Detalles / Viaje / Progreso / Equipaje / Ajustes.  
> Relacionado: [SPEC_APP_CREW_MEMBER_DETAIL.md](SPEC_APP_CREW_MEMBER_DETAIL.md), [SPEC_APP_INVENTORY_BAGGAGE.md](SPEC_APP_INVENTORY_BAGGAGE.md), [SPEC_APP_REWARDS_ECONOMY.md](SPEC_APP_REWARDS_ECONOMY.md), [SPEC_APP_ITEM_CATALOG.md](SPEC_APP_ITEM_CATALOG.md), [SPEC_APP_SECTION_FRAME.md](SPEC_APP_SECTION_FRAME.md), [DESIGN.md](../DESIGN.md), [SPEC_APP_PRODUCT_BACKLOG_AGO2026.md](SPEC_APP_PRODUCT_BACKLOG_AGO2026.md)

## Contexto

El tutor necesita ver el **equipaje y la moneda** del tripulante sin entrar en play. Se añade una pestaña **Equipaje** en `#/crew/:childId`.

## Objetivo

1. Cuarta pestaña en la ficha: **Equipaje**.
2. Mostrar wallet + grid de objetos del mundo seleccionado.
3. Detalle de ítem (materias, usabilidad, rareza) en lenguaje tutor.
4. Paridad visual glass con Viaje / Ajustes.

---

## 1. Navegación de pestañas (delta)

Sustituye / amplía la matriz de [SPEC_APP_CREW_MEMBER_DETAIL](SPEC_APP_CREW_MEMBER_DETAIL.md) y backlog B3:

| Tab | `data-crew-tab` | Contenido |
| --- | --- | --- |
| **Detalles** | `details` | Perfil/identidad |
| **Viaje** | `journey` | Mapa / diario / aventura |
| **Progreso** | `progress` | Rango + materias |
| **Equipaje** | `baggage` | Wallet + grid ítems (**esta spec**) |
| **Ajustes** | `settings` | Permisos, PIN, peligro |

Si el runtime actual solo tiene Viaje | Ajustes, el orden canónico pasa a:

```
[Viaje] [Equipaje] [Ajustes]
```

o, cuando exista Detalles:

```
[Detalles] [Viaje] [Equipaje] [Ajustes]
```

Persistir tab en `sessionStorage` clave `crew-tab:{childId}` (igual que hoy).

Default:

| Estado niño | Tab default |
| --- | --- |
| placement incompleto | `settings` o `journey` (sin cambio respecto reglas actuales) |
| placement completo | última visitada o `journey` |
| — | Equipaje **nunca** es default automático en MVP |

---

## 2. Layout (viewport 390×844)

```
┌─────────────────────────────────┐
│  [←]  logo  Nombre    [→]       │  ← section-frame
├─────────────────────────────────┤
│      [ Hero crew-card ]         │
├─────────────────────────────────┤
│ [Viaje] [Equipaje] [Ajustes]    │
├─────────────────────────────────┤
│  Monedas del reino    🪙 128    │
│  ─────────────────────────────  │
│  Hallazgos (7/20)               │
│  ┌────┐ ┌────┐ ┌────┐           │
│  │icon│ │icon│ │icon│  … scroll │
│  │qty │ │    │ │    │           │
│  └────┘ └────┘ └────┘           │
│  Filtro: [Todas ▾] [materia]    │  ← glass-select opcional
└─────────────────────────────────┘
```

### 2.1 Cabecera de wallet

| Elemento | Fuente |
| --- | --- |
| Label | `wallet.label_tutor` |
| Balance | `wallet.balance` (entero) |
| Icono | `currency-coins` / `currency-credits` |
| Mundo | Si ficha muestra selector de mundo, baggage refetch al cambiar; si no, `active_world_theme` |

Helper: «Se ganan al superar retos en la aventura. El gasto en tienda llegará más adelante.»

### 2.2 Grid de ítems

| Regla | Valor |
| --- | --- |
| Columnas | 3 en 390px (`gap` glass) |
| Celda | Icono + `qty` badge si &gt;1 + rareza borde sutil |
| Tap | Abre detalle (sheet o bloque expandido bajo el grid) |
| Vacío | Skeleton → empty state: «Aún no hay hallazgos en este mundo.» |
| Carga | `fillGlassSkeleton` preset `panel` / filas grid skeleton (3×2) |
| Scroll | Dentro de `.section-frame__scroll` (no scroll anidado opaco) |

Orden: el del `BaggageDto.items` (servidor).

Badge visual si `!usable_now`: overlay sutil + icono info (no ocultar).

### 2.3 Detalle de ítem (tutor)

Al seleccionar:

| Campo | Mostrar |
| --- | --- |
| Título | `label_tutor` |
| Descripción | `description_tutor` \|\| `description_child` |
| Materias | chips `subject_labels` |
| Efectos | labels humanos («Pista en retos», «Reintento», «Próximamente») |
| Estado | Usable / Materia pausada / Próximamente |
| Adquirido | fecha relativa o absoluta corta |
| Acciones | **Ninguna** de gasto/uso en MVP tutor |

Cierre: tap fuera / botón «Cerrar» glass.

---

## 3. Datos

1. Al activar tab `baggage`: `GET /api/v1/crew/{id}/baggage?world_theme=…`
2. Error: toast `error` + empty con reintento botón.
3. No PATCH desde esta pestaña en MVP.

---

## 4. CSS / componentes

| Pieza | Propuesta |
| --- | --- |
| Root | `.crew-baggage` dentro de crew-panel |
| Wallet | `.crew-baggage__wallet` |
| Grid | `.crew-baggage__grid` |
| Celda | `.crew-baggage__cell` + modifiers `--rare` `--unusable` |
| Detalle | `.crew-baggage__detail` o reutilizar glass-modal `size=md` |

Estilos en `web/css/components/crew-baggage.css` (nuevo) importado desde crew.

Iconos: ampliar `shell-ui-icons` con `baggage`, `currency-coins`, `currency-credits`.

---

## 5. Criterios de aceptación

1. Tab **Equipaje** visible en ficha tras placement (y antes: empty wallet 0 + empty items OK).
2. Balance y grid coinciden con API.
3. Ítem de materia inactiva muestra estado no usable.
4. Mundo fantasy vs sci-fi: al cambiar mundo activo (cuando exista UI), el tab refetch.
5. Playwright 390×844: captura `tmp/playwright-output/crew-baggage-tab-v1.png`.
6. Sin botones de compra/uso en MVP.

## 6. Fases

| Fase | Entregable |
| --- | --- |
| **T1** | Tab + wallet + grid + empty/skeleton |
| **T2** | Detalle ítem + filtro por materia |
| **T3** | Historial de grants (si reward_ledger) |

## Aprobación

- [ ] Cuarta pestaña Equipaje
- [ ] Solo lectura tutor MVP
- [ ] Layout §2
