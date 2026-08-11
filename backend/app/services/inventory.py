from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalogs.age_band import AgeBand
from app.catalogs.item_catalog import ItemCatalog
from app.catalogs.subject_catalog import SubjectCatalog
from app.db import session_scope


class InventoryService:
    SLOT_SOFT_MAX = {
        AgeBand.EARLY: 12,
        AgeBand.CHILD: 20,
        AgeBand.TWEEN: 24,
        AgeBand.TEEN: 28,
        AgeBand.ADULT: 36,
        AgeBand.SENIOR: 36,
    }

    def wallet_labels(self, world_theme: str) -> dict[str, str]:
        if world_theme == "sci-fi":
            return {
                "currency_kind": "credits",
                "label_child": "Créditos",
                "label_tutor": "Créditos de ruta",
            }
        return {
            "currency_kind": "coins",
            "label_child": "Monedas",
            "label_tutor": "Monedas del reino",
        }

    def normalize_theme(self, world_theme: str | None) -> str:
        return "sci-fi" if world_theme == "sci-fi" else "fantasy"

    def slot_soft_max(self, age_band: str | None) -> int:
        return self.SLOT_SOFT_MAX.get(age_band or AgeBand.CHILD, 20)

    async def get_wallet(self, child_id: str, world_theme: str) -> dict[str, Any]:
        theme = self.normalize_theme(world_theme)
        async with session_scope() as session:
            row = await self._ensure_wallet(session, child_id, theme)
        labels = self.wallet_labels(theme)
        return {
            "world_theme": theme,
            "currency_kind": labels["currency_kind"],
            "balance": int(row["balance"]),
            "label_child": labels["label_child"],
            "label_tutor": labels["label_tutor"],
        }

    async def get_baggage(
        self,
        child_id: str,
        world_theme: str,
        *,
        active_subjects: list[str] | None = None,
        age_band: str | None = None,
        show_levels_to_child: bool = False,
        audience: str = "tutor",
    ) -> dict[str, Any]:
        theme = self.normalize_theme(world_theme)
        active = [s for s in (active_subjects or []) if SubjectCatalog.is_valid(s)]
        soft_max = self.slot_soft_max(age_band)
        async with session_scope() as session:
            wallet_row = await self._ensure_wallet(session, child_id, theme)
            item_rows = (
                await session.execute(
                    text(
                        """
                        select id, item_def_id, qty, acquired_at, last_used_at
                        from public.child_inventory_items
                        where child_id = :child_id and world_theme = :theme
                        order by acquired_at desc
                        """
                    ),
                    {"child_id": child_id, "theme": theme},
                )
            ).mappings().all()
        labels = self.wallet_labels(theme)
        wallet = {
            "world_theme": theme,
            "currency_kind": labels["currency_kind"],
            "balance": int(wallet_row["balance"]),
            "label_child": labels["label_child"],
            "label_tutor": labels["label_tutor"],
        }
        items: list[dict[str, Any]] = []
        for row in item_rows:
            dto = self._hydrate_item(dict(row), theme, active, audience=audience)
            if dto:
                items.append(dto)
        items.sort(
            key=lambda it: (
                0 if it.get("usable_now") else 1,
                ItemCatalog.rarity_rank(str(it.get("rarity") or "common")),
                str(it.get("acquired_at") or ""),
            )
        )
        items.reverse()  # acquired_at desc within groups — re-sort properly
        items.sort(
            key=lambda it: (
                0 if it.get("usable_now") else 1,
                ItemCatalog.rarity_rank(str(it.get("rarity") or "common")),
                -_ts(it.get("acquired_at")),
            )
        )
        return {
            "world_theme": theme,
            "wallet": wallet,
            "items": items,
            "slot_count": len(items),
            "slot_soft_max": soft_max,
            "empty": len(items) == 0,
            "show_levels_to_child": bool(show_levels_to_child),
        }

    def _hydrate_item(
        self,
        row: dict[str, Any],
        theme: str,
        active: list[str],
        *,
        audience: str,
    ) -> dict[str, Any] | None:
        defn = ItemCatalog.get(str(row.get("item_def_id") or ""))
        if not defn or defn["world_theme"] != theme:
            return None
        subjects = list(defn["subject_ids"])
        usable = bool(set(subjects) & set(active))
        effects = list(defn["effects"])
        implemented = any(ItemCatalog.effect_implemented(e) for e in effects)
        can_use = usable and int(row.get("qty") or 0) > 0 and implemented
        blocked = None
        if not usable:
            blocked = "Materia no activa"
        elif not implemented:
            blocked = "Próximamente"
        label = defn["label_tutor"] if audience == "tutor" else defn["label_child"]
        return {
            "id": str(row["id"]),
            "item_def_id": defn["id"],
            "world_theme": theme,
            "qty": int(row.get("qty") or 1),
            "label_child": defn["label_child"],
            "label_tutor": defn["label_tutor"],
            "label": label,
            "description_child": defn["description_child"],
            "description_tutor": defn.get("description_tutor") or defn["description_child"],
            "kind": defn["kind"],
            "rarity": defn["rarity"],
            "icon_id": defn["icon_id"],
            "subject_ids": subjects,
            "subject_labels": [SubjectCatalog.META[s]["label"] for s in subjects if s in SubjectCatalog.META],
            "usable_now": usable,
            "effects": effects,
            "effect_labels": [ItemCatalog.effect_label(e) for e in effects],
            "acquired_at": str(row.get("acquired_at") or ""),
            "can_use": can_use,
            "use_blocked_reason": blocked,
        }

    async def _ensure_wallet(self, session: AsyncSession, child_id: str, theme: str) -> dict[str, Any]:
        row = (
            await session.execute(
                text(
                    """
                    select balance, lifetime_earned, lifetime_spent
                    from public.child_wallets
                    where child_id = :child_id and world_theme = :theme
                    """
                ),
                {"child_id": child_id, "theme": theme},
            )
        ).mappings().first()
        if row:
            return dict(row)
        await session.execute(
            text(
                """
                insert into public.child_wallets (child_id, world_theme, balance, lifetime_earned, lifetime_spent)
                values (:child_id, :theme, 0, 0, 0)
                on conflict (child_id, world_theme) do nothing
                """
            ),
            {"child_id": child_id, "theme": theme},
        )
        return {"balance": 0, "lifetime_earned": 0, "lifetime_spent": 0}

    async def add_item(
        self,
        session: AsyncSession,
        child_id: str,
        world_theme: str,
        item_def_id: str,
        qty: int = 1,
        *,
        age_band: str | None = None,
    ) -> dict[str, Any]:
        """Add item inside an open transaction. Returns status + optional currency compensation."""
        theme = self.normalize_theme(world_theme)
        defn = ItemCatalog.require(item_def_id)
        if defn["world_theme"] != theme:
            raise ValueError("item world_theme mismatch")
        qty = max(1, int(qty))
        soft_max = self.slot_soft_max(age_band)
        existing = (
            await session.execute(
                text(
                    """
                    select id, qty from public.child_inventory_items
                    where child_id = :child_id and world_theme = :theme and item_def_id = :def
                    """
                ),
                {"child_id": child_id, "theme": theme, "def": item_def_id},
            )
        ).mappings().first()
        if existing and defn.get("unique"):
            return {
                "added": False,
                "reason": "unique",
                "currency_compensation": int(defn.get("duplicate_currency") or 0),
            }
        slot_count = (
            await session.execute(
                text(
                    """
                    select count(*) from public.child_inventory_items
                    where child_id = :child_id and world_theme = :theme
                    """
                ),
                {"child_id": child_id, "theme": theme},
            )
        ).scalar_one()
        if not existing and int(slot_count) >= soft_max:
            return {
                "added": False,
                "reason": "soft_cap",
                "currency_compensation": int(defn.get("fallback_currency") or 5),
            }
        if existing:
            await session.execute(
                text(
                    """
                    update public.child_inventory_items
                    set qty = qty + :qty
                    where id = :id
                    """
                ),
                {"id": existing["id"], "qty": qty},
            )
        else:
            await session.execute(
                text(
                    """
                    insert into public.child_inventory_items (child_id, world_theme, item_def_id, qty)
                    values (:child_id, :theme, :def, :qty)
                    """
                ),
                {"child_id": child_id, "theme": theme, "def": item_def_id, "qty": qty},
            )
        return {"added": True, "reason": "ok", "currency_compensation": 0}


def _ts(value: object) -> float:
    if value is None:
        return 0.0
    text_v = str(value)
    try:
        from datetime import datetime

        return datetime.fromisoformat(text_v.replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0.0
