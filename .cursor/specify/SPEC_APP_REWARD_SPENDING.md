# Spec: Gasto de moneda y tienda (futuro)

> Estado: **aprobada — horizonte futuro (sin implementar)** (ago 2026)  
> Relacionado: [SPEC_APP_REWARDS_ECONOMY.md](SPEC_APP_REWARDS_ECONOMY.md), [SPEC_APP_INVENTORY_BAGGAGE.md](SPEC_APP_INVENTORY_BAGGAGE.md), [SPEC_APP_ITEM_CATALOG.md](SPEC_APP_ITEM_CATALOG.md)

## Contexto

Las monedas/créditos se acumulan para **gastos** posteriores: lecciones (libros), artefactos de tienda, y sistemas de gamificación. Esta spec **reserva el contrato** para no improvisar saldos negativos ni tiendas ad hoc.

## Objetivo

Documentar el modelo de gasto sin implementarlo en el corte de equipaje visual.

---

## 1. Decisiones (reservadas)

| # | Decisión | Valor provisional |
| --- | --- | --- |
| S1 | Tienda | Catálogo `ShopOffer` por mundo |
| S2 | Débito | Solo `RewardEconomyService.spend(grant_key, amount)` atómico |
| S3 | Productos | `lesson_book`, `item_pack`, `cosmetic`, `gamification_boost` |
| S4 | Tutor | Puede ver historial de gastos; compra la inicia el viajero en play (o tutor en ficha — TBD) |
| S5 | Reembolsos | No en v1 |

---

## 2. Esquema futuro

```ts
interface ShopOffer {
  id: string;
  world_theme: "fantasy" | "sci-fi";
  price: number;
  product_kind: "lesson_book" | "item_pack" | "cosmetic" | "gamification_boost";
  payload: Record<string, unknown>;  // item_def_id, lesson_id, …
  label_child: string;
}
```

```sql
-- futuro
-- child_wallets.lifetime_spent ya existe; cada spend ++ spent -- balance
```

---

## 3. UI futura

- Tab Equipaje tutor: sección «Tienda» colapsada o ruta `#/crew/:id/shop`.
- Play: desde vista equipaje, CTA «Mercado» / «Bazar estelar».

---

## 4. No hacer ahora

- Endpoints de compra.
- UI de tienda.
- Precio de ítems del seed (salvo `fallback_currency` de economía).

## Aprobación

- [ ] Reserva de modelo aceptada (sin implementar)
- [ ] Confirmado: corte actual = ganar + visualizar solamente
