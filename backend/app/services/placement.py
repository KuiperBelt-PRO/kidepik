"""Placement exam — estado en ledger JSONL (no placement_exams)."""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text

from app.catalogs import AgeBand, SubjectCatalog


class PlacementComposeFailedException(RuntimeError):
    def __init__(self, compose_debug: dict[str, Any]) -> None:
        super().__init__("PLACEMENT_COMPOSE_FAILED")
        self.compose_debug = compose_debug


class PlacementService:
    def __init__(self, session: Any, bank: Any | None = None) -> None:
        self.session = session
        self.bank = bank

    @staticmethod
    def active_subjects_for_child(child: dict[str, Any]) -> list[str]:
        settings = child.get("settings") or {}
        learning = settings.get("learning") if isinstance(settings, dict) else {}
        raw = learning.get("active_subjects") if isinstance(learning, dict) else None
        band = AgeBand.from_legacy(child.get("age_band"), child.get("age_years")) or AgeBand.CHILD
        try:
            return (
                SubjectCatalog.normalize_active_subjects(raw)
                if isinstance(raw, list)
                else SubjectCatalog.base_subjects_for_band(band)
            )
        except ValueError:
            return SubjectCatalog.base_subjects_for_band(band)

    async def start_exam(
        self,
        child_id: str,
        child: dict[str, Any],
        session_id: str,
        flow_id: str,
        sequence: int,
        mentor_id: str,
        queue: list[dict[str, Any]],
    ) -> dict[str, Any]:
        if not queue:
            raise PlacementComposeFailedException({"reason": "empty_queue"})
        theme = child.get("active_world_theme") or child.get("world_theme") or "fantasy"
        await self.session.execute(
            text(
                "update children set placement_status='in_progress',onboarding_step='placement',"
                "active_world_theme=coalesce(active_world_theme, world_theme), updated_at=now() "
                "where id=:id"
            ),
            {"id": child_id},
        )
        await self.session.execute(
            text(
                """
                insert into child_world_progress(
                  child_id, world_theme, placement_status, onboarding_step, updated_at
                ) values (:id, :theme, 'in_progress', 'placement', now())
                on conflict (child_id, world_theme) do update set
                  placement_status='in_progress',
                  onboarding_step='placement',
                  updated_at=now()
                """
            ),
            {"id": child_id, "theme": theme},
        )
        turn = self.item_to_turn(
            session_id,
            child_id,
            flow_id,
            sequence,
            mentor_id,
            str(theme),
            queue[0],
            0,
            len(queue),
            child,
        )
        return {
            "exam_id": None,
            "turn": turn,
            "effects": [{"type": "advance_onboarding", "to": "placement"}],
        }

    def item_to_turn(
        self,
        session_id: str,
        child_id: str,
        flow_id: str,
        sequence: int,
        mentor_id: str,
        theme: str,
        item: dict[str, Any],
        index: int,
        total: int,
        child: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        _ = child
        typ = str(item.get("item_type") or "mcq")
        return {
            "session_id": session_id,
            "child_id": child_id,
            "flow_id": flow_id,
            "sequence": sequence,
            "role": "mentor",
            "text": str(item.get("presentation_text") or item.get("prompt_text") or ""),
            "input_mode": "options_only" if typ == "mcq" else "text_only",
            "options": item.get("options"),
            "explorer_reply": None,
            "meta": {
                "phase": "placement_item",
                "subject_id": item.get("subject_id"),
                "item_key": item.get("item_key"),
                "mentor_id": mentor_id,
                "index": index,
                "total": total,
                "world_theme": theme,
            },
            "model_used": None,
        }

    @staticmethod
    def dump_queue(queue: list[dict[str, Any]]) -> str:
        return json.dumps(queue, ensure_ascii=False)
