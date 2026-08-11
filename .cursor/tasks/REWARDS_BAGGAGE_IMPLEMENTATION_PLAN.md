# Plan: Recompensas + equipaje + HUD nivel (ago 2026)

> Specs aprobadas (chat ago 2026). Corte MVP = ganar + visualizar + HUD.

## Fases

| Fase | Entregable | Spec |
| --- | --- | --- |
| R1 | Migración wallets + inventory + reward_grants; services; GET API | REWARDS_ECONOMY, INVENTORY |
| C1 | ItemCatalog + seed JSON | ITEM_CATALOG |
| T1 | Tab Equipaje ficha | CREW_BAGGAGE_TAB |
| V1 | Toggle play + vista baggage | PLAY_BAGGAGE_TOGGLE |
| H1 | HUD progreso bajo capítulo | PLAY_PROGRESS_HUD |
| R2 | `RewardEconomyService.grant` cableado en reto OK (+10) y path complete (+25 + ítem) | REWARDS_ECONOMY |
| X1 | POST use `challenge_hint` / `challenge_retry` + UI Usar en play | REWARD_EFFECTS |
| X/S | Spending / tienda | horizonte futuro |

## Tests

- unit: item_catalog, inventory grant/stack/unique, economy idempotency, play_progress_hud, baggage_use hint/retry
- contract: GET crew/baggage, GET play/baggage, GET play/progress
- Playwright (auth local): tab Equipaje + toggle play + HUD (`tmp/playwright-output/*nora*`)
