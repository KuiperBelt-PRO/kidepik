# Spec: Oferta de equipaje inline en retos (play)

> Estado: **aprobada — implementada** (15 ago 2026)  
> Relacionado: [SPEC_APP_PLAY_BAGGAGE_TOGGLE.md](SPEC_APP_PLAY_BAGGAGE_TOGGLE.md), [SPEC_APP_REWARD_EFFECTS.md](SPEC_APP_REWARD_EFFECTS.md), [SPEC_APP_INVENTORY_BAGGAGE.md](SPEC_APP_INVENTORY_BAGGAGE.md), [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md)  
> **Diagrama:** [19-rewards-inventory.md](../diagrams/19-rewards-inventory.md)

## Contexto

El viajero puede tener ítems ligados a materias. El toggle equipaje existe pero obliga a salir del diálogo. Esta spec añade **chips de atajo** en el pie del reto.

## Objetivo

1. `baggage_offers[]` en respuestas `open` / `submit_turn` / `baggage/use`.
2. Franja compacta en el pie de play (**plegada por defecto**; cuerpo = tira de iconos). Contrato UI: [SPEC_APP_PLAY_COMPOSE_COMPACT.md](SPEC_APP_PLAY_COMPOSE_COMPACT.md).
3. Máx. 3 slots + «Ver equipaje completo» (solo con hotbar expandida) → vista baggage.
4. Idempotencia por `challenge_ref` vía `path_progress.helps`.

## Decisiones

| # | Decisión | Valor |
| --- | --- | --- |
| B1 | Fases | `path_challenge`, `path_intro` con `retry` |
| B2 | Filtro | `usable_now && can_use && materia del reto ∈ item.subject_ids` |
| B3 | Máximo | 3 chips visibles |
| B4 | Retry | Priorizar `challenge_retry` si `eligible_retry` |
| B5 | Uso | Mismo `POST …/baggage/{id}/use` |

## Implementación

- Servicio: `backend/app/services/baggage_offers.py`
- UI: `web/js/scenes/play.js` + `web/css/scenes/play.css`
- Campo respuesta: `baggage_offers` top-level

## Criterios de aceptación

1. Reto math con pergamino usable → chip visible.
2. Tap → pista o reintento sin cambiar hash.
3. Sin ítems aplicables → sin franja.
4. «Ver todo» abre toggle baggage.
