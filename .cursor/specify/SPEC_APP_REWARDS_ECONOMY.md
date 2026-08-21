# Spec: Economía de recompensas (moneda + grants)

> Estado: **aprobada — implementada parcialmente** (ago 2026)  
> **Delta 20 ago 2026:** `toast_child` nombra el `instance_name` **primero**; no dice «un hallazgo» genérico si hay nombre.
> Relacionado: [SPEC_APP_INVENTORY_BAGGAGE.md](SPEC_APP_INVENTORY_BAGGAGE.md), [SPEC_APP_ITEM_CATALOG.md](SPEC_APP_ITEM_CATALOG.md), [SPEC_APP_REWARD_SPENDING.md](SPEC_APP_REWARD_SPENDING.md), [SPEC_APP_REWARD_EFFECTS.md](SPEC_APP_REWARD_EFFECTS.md), [SPEC_APP_PARALLEL_WORLDS.md](SPEC_APP_PARALLEL_WORLDS.md), [SPEC_DATA_STORAGE_LAYERS.md](SPEC_DATA_STORAGE_LAYERS.md), [SPEC_APP_JOURNEY_MECHANICS.md](SPEC_APP_JOURNEY_MECHANICS.md), [SPEC_APP_ADVENTURE_SESSION.md](SPEC_APP_ADVENTURE_SESSION.md), [SPEC_AI_JOURNEY_FILE_LEDGER.md](SPEC_AI_JOURNEY_FILE_LEDGER.md)  
> **Diagrama:** [19-rewards-inventory.md](../diagrams/19-rewards-inventory.md)

## Contexto

El viaje debe **recompensar** al tripulante al superar retos y nodos del camino: objetos al **equipaje** y/o **moneda del mundo**. La moneda se acumula para usos futuros (tienda, lecciones, gamificación). Esta spec fija el **modelo económico** y las **reglas de otorgamiento**; el gasto queda en [SPEC_APP_REWARD_SPENDING](SPEC_APP_REWARD_SPENDING.md) (futuro).

## Objetivo

1. Definir monedas duales por mundo (fantasía / sci-fi).
2. Definir tipos de recompensa de camino (ítem vs moneda vs mixto).
3. Definir cuándo y cómo el servidor **otorga** recompensas (idempotente, auditable).
4. Separar verdad de saldo (Postgres) de narrativa de grant (ledger).

**Fuera de alcance MVP de gasto:** comprar libros/artefactos, canjear créditos en minijuegos. Solo **ganar + visualizar**.

---

## 1. Decisiones

| # | Decisión | Valor |
| --- | --- | --- |
| E1 | Paralelismo | Saldo y grants **por** `(child_id, world_theme)` — no mezclar monedas fantasy↔sci-fi |
| E2 | Nombres UI | Fantasy → **monedas**; sci-fi → **créditos** (`currency_kind`) |
| E3 | Unidad | Entero ≥ 0; sin decimales en MVP |
| E4 | Fuente de verdad saldo | **Supabase** (`child_wallets`) |
| E5 | Auditoría / narrativa | Ledger `events.jsonl` kind `reward_granted` (+ opcional fila PG `reward_ledger` para UI tutor) |
| E6 | Quién decide el premio | **Código** (tablas de nodos / path rewards) + opcional sugerencia LLM en `meta` **nunca** como verdad |
| E7 | Placement | La prueba de acceso **no** otorga moneda ni ítems en MVP (solo niveles/rango) |
| E8 | Capacidad | Soft-cap de saldo opcional por banda (tabla §6); hard-cap no en MVP |
| E9 | Idempotencia | Cada grant lleva `grant_key` único; re-ejecutar el mismo hito **no** duplica saldo/ítem |

---

## 2. Moneda del mundo

### 2.1 Identidad

```ts
type WorldTheme = "fantasy" | "sci-fi";
type CurrencyKind = "coins" | "credits";

function currencyKindFor(theme: WorldTheme): CurrencyKind {
  return theme === "fantasy" ? "coins" : "credits";
}
```

| `world_theme` | `currency_kind` | Label niño | Label tutor |
| --- | --- | --- | --- |
| `fantasy` | `coins` | Monedas | Monedas del reino |
| `sci-fi` | `credits` | Créditos | Créditos de ruta |

Iconografía: id procedural `currency-coins` / `currency-credits` (añadir a catálogo shell UI).

### 2.2 Tabla Postgres

```sql
create table public.child_wallets (
  child_id uuid not null references public.children(id) on delete cascade,
  world_theme text not null check (world_theme in ('fantasy', 'sci-fi')),
  balance integer not null default 0 check (balance >= 0),
  lifetime_earned integer not null default 0 check (lifetime_earned >= 0),
  lifetime_spent integer not null default 0 check (lifetime_spent >= 0),
  updated_at timestamptz not null default now(),
  primary key (child_id, world_theme)
);
```

Invariantes:

- `lifetime_earned - lifetime_spent = balance` (mantenido por servicio; test de invariante).
- Crear fila con `balance=0` al primer acceso al mundo o al primer grant.
- **Prohibido** saldo negativo.

### 2.3 DTO

```ts
interface WalletDto {
  world_theme: WorldTheme;
  currency_kind: CurrencyKind;
  balance: number;
  label_child: string;   // "Monedas" | "Créditos"
  label_tutor: string;
}
```

---

## 3. Tipos de recompensa de nodo

Un **nodo de camino** (beat / challenge / quest step / path milestone) declara un `RewardOffer`:

```ts
type RewardOfferKind =
  | "item"           // solo objeto al equipaje
  | "currency"       // solo moneda
  | "item_or_work"   // elección: ítem gratis vs trabajo → moneda
  | "mixed";         // ítem + moneda fijos (sin elección)

interface RewardOffer {
  offer_id: string;                 // estable en catálogo de camino
  kind: RewardOfferKind;
  /** Moneda otorgada si aplica (fija o tras «trabajo»). */
  currency_amount?: number;         // entero ≥ 1
  /** Ítem de catálogo si aplica. */
  item_def_id?: string;
  item_qty?: number;                // default 1
  /** Copy diegético (opcional; LLM puede vestir, no inventar cantidades). */
  narrative_hook?: string;
  /** Si kind=item_or_work: copy de la opción «trabajar». */
  work_label_child?: string;
  /** Materias que «validan» el trabajo (reto extra); subset de activas. */
  work_subject_ids?: string[];
}
```

### 3.1 Semántica por `kind`

| `kind` | Comportamiento |
| --- | --- |
| `item` | Al completar el nodo → `grant_item` |
| `currency` | Al completar → `grant_currency` |
| `mixed` | Completar → ítem **y** moneda (ambos fijos) |
| `item_or_work` | Tras completar el nodo narrativo, UI ofrece **2 chips**: «Guardar [ítem]» **o** «[Trabajo] por N monedas/créditos». Solo una se aplica. |

### 3.2 Quién emite el `RewardOffer`

| Fuente | Rol |
| --- | --- |
| Path pack / challenge planner (código) | Cantidades, `item_def_id`, `kind` |
| LLM (`zone_scene_writer` / mentor) | Solo prosa que **menciona** el premio ya decidido |
| Tutor | No edita grants en MVP |

**Prohibido:** el LLM inventar `currency_amount` o `item_def_id` que el servidor no haya puesto en el envelope.

---

## 4. Ciclo de grant (servidor)

```mermaid
flowchart TD
  A[Nodo superado / elección work|item] --> B{¿grant_key ya existe?}
  B -- sí --> Z[No-op idempotente]
  B -- no --> C[Validar offer + mundo activo]
  C --> D{Tipo}
  D -- currency --> E[UPDATE child_wallets]
  D -- item --> F[InventoryService.add]
  D -- mixed --> E
  D -- mixed --> F
  E --> G[Append reward_granted ledger]
  F --> G
  G --> H[Opcional INSERT reward_ledger PG]
  H --> I[DTO effects en respuesta turno]
```

### 4.1 `grant_key`

Formato normativo:

```
{child_id}:{world_theme}:{session_id}:{offer_id}:{choice?}
```

`choice` ∈ `item` | `work` | `auto` según el caso.

### 4.2 Effects en respuesta de turno (play)

```ts
interface RewardGrantedEffect {
  type: "reward_granted";
  grant_key: string;
  wallet?: WalletDto;           // saldo tras grant
  items_added?: InventoryItemDto[];
  toast_child?: string;         // 1 frase; UI toast info + recap de camino
}
```

Copy de `toast_child` (servidor; se pega al recap de camino y al toast glass):

| Caso | Frase |
| --- | --- |
| Ítem + moneda | `¡Has encontrado {instance_name} y {n} créditos/monedas!` |
| Solo ítem | `¡Has encontrado {instance_name}!` |
| Solo moneda | `¡Has ganado {n} créditos/monedas!` |

El **nombre concreto** va antes de la moneda. Prohibido «un hallazgo» genérico cuando hay `instance_name`. Fallback «un hallazgo» solo si el grant de ítem no trae nombre.

El cliente play actualiza HUD de equipaje / wallet sin recargar página.

### 4.3 Ledger (archivos)

En `data/journey/{parent}/{child}/worlds/{theme}/sessions/{id}/events.jsonl`:

```json
{
  "kind": "reward_granted",
  "ts": "2026-08-11T10:00:00Z",
  "grant_key": "...",
  "offer_id": "path_alpha_node_2",
  "currency_delta": 15,
  "item_def_id": "fantasy_potion_focus_math",
  "item_qty": 1,
  "choice": "item"
}
```

---

## 5. Tabla opcional de auditoría tutor (`reward_ledger`)

Preferencia MVP: **solo ledger archivos** + saldo PG. Si la ficha tutor necesita historial filtrable sin DuckDB:

```sql
create table public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  world_theme text not null,
  grant_key text not null unique,
  offer_id text not null,
  currency_delta integer not null default 0,
  item_def_id text null,
  item_qty integer not null default 0,
  created_at timestamptz not null default now()
);
```

Fase: **P2** si el tab Equipaje pide «historial de hallazgos».

---

## 6. Cantidades sugeridas (catálogo de diseño — ajustable)

| Evento | Moneda (rango) | Ítem |
| --- | --- | --- |
| Reto de camino aprobado a la 1ª | 8–20 | 0–1 (rareza común) |
| Reto aprobado tras pista / reintento | 4–12 | 0 |
| Cierre de camino (3 retos) | 25–40 | 1 garantizado de materia del path |
| Nodo «trabajo» elegido | `currency_amount` del offer (típicamente 1.5× el valor implícito del ítem) | 0 |
| Placement | 0 | 0 |

Soft-cap saldo por `age_band` (hint tutor, no bloqueo duro en MVP):

| Banda | Soft-cap |
| --- | --- |
| early_child | 200 |
| child | 500 |
| teen | 1000 |
| adult | 2000 |

---

## 7. API

| Método | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/api/v1/crew/{id}/wallet?world_theme=` | Tutor / play resumen |
| `GET` | `/api/v1/play/{id}/economy` | Bundle wallet + flags UI (play) |

El grant **no** es endpoint público del cliente: solo efectos de `submit_turn` / servicios internos.

Respuesta `economy`:

```ts
interface PlayEconomyDto {
  world_theme: WorldTheme;
  wallet: WalletDto;
  pending_offer: RewardOffer | null;  // si hay elección item_or_work abierta
}
```

---

## 8. Servicio

`RewardEconomyService` (FastAPI):

| Método | Contrato |
| --- | --- |
| `get_wallet(child_id, world_theme)` | Crea fila si no existe |
| `grant(child_id, world_theme, offer, choice, grant_key, session_id)` | Idempotente; actualiza wallet + inventory |
| `list_recent_grants(...)` | P2 |

Transacción DB: wallet + inventory en **la misma** transacción Postgres.

---

## 9. Relación con materias

- La moneda **no** está ligada a una materia.
- Los **ítems** sí ([SPEC_APP_INVENTORY_BAGGAGE](SPEC_APP_INVENTORY_BAGGAGE.md) § subjects).
- En `item_or_work`, `work_subject_ids` deben intersectar materias **activas**; si la intersección es vacía → degradar a `currency` fijo sin elección.

---

## 10. Criterios de aceptación

1. Dos wallets independientes fantasy/sci-fi por niño.
2. Grant duplicado con mismo `grant_key` no cambia saldo.
3. Placement no modifica wallet ni inventario.
4. `submit_turn` que completa nodo con `currency` incrementa `balance` y emite `reward_granted`.
5. `item_or_work`: elegir ítem no da moneda; elegir trabajo no da ítem.
6. Labels niño/tutor correctos por mundo.
7. pytest: invariante `earned - spent = balance`; idempotencia; paralelo mundos.

## 11. Fases

| Fase | Entregable |
| --- | --- |
| **R1** | Migración `child_wallets` + service + GET wallet/economy |
| **R2** | Grants desde cierre de reto/camino + effects en turno |
| **R3** | UI elección `item_or_work` en play |
| **R4** | `reward_ledger` PG + historial tutor (opcional) |

## Aprobación

- [ ] Decisiones E1–E9
- [ ] Modelo wallet + grant_key
- [ ] Offer kinds §3
- [ ] Placement sin economía MVP
- [ ] Gasto aplazado a SPEC_APP_REWARD_SPENDING
