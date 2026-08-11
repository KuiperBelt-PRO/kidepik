"""Rebobinado parcial del viaje en modo debug (SPEC_APP_DEBUG_JOURNEY_REWIND)."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.journey.ledger import JourneyLedger
from app.catalogs import AgeBand
from app.config import Settings, get_settings
from app.logging_ import AppLogger
from app.catalogs.explorer_gender import assert_explorer_gender
from app.services.dialogue import DialogueService
from app.services.mentor_profiles import resolve_mentor_key

api_log = AppLogger("api")

PRE_CHARACTER_PHASES = frozenset(
    {
        "choose_world",
        "choose_name",
        "choose_age",
        "choose_gender",
        "choose_character",
        "choose_character_species",
    }
)
PRE_PLACEMENT_PHASES = PRE_CHARACTER_PHASES | frozenset({"handoff_placement"})
PRE_ADVENTURE_PHASES = PRE_PLACEMENT_PHASES | frozenset(
    {
        "placement_item",
        "placement_feedback",
        "placement_compose",
    }
)
POST_PLACEMENT_PHASES = frozenset(
    {
        "choose_path",
        "path_intro",
        "path_challenge",
        "adventure_ready",
        "compose_failed",
    }
)

MENTOR_REGENERATE_MODES = {
    "placement_item": "placement_reemit",
    "choose_path": "choose_path_reemit",
    "path_challenge": "path_challenge_reemit",
    "path_intro": "path_intro_reemit",
}


def _mentor_regenerate_mode(anchor_phase: str, *, placement_completed: bool) -> str | None:
    if anchor_phase == "placement_feedback" and placement_completed:
        return "choose_path_reemit"
    return MENTOR_REGENERATE_MODES.get(anchor_phase)


@dataclass
class RewindReport:
    anchor_turn_id: str
    deleted_turns: int = 0
    ledger_events_trimmed: int = 0
    child_fields_reset: list[str] = field(default_factory=list)
    dry_run: bool = False
    regenerated: bool = False
    regenerate_mode: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "anchor_turn_id": self.anchor_turn_id,
            "deleted_turns": self.deleted_turns,
            "ledger_events_trimmed": self.ledger_events_trimmed,
            "child_fields_reset": self.child_fields_reset,
            "dry_run": self.dry_run,
            "regenerated": self.regenerated,
            "regenerate_mode": self.regenerate_mode,
        }


def _iso_z(value: Any) -> str:
    if isinstance(value, datetime):
        dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    return str(value)


def _anchor_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _parse_turn_row(row: Any) -> dict[str, Any]:
    d = dict(row)
    for key in ("options", "explorer_reply", "meta"):
        if isinstance(d.get(key), str):
            try:
                d[key] = json.loads(d[key])
            except ValueError:
                d[key] = None if key != "meta" else {}
    return d


def _phase_base_fields(phase: str) -> dict[str, Any]:
    if phase == "choose_world":
        return {
            "onboarding_step": "choose_world",
            "placement_status": "not_started",
            "world_theme": None,
            "active_world_theme": None,
            "display_name": None,
            "age_years": None,
            "age_band": None,
            "effective_age_band": None,
            "general_level": None,
            "rank_id": None,
            "rank_track": None,
        }
    if phase == "choose_name":
        return {
            "onboarding_step": "choose_name",
            "placement_status": "not_started",
            "display_name": None,
            "age_years": None,
            "age_band": None,
            "effective_age_band": None,
        }
    if phase == "choose_age":
        return {
            "onboarding_step": "choose_age",
            "placement_status": "not_started",
            "age_years": None,
            "age_band": None,
            "effective_age_band": None,
            "explorer_gender": None,
        }
    if phase == "choose_gender":
        return {
            "onboarding_step": "choose_gender",
            "placement_status": "not_started",
            "explorer_gender": None,
        }
    if phase in {"choose_character", "choose_character_species"}:
        return {
            "onboarding_step": "choose_character",
            "placement_status": "not_started",
        }
    if phase == "handoff_placement":
        return {
            "onboarding_step": "placement",
            "placement_status": "not_started",
        }
    if phase in {"placement_item", "placement_feedback", "placement_compose"}:
        return {
            "onboarding_step": "placement",
            "placement_status": "in_progress",
        }
    if phase in POST_PLACEMENT_PHASES:
        return {
            "onboarding_step": "complete",
            "placement_status": "completed",
        }
    return {
        "onboarding_step": "complete",
        "placement_status": "completed",
    }


def _replay_explorer_state(turns: list[dict[str, Any]]) -> dict[str, Any]:
    state: dict[str, Any] = {}
    prev_phase: str | None = None
    for turn in sorted(turns, key=lambda row: int(row.get("sequence") or 0)):
        role = str(turn.get("role") or "")
        if role in {"mentor", "agent"}:
            prev_phase = str((turn.get("meta") or {}).get("phase") or "")
            continue
        if role != "explorer" or not prev_phase:
            continue
        reply = turn.get("explorer_reply") or {}
        value = str(reply.get("text") or reply.get("option_id") or turn.get("text") or "").strip()
        if prev_phase == "choose_world":
            theme = str(reply.get("option_id") or value)
            if theme in {"fantasy", "sci-fi"}:
                state["world_theme"] = theme
                state["active_world_theme"] = theme
                state["mentor_id"] = resolve_mentor_key({"world_theme": theme})
        elif prev_phase == "choose_name" and value:
            state["display_name"] = value[:24]
        elif prev_phase == "choose_age":
            try:
                age = int(value)
                band = AgeBand.from_age_years(age)
                state["age_years"] = age
                state["age_band"] = band
                state["effective_age_band"] = band
            except ValueError:
                pass
        elif prev_phase == "choose_gender":
            try:
                state["explorer_gender"] = assert_explorer_gender(value)
            except ValueError:
                pass
    return state


def _derive_child_patch(
    remaining_turns: list[dict[str, Any]],
    pending_turn: dict[str, Any],
) -> tuple[dict[str, Any], list[str]]:
    phase = str((pending_turn.get("meta") or {}).get("phase") or "choose_world")
    patch = _phase_base_fields(phase)
    patch.update(_replay_explorer_state(remaining_turns))
    changed = sorted(patch.keys())
    return patch, changed


class JourneyRewindService:
    def __init__(self, session: AsyncSession, settings: Settings | None = None) -> None:
        self.session = session
        self.settings = settings or get_settings()
        self.ledger = JourneyLedger(self.settings.journey_data_dir)
        self.dialogue = DialogueService(session)

    async def rewind_to_turn(
        self,
        *,
        auth_user_id: str,
        child_id: str,
        session_id: str,
        turn_id: str,
        dry_run: bool = False,
    ) -> tuple[dict[str, Any], RewindReport]:
        child = await self.dialogue._child(auth_user_id, child_id)
        if child.get("is_tutor_profile"):
            raise HTTPException(403, "Tutor profile cannot be rewound")

        session_row = (
            await self.session.execute(
                text(
                    "select * from dialogue_sessions where id=:id and child_id=:cid"
                ),
                {"id": session_id, "cid": child_id},
            )
        ).mappings().first()
        if not session_row:
            raise HTTPException(404, "Session not found")
        if str(session_row["status"]) != "open":
            raise HTTPException(409, "Session closed")

        anchor = (
            await self.session.execute(
                text("select * from dialogue_turns where id=:id and child_id=:cid"),
                {"id": turn_id, "cid": child_id},
            )
        ).mappings().first()
        if not anchor:
            raise HTTPException(404, "Turn not found")
        anchor_turn = _parse_turn_row(anchor)
        if str(anchor_turn["session_id"]) != session_id:
            raise HTTPException(409, "Turn does not belong to session")

        role = str(anchor_turn.get("role") or "")
        sequence = int(anchor_turn.get("sequence") or 0)
        regenerate = False
        regenerate_mode: str | None = None
        ledger_anchor_turn = anchor_turn
        if role in {"mentor", "agent"}:
            regenerate = True
            delete_op = ">="
            anchor_phase = str((anchor_turn.get("meta") or {}).get("phase") or "")
            placement_completed = str(child.get("placement_status") or "") == "completed"
            regenerate_mode = _mentor_regenerate_mode(
                anchor_phase, placement_completed=placement_completed
            )
            if regenerate_mode:
                pending_turn = anchor_turn
                ledger_anchor_turn = anchor_turn
            else:
                mentor_before = (
                    await self.session.execute(
                        text(
                            "select * from dialogue_turns where session_id=:sid "
                            "and role in ('mentor','agent') and sequence < :seq "
                            "order by sequence desc limit 1"
                        ),
                        {"sid": session_id, "seq": sequence},
                    )
                ).mappings().first()
                if mentor_before:
                    pending_turn = _parse_turn_row(mentor_before)
                    ledger_anchor_turn = pending_turn
                    regenerate_mode = "replay_explorer"
                else:
                    pending_turn = anchor_turn
                    ledger_anchor_turn = anchor_turn
                    regenerate_mode = "regenerate_anchor"
        elif role == "explorer":
            delete_op = ">="
            mentor_before = (
                await self.session.execute(
                    text(
                        "select * from dialogue_turns where session_id=:sid "
                        "and role in ('mentor','agent') and sequence < :seq "
                        "order by sequence desc limit 1"
                    ),
                    {"sid": session_id, "seq": sequence},
                )
            ).mappings().first()
            if not mentor_before:
                raise HTTPException(422, "Cannot rewind safely before first mentor turn")
            pending_turn = _parse_turn_row(mentor_before)
            ledger_anchor_turn = pending_turn
            pending_phase = str((pending_turn.get("meta") or {}).get("phase") or "")
            explorer_mode = MENTOR_REGENERATE_MODES.get(pending_phase)
            if explorer_mode:
                regenerate = True
                regenerate_mode = explorer_mode
        else:
            raise HTTPException(422, "Unsupported turn role for rewind")

        count_sql = (
            "select count(*) from dialogue_turns where session_id=:sid and sequence "
            f"{delete_op} :seq"
        )
        deleted_turns = int(
            (
                await self.session.execute(
                    text(count_sql),
                    {"sid": session_id, "seq": sequence},
                )
            ).scalar()
            or 0
        )

        remaining_compare = "<=" if delete_op == ">" else "<"
        remaining_rows = (
            await self.session.execute(
                text(
                    "select * from dialogue_turns where session_id=:sid and sequence "
                    f"{remaining_compare} :seq order by sequence asc"
                ),
                {"sid": session_id, "seq": sequence},
            )
        ).mappings().all()
        remaining_turns = [_parse_turn_row(row) for row in remaining_rows]
        child_patch, child_fields_reset = _derive_child_patch(remaining_turns, pending_turn)
        pending_phase = str((pending_turn.get("meta") or {}).get("phase") or "choose_world")
        anchor_at = _iso_z(ledger_anchor_turn.get("created_at"))

        report = RewindReport(
            anchor_turn_id=turn_id,
            deleted_turns=deleted_turns,
            child_fields_reset=child_fields_reset,
            dry_run=dry_run,
            regenerated=regenerate,
            regenerate_mode=regenerate_mode,
        )

        if dry_run:
            return {}, report

        if deleted_turns:
            await self.session.execute(
                text(
                    "delete from dialogue_turns where session_id=:sid and sequence "
                    f"{delete_op} :seq"
                ),
                {"sid": session_id, "seq": sequence},
            )

        await self._apply_child_patch(child_id, child_patch, session_id)
        await self._trim_related_tables(child_id, anchor_at, pending_phase)
        parent_id = str(child.get("parent_id") or "")
        world = child_patch.get("world_theme") or child.get("world_theme")
        if parent_id:
            report.ledger_events_trimmed = self.ledger.trim_after(
                parent_id,
                child_id,
                session_id=session_id,
                anchor_at=anchor_at,
                world_theme=world if world in {"fantasy", "sci-fi"} else None,
                clear_traveler=pending_phase in PRE_CHARACTER_PHASES,
                clear_session_summary=pending_phase in PRE_ADVENTURE_PHASES,
            )

        await self.session.execute(
            text("update dialogue_sessions set updated_at=now() where id=:id"),
            {"id": session_id},
        )
        await self.session.commit()

        if regenerate:
            try:
                source_meta = (
                    pending_turn.get("meta")
                    if isinstance(pending_turn.get("meta"), dict)
                    else {}
                )
                if regenerate_mode == "placement_reemit":
                    await self.dialogue.reemit_placement_item(
                        auth_user_id,
                        child_id,
                        session_id,
                        item_index=int(source_meta.get("index") or 0),
                    )
                elif regenerate_mode == "choose_path_reemit":
                    await self.dialogue.reemit_choose_path(
                        auth_user_id,
                        child_id,
                        session_id,
                    )
                elif regenerate_mode == "path_challenge_reemit":
                    await self.dialogue.reemit_path_challenge(
                        auth_user_id,
                        child_id,
                        session_id,
                        challenge_index=int(source_meta.get("challenge_index") or 0),
                        path_id=str(source_meta.get("path_id") or "") or None,
                    )
                elif regenerate_mode == "path_intro_reemit":
                    await self.dialogue.reemit_path_intro(
                        auth_user_id,
                        child_id,
                        session_id,
                        path_id=str(source_meta.get("path_id") or "") or None,
                    )
                elif regenerate_mode == "regenerate_anchor":
                    await self.dialogue.regenerate_anchor_mentor_turn(
                        auth_user_id,
                        child_id,
                        session_id,
                        phase=str((anchor_turn.get("meta") or {}).get("phase") or ""),
                    )
                else:
                    await self.dialogue.replay_last_explorer_reply(
                        auth_user_id,
                        child_id,
                        session_id,
                    )
            except Exception as exc:
                api_log.warning(
                    "journey_rewind_regenerate_failed",
                    child_id=child_id,
                    session_id=session_id,
                    regenerate_mode=regenerate_mode,
                    error=f"{type(exc).__name__}: {exc}"[:300],
                )
                raise HTTPException(
                    422,
                    "No se pudo rebobinar de forma segura; usa reset completo del viajero.",
                ) from exc

        api_log.info(
            "journey_rewind_applied",
            child_id=child_id,
            session_id=session_id,
            anchor_turn_id=turn_id,
            deleted_turns=deleted_turns,
            ledger_events_trimmed=report.ledger_events_trimmed,
            regenerated=regenerate,
        )

        body = await self.dialogue.open_session(auth_user_id, child_id)
        body["debug"] = {"rewind": report.to_dict()}
        return body, report

    async def _apply_child_patch(
        self, child_id: str, patch: dict[str, Any], session_id: str
    ) -> None:
        if not patch:
            return
        sets = ", ".join(f"{key}=:{key}" for key in patch)
        await self.session.execute(
            text(f"update children set {sets}, updated_at=now() where id=:child_id"),
            {"child_id": child_id, **patch},
        )
        mentor_id = patch.get("mentor_id")
        if mentor_id:
            await self.session.execute(
                text("update dialogue_sessions set mentor_id=:mentor, updated_at=now() where id=:id"),
                {"mentor": mentor_id, "id": session_id},
            )

    async def _trim_related_tables(
        self, child_id: str, anchor_at: Any, pending_phase: str
    ) -> None:
        anchor_dt = _anchor_datetime(anchor_at)

        if pending_phase in PRE_PLACEMENT_PHASES:
            await self.session.execute(
                text("delete from placement_exams where child_id=:cid"),
                {"cid": child_id},
            )
            await self.session.execute(
                text("delete from user_subject_levels where child_id=:cid"),
                {"cid": child_id},
            )
        elif pending_phase in PRE_ADVENTURE_PHASES:
            await self.session.execute(
                text("delete from placement_exams where child_id=:cid"),
                {"cid": child_id},
            )
            await self.session.execute(
                text("delete from user_subject_levels where child_id=:cid"),
                {"cid": child_id},
            )
        elif pending_phase not in POST_PLACEMENT_PHASES:
            await self.session.execute(
                text(
                    "delete from placement_exams where child_id=:cid "
                    "and coalesce(completed_at, started_at) > :at"
                ),
                {"cid": child_id, "at": anchor_dt},
            )
            await self.session.execute(
                text(
                    "delete from user_subject_levels where child_id=:cid and updated_at > :at"
                ),
                {"cid": child_id, "at": anchor_dt},
            )

        if pending_phase in PRE_ADVENTURE_PHASES:
            for table in (
                "story_beats",
                "story_summaries",
                "journey_decisions",
                "child_world_progress",
            ):
                await self.session.execute(
                    text(f"delete from {table} where child_id=:cid"),
                    {"cid": child_id},
                )
        elif pending_phase in POST_PLACEMENT_PHASES:
            for table in (
                "story_beats",
                "story_summaries",
                "journey_decisions",
            ):
                await self.session.execute(
                    text(f"delete from {table} where child_id=:cid and created_at > :at"),
                    {"cid": child_id, "at": anchor_dt},
                )
        else:
            for table in (
                "story_beats",
                "story_summaries",
                "journey_decisions",
            ):
                await self.session.execute(
                    text(f"delete from {table} where child_id=:cid and created_at > :at"),
                    {"cid": child_id, "at": anchor_dt},
                )
            await self.session.execute(
                text(
                    "delete from child_world_progress where child_id=:cid "
                    "and updated_at > :at"
                ),
                {"cid": child_id, "at": anchor_dt},
            )


async def rewind_to_turn(
    session: AsyncSession,
    *,
    auth_user_id: str,
    child_id: str,
    session_id: str,
    turn_id: str,
    dry_run: bool = False,
) -> tuple[dict[str, Any], RewindReport]:
    return await JourneyRewindService(session).rewind_to_turn(
        auth_user_id=auth_user_id,
        child_id=child_id,
        session_id=session_id,
        turn_id=turn_id,
        dry_run=dry_run,
    )
