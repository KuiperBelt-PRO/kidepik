from __future__ import annotations

from typing import Any

from sqlalchemy import text

from app.catalogs.item_catalog import ItemCatalog
from app.catalogs.subject_catalog import SubjectCatalog
from app.db import session_scope
from app.services.inventory import InventoryService


class BaggageUseService:
    """Uso de objetos en play (challenge_hint / challenge_retry)."""

    IMPLEMENTED = frozenset({"challenge_hint", "challenge_retry"})

    def __init__(self, inventory: InventoryService | None = None) -> None:
        self.inventory = inventory or InventoryService()

    async def use(
        self,
        *,
        child: dict[str, Any],
        item_row_id: str,
        effect_id: str,
        session_id: str,
        active_challenge: dict[str, Any] | None,
        can_retry: bool,
    ) -> dict[str, Any]:
        effect_id = str(effect_id or "").strip()
        if effect_id not in self.IMPLEMENTED:
            raise UseItemError("effect_not_available", 409)

        theme = self.inventory.normalize_theme(
            child.get("world_theme") or child.get("active_world_theme")
        )
        active = SubjectCatalog.resolve_active_subjects(child)

        async with session_scope() as session:
            row = (
                await session.execute(
                    text(
                        """
                        select id, item_def_id, qty, world_theme
                        from public.child_inventory_items
                        where id = :id and child_id = :child_id
                        """
                    ),
                    {"id": item_row_id, "child_id": str(child["id"])},
                )
            ).mappings().first()
            if not row:
                raise UseItemError("item_not_found", 404)
            defn = ItemCatalog.get(str(row["item_def_id"]))
            if not defn or defn["world_theme"] != theme:
                raise UseItemError("item_not_found", 404)
            if effect_id not in defn["effects"]:
                raise UseItemError("effect_not_available", 409)
            subjects = list(defn["subject_ids"])
            if not (set(subjects) & set(active)):
                raise UseItemError("not_usable", 409)
            if int(row["qty"] or 0) < 1:
                raise UseItemError("item_not_found", 404)

            if effect_id == "challenge_hint":
                if not active_challenge:
                    raise UseItemError("no_active_challenge", 409)
                ch_subject = str(active_challenge.get("subject_id") or "")
                if ch_subject and ch_subject not in subjects:
                    raise UseItemError("subject_mismatch", 409)
                hint = self._hint_text(active_challenge)
                await self._consume(session, str(row["id"]), int(row["qty"]))
                result = {
                    "ok": True,
                    "effect_id": effect_id,
                    "consumed_qty": 1,
                    "hint_text": hint,
                    "mentor_line": "Usa esta pista con calma.",
                    "challenge_reopened": False,
                }
            else:  # challenge_retry
                if not can_retry:
                    raise UseItemError("retry_not_eligible", 409)
                ch_subject = str((active_challenge or {}).get("subject_id") or "")
                if ch_subject and ch_subject not in subjects:
                    raise UseItemError("subject_mismatch", 409)
                await self._consume(session, str(row["id"]), int(row["qty"]))
                result = {
                    "ok": True,
                    "effect_id": effect_id,
                    "consumed_qty": 1,
                    "challenge_reopened": True,
                    "mentor_line": "Vamos a intentarlo otra vez.",
                }

        baggage = await self.inventory.get_baggage(
            str(child["id"]),
            theme,
            active_subjects=active,
            age_band=child.get("age_band") if isinstance(child.get("age_band"), str) else None,
            audience="child",
        )
        result["baggage"] = baggage
        return result

    async def _consume(self, session: Any, row_id: str, qty: int) -> None:
        if qty <= 1:
            await session.execute(
                text("delete from public.child_inventory_items where id = :id"),
                {"id": row_id},
            )
        else:
            await session.execute(
                text(
                    """
                    update public.child_inventory_items
                    set qty = qty - 1, last_used_at = now()
                    where id = :id
                    """
                ),
                {"id": row_id},
            )

    @staticmethod
    def _hint_text(challenge: dict[str, Any]) -> str:
        expl = str(challenge.get("explanation") or challenge.get("hint") or "").strip()
        answer = str(challenge.get("correct_option_id") or "").strip()
        if expl and answer and answer.lower() in expl.lower():
            # Avoid leaking the option id/label in the explanation
            expl = "Fíjate en lo esencial de la pregunta y descarta lo que no encaje."
        if expl:
            # Cap to ~2 sentences
            parts = [p.strip() for p in expl.replace("!", ".").split(".") if p.strip()]
            return ". ".join(parts[:2]) + ("." if parts else "")
        return "Lee otra vez el enunciado y piensa qué opción encaja mejor."


class UseItemError(Exception):
    def __init__(self, code: str, status: int) -> None:
        super().__init__(code)
        self.code = code
        self.status = status
