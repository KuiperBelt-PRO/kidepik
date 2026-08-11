# Spec: Catálogo de objetos de equipaje (fantasy / sci-fi)

> Estado: **aprobada — implementada parcialmente** (ago 2026)  
> Relacionado: [SPEC_APP_INVENTORY_BAGGAGE.md](SPEC_APP_INVENTORY_BAGGAGE.md), [SPEC_APP_REWARDS_ECONOMY.md](SPEC_APP_REWARDS_ECONOMY.md), [SPEC_APP_REWARD_EFFECTS.md](SPEC_APP_REWARD_EFFECTS.md), [SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md), [SPEC_APP_WORLD_GLOSSARY.md](SPEC_APP_WORLD_GLOSSARY.md)  
> **Diagrama:** [19-rewards-inventory.md](../diagrams/19-rewards-inventory.md)

## Contexto

Las posesiones del viajero apuntan a **definiciones versionadas** (`item_def_id`). El catálogo traduce pedagogía (materias, efectos) a sabor de mundo (poción vs programa).

## Objetivo

1. Esquema de definición de ítem.
2. Taxonomía por mundo.
3. Seed MVP (mínimo jugable) + reglas de extensión.
4. Ubicación en repo (`backend/app/catalogs/` + opcional JSONL).

---

## 1. Decisiones

| # | Decisión | Valor |
| --- | --- | --- |
| C1 | Fuente | Código Python `ItemCatalog` + JSON versionado bajo `data/items/` |
| C2 | Ids | Estables snake; prefijo `fantasy_` / `scifi_` |
| C3 | i18n MVP | Castellano en catálogo (`label_child`, `label_tutor`, `description_child`) |
| C4 | Arte | `icon_id` procedural / slot `// ART_SLOT: item-*` (assets reales = futuro) |
| C5 | Glosario | Labels pueden alinearse con términos `artifact` del glosario; **no** duplicar defs en DuckDB |
| C6 | LLM | Puede **elegir** entre `item_def_id` candidatos del pack; no inventar ids nuevos en runtime |

---

## 2. Esquema

```ts
type ItemKindFantasy = "potion" | "artifact" | "charm" | "relic";
type ItemKindScifi = "program" | "artifact" | "module" | "tech";
type ItemKind = ItemKindFantasy | ItemKindScifi;

type ItemRarity = "common" | "uncommon" | "rare";

type ItemEffectId =
  | "challenge_hint"       // pista en reto
  | "challenge_retry"      // repetir reto fallido
  | "skip_wait_token"      // futuro: acortar espera
  | "unlock_minigame"      // futuro
  | "avatar_cosmetic";     // futuro IA avatar

interface ItemDef {
  id: string;
  world_theme: "fantasy" | "sci-fi";
  kind: ItemKind;
  rarity: ItemRarity;
  label_child: string;
  label_tutor: string;
  description_child: string;     // 1–2 frases, sin spoilers de solución
  description_tutor?: string;
  icon_id: string;
  subject_ids: string[];         // ≥1; ids de SubjectCatalog
  effects: ItemEffectId[];       // ≥1 declarado; puede estar disabled en runtime
  stackable: boolean;            // default true si common
  unique: boolean;               // default false; si true → qty max 1
  fallback_currency: number;     // si soft-cap bloquea grant
  duplicate_currency: number;    // si unique ya poseído
  min_general_level?: "L1" | "L2" | "L3" | "L4" | "L5";
  age_bands?: string[];          // si omitido: todas
}
```

Validación al cargar catálogo (tests):

- `id` único; prefijo coherente con `world_theme`.
- `subject_ids` ⊆ SubjectCatalog.
- `effects` ⊆ enum.
- `kind` ∈ set del mundo.
- `fallback_currency` ≥ 1 si `stackable` o unique pueden fallar.

---

## 3. Taxonomía por mundo

### 3.1 Fantasía

| `kind` | Rol diegético | Uso típico |
| --- | --- | --- |
| `potion` | Consumible | Pista / reintento |
| `charm` | Amuleto menor | Pista |
| `artifact` | Objeto de aventura | Pista o cosmético futuro |
| `relic` | Rare | Unlock / avatar futuro |

### 3.2 Sci-fi

| `kind` | Rol diegético | Uso típico |
| --- | --- | --- |
| `program` | Software consumible | Pista / reintento |
| `module` | Componente | Pista |
| `artifact` | Artefacto de ruta | Mixto |
| `tech` | Gadgets | Unlock / avatar futuro |

---

## 4. Seed MVP (mínimo)

Al menos **2 ítems por materia base** del niño (math, language, reading, logic, science) × 2 mundos = orientación; no hace falta cubrir las 14 materias el día 1.

### 4.1 Fantasía (ejemplos normativos)

| `id` | kind | subjects | effects | rarity |
| --- | --- | --- | --- | --- |
| `fantasy_potion_focus_math` | potion | math | challenge_hint | common |
| `fantasy_charm_second_chance_math` | charm | math | challenge_retry | uncommon |
| `fantasy_potion_focus_language` | potion | language | challenge_hint | common |
| `fantasy_charm_second_chance_reading` | charm | reading | challenge_retry | uncommon |
| `fantasy_artifact_logic_lens` | artifact | logic | challenge_hint | uncommon |
| `fantasy_relic_science_orb` | relic | science | challenge_hint, avatar_cosmetic | rare |

Labels ejemplo:

- `fantasy_potion_focus_math` → niño: «Poción de números claros» · tutor: «Pista · Matemáticas»
- `fantasy_charm_second_chance_math` → niño: «Amuleto de segundo intento» · tutor: «Reintento · Matemáticas»

### 4.2 Sci-fi (ejemplos normativos)

| `id` | kind | subjects | effects | rarity |
| --- | --- | --- | --- | --- |
| `scifi_program_hint_math` | program | math | challenge_hint | common |
| `scifi_module_retry_math` | module | math | challenge_retry | uncommon |
| `scifi_program_hint_language` | program | language | challenge_hint | common |
| `scifi_module_retry_reading` | module | reading | challenge_retry | uncommon |
| `scifi_artifact_logic_scanner` | artifact | logic | challenge_hint | uncommon |
| `scifi_tech_science_probe` | tech | science | challenge_hint, avatar_cosmetic | rare |

---

## 5. Ubicación en repo

```
data/items/
  fantasy.v1.json
  sci-fi.v1.json
backend/app/catalogs/item_catalog.py   # carga + validate + get(id)
```

`ItemCatalog.get(id) -> ItemDef`; `list_for_world(theme)`; `list_for_subject(theme, subject_id)`.

Versionado: bump `v1` → `v2` solo si hay breaking change de ids; labels pueden editarse in-place.

---

## 6. Selección en path planner

Al cerrar un camino de materia `S`:

1. Candidatos = defs con `world_theme` activo ∧ `S ∈ subject_ids` ∧ `min_general_level` OK ∧ age_band OK.
2. Preferir `common` si el niño tiene &lt; 3 ítems de esa materia; si no, `uncommon`.
3. `rare` solo en cierre de camino o hitos especiales.
4. Persistir `item_def_id` elegido en el `RewardOffer` **antes** de narrar.

---

## 7. Criterios de aceptación

1. Catálogo carga en arranque API; fallo de validación → error de boot en tests.
2. ≥ 6 defs fantasy + ≥ 6 sci-fi en seed.
3. Toda def tiene ≥1 `subject_id` y ≥1 `effect`.
4. Path planner solo ofrece ids existentes.
5. pytest parametrizado por cada def del seed.

## Aprobación

- [ ] Esquema ItemDef
- [ ] Taxonomía dual
- [ ] Seed MVP §4
- [ ] Política planner §6
