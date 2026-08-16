# 19 — Recompensas, moneda y equipaje

**Specs canónicas (propuesta ago 2026):** [SPEC_APP_REWARDS_ECONOMY.md](../specify/SPEC_APP_REWARDS_ECONOMY.md), [SPEC_APP_INVENTORY_BAGGAGE.md](../specify/SPEC_APP_INVENTORY_BAGGAGE.md), [SPEC_APP_ITEM_CATALOG.md](../specify/SPEC_APP_ITEM_CATALOG.md), [SPEC_APP_REWARD_EFFECTS.md](../specify/SPEC_APP_REWARD_EFFECTS.md), [SPEC_APP_REWARD_SPENDING.md](../specify/SPEC_APP_REWARD_SPENDING.md), [SPEC_APP_CREW_BAGGAGE_TAB.md](../specify/SPEC_APP_CREW_BAGGAGE_TAB.md), [SPEC_APP_PLAY_BAGGAGE_TOGGLE.md](../specify/SPEC_APP_PLAY_BAGGAGE_TOGGLE.md), [SPEC_APP_PLAY_PROGRESS_HUD.md](../specify/SPEC_APP_PLAY_PROGRESS_HUD.md)

```mermaid
flowchart TB
  Path[Nodo / reto superado] --> Offer[RewardOffer código]
  Offer --> Econ[RewardEconomyService]
  Econ --> Wallet[(child_wallets PG)]
  Econ --> Inv[InventoryService]
  Inv --> Items[(child_inventory_items PG)]
  Econ --> Ledger[events.jsonl reward_granted]
  Catalog[ItemCatalog data/items] --> Inv
  Namer[ItemNamer instance_name] --> Inv
  Wallet --> TutorUI[Tab Equipaje ficha]
  Items --> TutorUI
  Wallet --> PlayUI[Play vista baggage]
  Items --> PlayUI
  PlayUI --> Toggle[Toggle slot forward]
  PlayUI --> Offer[Franja chips equipaje en reto]
  Offer --> Use[POST baggage/use]
  Chapter[Título capítulo] --> HUD[play-progress-hud]
  CrewProg[CrewProgressService] --> HUD
```

## Capas

| Dato | Dónde |
| --- | --- |
| Saldo moneda | Supabase `child_wallets` |
| Posesión ítems | Supabase `child_inventory_items` |
| Definiciones | `data/items/*.json` + `ItemCatalog` |
| Narrativa grant | Ledger `reward_granted` |
| Gasto / tienda | Futuro — SPEC_APP_REWARD_SPENDING |

## Anti-errores

- No mezclar wallets fantasy ↔ sci-fi.
- LLM no inventa `item_def_id` ni cantidades; sí nombra la instancia (`instance_name`) o cae a `ItemNamer`.
- Un arquetipo puede ligarse a **varias** materias (`subject_ids[]`); usable si ∩ activas ≠ ∅.
- Placement no otorga economía en MVP.
- Slot derecha en play = toggle equipaje, no forward.
