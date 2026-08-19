"""Ofertas de equipaje inline para retos en play."""

from __future__ import annotations

from typing import Any

from app.catalogs.item_catalog import ItemCatalog
from app.services.inventory import InventoryService


class BaggageOfferService:
    MAX_OFFERS = 24

    def __init__(self, inventory: InventoryService | None = None) -> None:
        self.inventory = inventory or InventoryService()

    async def offers_for_play(
        self,
        child: dict[str, Any],
        *,
        phase: str,
        meta: dict[str, Any] | None,
        progress: dict[str, Any] | None,
        eligible_retry: bool = False,
    ) -> list[dict[str, Any]]:
        ctx = self._challenge_context(phase, meta, progress, eligible_retry=eligible_retry)
        if not ctx:
            return []
        subject_id = str(ctx["subject_id"])
        challenge_ref = str(ctx["challenge_ref"])
        helps = ctx.get("helps") if isinstance(ctx.get("helps"), dict) else {}
        help_row = helps.get(str(ctx["challenge_index"])) if isinstance(helps, dict) else {}
        if not isinstance(help_row, dict):
            help_row = {}

        theme = self.inventory.normalize_theme(
            child.get("world_theme") or child.get("active_world_theme")
        )
        from app.catalogs.subject_catalog import SubjectCatalog

        active = SubjectCatalog.resolve_active_subjects(child)
        baggage = await self.inventory.get_baggage(
            str(child["id"]),
            theme,
            active_subjects=active,
            age_band=child.get("age_band") if isinstance(child.get("age_band"), str) else None,
            audience="child",
        )
        items = [it for it in (baggage.get("items") or []) if isinstance(it, dict)]

        retry_blocked_reason = "Solo disponible si el reto no salió bien"
        if help_row.get("retry"):
            retry_blocked_reason = "Ya usaste el reintento en este reto"
        hint_blocked_reason = "Ya usaste una pista en este reto"
        retry_first = eligible_retry and not help_row.get("retry")
        hint_ok = not help_row.get("hint")

        candidates: list[dict[str, Any]] = []
        for item in items:
            effect_id = self._primary_play_effect(item)
            if not effect_id:
                continue
            chip = self._chip_from_item(
                item,
                effect_id=effect_id,
                challenge_ref=challenge_ref,
            )
            if not chip:
                continue
            item_subjects = list(item.get("subject_ids") or [])
            if subject_id not in item_subjects:
                labels = [str(lbl) for lbl in (item.get("subject_labels") or []) if lbl]
                chip["can_use"] = False
                chip["use_blocked_reason"] = (
                    f"Sirve en retos de {', '.join(labels)}" if labels else "No sirve en este reto"
                )
            elif effect_id == "challenge_retry" and not retry_first:
                chip["can_use"] = False
                chip["use_blocked_reason"] = retry_blocked_reason
            elif effect_id == "challenge_hint" and not hint_ok:
                chip["can_use"] = False
                chip["use_blocked_reason"] = hint_blocked_reason
            elif int(item.get("qty") or 0) <= 0:
                chip["can_use"] = False
                chip["use_blocked_reason"] = "Sin unidades disponibles"
            else:
                chip["can_use"] = True
                chip["use_blocked_reason"] = None
            candidates.append(chip)

        def sort_key(chip: dict[str, Any]) -> tuple[int, int, int, str]:
            subject_match = 0 if chip.get("can_use") else (
                1 if str(chip.get("use_blocked_reason") or "").startswith("Sirve en") else 2
            )
            effect_rank = 0 if chip.get("effect_id") == "challenge_retry" and retry_first else 1
            rarity = ItemCatalog.rarity_rank(str(chip.get("rarity") or "common"))
            return (subject_match, effect_rank, rarity, str(chip.get("label_child") or ""))

        candidates.sort(key=sort_key)
        return candidates[: self.MAX_OFFERS]

    @staticmethod
    def _primary_play_effect(item: dict[str, Any]) -> str | None:
        effects = list(item.get("effects") or [])
        if "challenge_hint" in effects:
            return "challenge_hint"
        if "challenge_retry" in effects:
            return "challenge_retry"
        return None

    @staticmethod
    def _chip_from_item(
        item: dict[str, Any],
        *,
        effect_id: str,
        challenge_ref: str,
    ) -> dict[str, Any] | None:
        row_id = str(item.get("id") or "").strip()
        if not row_id:
            return None
        can_use = int(item.get("qty") or 0) > 0 and effect_id in (item.get("effects") or [])
        return {
            "item_row_id": row_id,
            "item_def_id": str(item.get("item_def_id") or ""),
            "label_child": str(item.get("label_child") or item.get("label_tutor") or "Objeto"),
            "description_child": str(item.get("description_child") or ""),
            "icon_id": str(item.get("icon_id") or "baggage"),
            "effect_id": effect_id,
            "qty": int(item.get("qty") or 1),
            "subject_labels": list(item.get("subject_labels") or []),
            "rarity": str(item.get("rarity") or "common"),
            "can_use": can_use,
            "use_blocked_reason": item.get("use_blocked_reason"),
            "challenge_ref": challenge_ref,
        }

    @staticmethod
    def _challenge_context(
        phase: str,
        meta: dict[str, Any] | None,
        progress: dict[str, Any] | None,
        *,
        eligible_retry: bool,
    ) -> dict[str, Any] | None:
        meta = meta if isinstance(meta, dict) else {}
        progress = progress if isinstance(progress, dict) else {}
        path = progress.get("path") if isinstance(progress.get("path"), dict) else {}
        challenges = list(path.get("challenges") or [])
        idx = int(
            meta.get("challenge_index")
            if meta.get("challenge_index") is not None
            else progress.get("challenge_index") or 0
        )
        helps = progress.get("helps") if isinstance(progress.get("helps"), dict) else {}

        active_phase = phase
        retry = bool(meta.get("retry"))
        if phase == "path_challenge" and 0 <= idx < len(challenges):
            subject_id = str(path.get("subject_id") or challenges[idx].get("subject_id") or "math")
            path_id = str(path.get("path_id") or "path")
            return {
                "subject_id": subject_id,
                "challenge_index": idx,
                "challenge_ref": f"{path_id}:{idx}",
                "helps": helps,
                "eligible_retry": eligible_retry,
            }
        if phase == "path_intro" and retry and 0 <= idx < len(challenges):
            subject_id = str(path.get("subject_id") or challenges[idx].get("subject_id") or "math")
            path_id = str(path.get("path_id") or "path")
            return {
                "subject_id": subject_id,
                "challenge_index": idx,
                "challenge_ref": f"{path_id}:{idx}",
                "helps": helps,
                "eligible_retry": True,
            }
        if active_phase == "path_intro" and progress.get("last_ok") is False and 0 <= idx < len(challenges):
            subject_id = str(path.get("subject_id") or challenges[idx].get("subject_id") or "math")
            path_id = str(path.get("path_id") or "path")
            return {
                "subject_id": subject_id,
                "challenge_index": idx,
                "challenge_ref": f"{path_id}:{idx}",
                "helps": helps,
                "eligible_retry": True,
            }
        return None
