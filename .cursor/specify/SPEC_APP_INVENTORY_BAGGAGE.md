# Spec: Inventario / Equipaje del tripulante

> Estado: **aprobada — implementada parcialmente** (ago 2026)  
> **Delta 15 ago 2026:** `instance_name` por grant; `usable_now` con el mismo resolver de materias que progreso (lista vacía → fallback de banda); copy «Materia en pausa».  
> Relacionado: [SPEC_APP_REWARDS_ECONOMY.md](SPEC_APP_REWARDS_ECONOMY.md), [SPEC_APP_ITEM_CATALOG.md](SPEC_APP_ITEM_CATALOG.md), [SPEC_APP_REWARD_EFFECTS.md](SPEC_APP_REWARD_EFFECTS.md), [SPEC_APP_CREW_BAGGAGE_TAB.md](SPEC_APP_CREW_BAGGAGE_TAB.md), [SPEC_APP_PLAY_BAGGAGE_TOGGLE.md](SPEC_APP_PLAY_BAGGAGE_TOGGLE.md), [SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md), [SPEC_APP_PARALLEL_WORLDS.md](SPEC_APP_PARALLEL_WORLDS.md), [SPEC_DATA_STORAGE_LAYERS.md](SPEC_DATA_STORAGE_LAYERS.md)  
> **Diagrama:** [19-rewards-inventory.md](../diagrams/19-rewards-inventory.md)

## Contexto

El tripulante acumula **objetos** (artefactos, pociones, programas, tecnología…) en un **equipaje** por mundo. Esos objetos se asocian a **materias concretas** (solo las activas del viajero) y, en fases posteriores, se gastan o consumen como pistas, reintentos, etc. ([SPEC_APP_REWARD_EFFECTS](SPEC_APP_REWARD_EFFECTS.md)).

## Objetivo

1. Modelo de instancias de ítem + stack.
2. Reglas de vínculo materia / mundo / usabilidad.
3. API de lectura para tutor y viajero.
4. Separar **definición** (catálogo versionado) de **posesión** (Postgres).

**MVP de producto:** ganar + listar + ver detalle. **Usar / gastar** = contrato en effects (stub UI «Próximamente» o chip deshabilitado hasta P2 effects).

---

## 1. Decisiones

| # | Decisión | Valor |
| --- | --- | --- |
| I1 | Paralelismo | Inventario **por** `(child_id, world_theme)` |
| I2 | Definiciones | Catálogo en código/JSON versionado — [SPEC_APP_ITEM_CATALOG](SPEC_APP_ITEM_CATALOG.md) |
| I3 | Posesión | Filas Postgres `child_inventory_items` |
| I4 | Stack | Misma `item_def_id` se apila (`qty`); no instancias UUID por unidad salvo `unique=true` |
| I5 | Materias | Cada def declara `subject_ids[]` no vacío; uso solo si ∩ `active_subjects` ≠ ∅ |
| I6 | Materia desactivada | Ítem **sigue visible** en equipaje; marcado `usable_now=false` + hint |
| I7 | Capacidad | Soft max slots por banda (§6); exceso → no grant ítem, sí moneda compensación |
| I8 | Tutor | Lectura completa; **no** editar/borrar ítems en MVP (salvo zona peligrosa reset futuro) |
| I9 | Copy niño | Sin jerga `item_def_id`; labels del catálogo |

---

## 2. Modelo de datos

### 2.1 Posesión

```sql
create table public.child_inventory_items (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  world_theme text not null check (world_theme in ('fantasy', 'sci-fi')),
  item_def_id text not null,
  qty integer not null default 1 check (qty >= 1),
  acquired_at timestamptz not null default now(),
  last_used_at timestamptz null,
  meta jsonb not null default '{}'::jsonb,
  instance_name text null,
  instance_description text null
  -- unique (child_id, world_theme, item_def_id) retirada: cada grant nombrado es instancia
);

create index child_inventory_child_world_idx
  on public.child_inventory_items (child_id, world_theme);
```

Para defs con `stackable=false` / `unique=true`: el `unique` compuesto sigue; `qty` siempre 1; un segundo grant del mismo def es no-op o convierte a moneda (política §5).

### 2.2 DTO

```ts
interface InventoryItemDto {
  id: string;                    // uuid fila
  item_def_id: string;
  world_theme: WorldTheme;
  qty: number;
  /** Desde catálogo, resuelto server-side. */
  label_child: string;
  label_tutor: string;
  description_child: string;
  kind: ItemKind;                // potion | artifact | program | tech | …
  rarity: ItemRarity;            // common | uncommon | rare
  icon_id: string;               // procedural / asset slot
  subject_ids: string[];
  subject_labels: string[];      // castellano
  usable_now: boolean;           // ∩ active_subjects
  effects: ItemEffectId[];       // ver REWARD_EFFECTS
  acquired_at: string;
  can_use: boolean;              // usable_now && qty>0 && effect implementado
  use_blocked_reason?: string | null;  // "Materia no activa" | "Próximamente"
}

interface BaggageDto {
  world_theme: WorldTheme;
  wallet: WalletDto;             // embebido para una sola llamada UI
  items: InventoryItemDto[];     // orden: rarity desc, luego acquired_at desc
  slot_count: number;
  slot_soft_max: number;
  empty: boolean;
}
```

---

## 3. Reglas de usabilidad (materias)

```
usable_now =
  def.subject_ids ∩ child.settings.learning.active_subjects ≠ ∅
  AND def.world_theme == child.active_world_theme (en play)
  AND qty >= 1
```

En ficha tutor, el mundo mostrado es el **activo** o el selector de mundo de la ficha (si existe); el tab Equipaje filtra por `world_theme` query.

**Si el tutor desactiva una materia:**

| Caso | UI |
| --- | --- |
| Ítem solo ligado a esa materia | Badge «No usable — materia pausada» |
| Ítem ligado a varias, queda ≥1 activa | Sigue `usable_now=true` |

**Prohibido:** borrar ítems al desactivar materia.

---

## 4. Servicio

`InventoryService`:

| Método | Comportamiento |
| --- | --- |
| `get_baggage(child_id, world_theme)` | Wallet + items hidratados desde catálogo |
| `add(child_id, world_theme, item_def_id, qty, grant_key)` | Upsert stack; respeta unique/soft-cap |
| `consume(child_id, item_row_id, qty, effect_id)` | P2; decrementa qty; borra fila si 0 |
| `can_use(child, item)` | Reglas §3 + effect enabled |

Llamado **solo** desde `RewardEconomyService.grant` / effects runtime — no desde router genérico sin auth.

---

## 5. Políticas de grant de ítem

| Situación | Acción |
| --- | --- |
| Def desconocida | Error servidor; no grant; log `inventory_unknown_def` |
| Def de otro `world_theme` | Rechazar |
| Soft-cap slots alcanzado | No añadir ítem; grant moneda compensación = `def.fallback_currency` (catálogo) |
| Unique ya poseído | No duplicar; compensación moneda `def.duplicate_currency` o 0 |
| `subject_ids` ∩ activas = ∅ en el momento del grant | **Igual se otorga** (coleccionable); `usable_now=false` |

---

## 6. Soft-cap de slots

Cuenta = número de **filas** distintas (`item_def_id`), no suma de `qty`.

| `age_band` | `slot_soft_max` |
| --- | --- |
| early_child | 12 |
| child | 20 |
| teen | 28 |
| adult | 36 |

UI muestra `slot_count / slot_soft_max` solo al tutor; al niño solo si `slot_count >= soft_max - 2` (aviso suave).

---

## 7. API

| Método | Ruta | Quién |
| --- | --- | --- |
| `GET` | `/api/v1/crew/{id}/baggage?world_theme=` | Tutor (JWT) |
| `GET` | `/api/v1/play/{id}/baggage` | Play (mundo activo implícito) |
| `POST` | `/api/v1/play/{id}/baggage/{item_id}/use` | P2 effects |

Auth: mismo ownership que crew/play.

Errores:

| Status | Cuándo |
| --- | --- |
| 404 | Niño no del tutor |
| 422 | `world_theme` inválido |
| 409 | use no disponible (P2) |

---

## 8. Orden y filtros UI (contrato datos)

Orden server default:

1. `usable_now=true` primero  
2. `rarity` rare → common  
3. `acquired_at` desc  

Query opcional (tutor): `?subject_id=math` filtra ítems cuyo `subject_ids` contiene.

---

## 9. Criterios de aceptación

1. Inventarios fantasy y sci-fi independientes.
2. GET baggage hidrata labels desde catálogo (no raw ids en UI).
3. Ítem con materia inactiva: visible, `usable_now=false`.
4. Soft-cap: siguiente grant ítem → moneda fallback + log.
5. Unique: segundo grant no crea segunda fila.
6. pytest: add/stack/unique/cap/usable_now matrix.
7. Contrato HTTP documentado en OpenAPI / tests contract.

## 10. Fases

| Fase | Entregable |
| --- | --- |
| **I1** | Migración + InventoryService + GET crew/play baggage |
| **I2** | Grants desde economía |
| **I3** | POST use + consume (effects) |
| **I4** | Historial usos / meta |

## Aprobación

- [ ] Decisiones I1–I9
- [ ] Modelo PG + DTO
- [ ] Reglas materia §3
- [ ] Soft-cap y unique §5–6
- [ ] Use diferido a P2 / REWARD_EFFECTS
