from __future__ import annotations

from typing import Any

from sqlalchemy import text

from app.catalogs.item_catalog import ItemCatalog
from app.catalogs.item_namer import ItemNamer
from app.db import session_scope
from app.services.inventory import InventoryService


class RewardEconomyService:
    def __init__(self, inventory: InventoryService | None = None) -> None:
        self.inventory = inventory or InventoryService()

    async def get_wallet(self, child_id: str, world_theme: str) -> dict[str, Any]:
        return await self.inventory.get_wallet(child_id, world_theme)

    async def grant(
        self,
        child_id: str,
        world_theme: str,
        *,
        grant_key: str,
        offer_id: str,
        currency_amount: int = 0,
        item_def_id: str | None = None,
        item_qty: int = 1,
        age_band: str | None = None,
        session_id: str | None = None,
        instance_name: str | None = None,
        instance_description: str | None = None,
        agent_name: str | None = None,
    ) -> dict[str, Any]:
        """Idempotent grant. Returns wallet + items_added + skipped flag."""
        theme = self.inventory.normalize_theme(world_theme)
        key = str(grant_key or "").strip()
        if not key:
            raise ValueError("grant_key required")
        currency_amount = max(0, int(currency_amount or 0))
        item_qty = max(1, int(item_qty or 1))
        async with session_scope() as session:
            existing = (
                await session.execute(
                    text("select grant_key from public.reward_grants where grant_key = :k"),
                    {"k": key},
                )
            ).mappings().first()
            if existing:
                wallet = await self.inventory.get_wallet(child_id, theme)
                return {
                    "skipped": True,
                    "grant_key": key,
                    "wallet": wallet,
                    "items_added": [],
                    "currency_delta": 0,
                }

            await self.inventory._ensure_wallet(session, child_id, theme)
            currency_delta = currency_amount
            items_meta: list[dict[str, Any]] = []

            if item_def_id:
                defn = ItemCatalog.require(item_def_id)
                named = ItemNamer.propose(
                    world_theme=theme,
                    kind=str(defn["kind"]),
                    subject_ids=list(defn["subject_ids"]),
                    grant_key=key,
                    agent_name=agent_name or instance_name,
                    fallback=str(defn.get("label_child") or ""),
                    effects=list(defn.get("effects") or []),
                )
                result = await self.inventory.add_item(
                    session,
                    child_id,
                    theme,
                    item_def_id,
                    item_qty,
                    age_band=age_band,
                    instance_name=named,
                    instance_description=instance_description,
                )
                if result.get("added"):
                    items_meta.append(
                        {
                            "item_def_id": item_def_id,
                            "qty": item_qty,
                            "instance_name": named,
                        }
                    )
                else:
                    currency_delta += int(result.get("currency_compensation") or 0)

            if currency_delta > 0:
                await session.execute(
                    text(
                        """
                        update public.child_wallets
                        set balance = balance + :amt,
                            lifetime_earned = lifetime_earned + :amt,
                            updated_at = now()
                        where child_id = :child_id and world_theme = :theme
                        """
                    ),
                    {"amt": currency_delta, "child_id": child_id, "theme": theme},
                )

            await session.execute(
                text(
                    """
                    insert into public.reward_grants
                      (grant_key, child_id, world_theme, offer_id, currency_delta, item_def_id, item_qty)
                    values
                      (:k, :child_id, :theme, :offer_id, :currency_delta, :item_def_id, :item_qty)
                    """
                ),
                {
                    "k": key,
                    "child_id": child_id,
                    "theme": theme,
                    "offer_id": str(offer_id or ""),
                    "currency_delta": currency_delta,
                    "item_def_id": item_def_id,
                    "item_qty": item_qty if item_def_id and items_meta else 0,
                },
            )

            wallet_row = (
                await session.execute(
                    text(
                        """
                        select balance from public.child_wallets
                        where child_id = :child_id and world_theme = :theme
                        """
                    ),
                    {"child_id": child_id, "theme": theme},
                )
            ).mappings().one()

        labels = self.inventory.wallet_labels(theme)
        wallet = {
            "world_theme": theme,
            "currency_kind": labels["currency_kind"],
            "balance": int(wallet_row["balance"]),
            "label_child": labels["label_child"],
            "label_tutor": labels["label_tutor"],
            "icon_id": labels.get("icon_id", "currency"),
        }
        toast = None
        if currency_delta and items_meta:
            toast = f"¡Has ganado {currency_delta} {labels['label_child'].lower()} y un hallazgo!"
        elif currency_delta:
            toast = f"¡Has ganado {currency_delta} {labels['label_child'].lower()}!"
        elif items_meta:
            shown = items_meta[0].get("instance_name") or "un hallazgo"
            toast = f"¡Nuevo hallazgo: {shown}!"

        return {
            "skipped": False,
            "grant_key": key,
            "wallet": wallet,
            "items_added": items_meta,
            "currency_delta": currency_delta,
            "toast_child": toast,
            "session_id": session_id,
            "type": "reward_granted",
        }
