"""Reset de viajeros al first_run (SPEC_AI_JOURNEY_FILE_LEDGER §10)."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.journey.ledger import JourneyLedger
from app.config import Settings, get_settings
from app.logging_ import AppLogger

api_log = AppLogger("api")


@dataclass
class ResetReport:
    dry_run: bool
    children_matched: int = 0
    children_updated: int = 0
    files_archived: int = 0
    child_ids: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "dry_run": self.dry_run,
            "children_matched": self.children_matched,
            "children_updated": self.children_updated,
            "files_archived": self.files_archived,
            "child_ids": self.child_ids,
            "errors": self.errors,
        }


async def list_resettable_children(session: AsyncSession) -> list[dict[str, Any]]:
    result = await session.execute(
        text(
            """
            select id, parent_id, display_name, onboarding_step, placement_status,
                   coalesce(is_tutor_profile, false) as is_tutor_profile
            from public.children
            where status <> 'deleted'
              and coalesce(is_tutor_profile, false) = false
            order by created_at
            """
        )
    )
    return [dict(row._mapping) for row in result]


async def reset_travelers(
    session: AsyncSession,
    *,
    dry_run: bool = True,
    archive_files: bool = True,
    settings: Settings | None = None,
) -> ResetReport:
    """Resetea onboarding + niveles/ranks + limpia tablas de viaje; archiva JSONL."""
    cfg = settings or get_settings()
    ledger = JourneyLedger(cfg.journey_data_dir)
    report = ResetReport(dry_run=dry_run)
    children = await list_resettable_children(session)
    report.children_matched = len(children)
    report.child_ids = [str(row["id"]) for row in children]
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    if dry_run:
        return report

    for row in children:
        child_id = str(row["id"])
        parent_id = str(row["parent_id"])
        try:
            await session.execute(
                text(
                    """
                    update public.children
                    set
                      onboarding_step = 'pending_entry',
                      placement_status = 'not_started',
                      world_theme = null,
                      active_world_theme = null,
                      mentor_id = null,
                      display_name = null,
                      age_years = null,
                      age_band = null,
                      effective_age_band = null,
                      general_level = null,
                      rank_id = null,
                      rank_track = null,
                      updated_at = now()
                    where id = :id
                    """
                ),
                {"id": child_id},
            )
            await session.execute(
                text("delete from public.child_traits where child_id = :id"),
                {"id": child_id},
            )
            await session.execute(
                text("delete from public.user_subject_levels where child_id = :id"),
                {"id": child_id},
            )
            await session.execute(
                text("delete from public.child_world_progress where child_id = :id"),
                {"id": child_id},
            )
            # Residuos de tablas deprecadas (ya no son fuente de verdad del examen)
            await session.execute(
                text("delete from public.placement_exams where child_id = :id"),
                {"id": child_id},
            )
            await session.execute(
                text("delete from public.narrative_quests where child_id = :id"),
                {"id": child_id},
            )
            await session.execute(
                text("delete from public.dialogue_sessions where child_id = :id"),
                {"id": child_id},
            )
            await session.execute(
                text("delete from public.story_beats where child_id = :id"),
                {"id": child_id},
            )
            await session.execute(
                text("delete from public.story_summaries where child_id = :id"),
                {"id": child_id},
            )
            await session.execute(
                text("delete from public.journey_decisions where child_id = :id"),
                {"id": child_id},
            )
            await session.execute(
                text(
                    """
                    update public.child_permissions
                    set lock_world_theme = true, updated_at = now()
                    where child_id = :id
                    """
                ),
                {"id": child_id},
            )
            if archive_files:
                archived = ledger.archive_child(parent_id, child_id, stamp=stamp)
                if archived is not None:
                    report.files_archived += 1
            report.children_updated += 1
        except Exception as exc:  # noqa: BLE001
            report.errors.append(f"{child_id}: {exc}")

    await session.commit()
    api_log.info(
        "journey_reset_applied",
        children_updated=report.children_updated,
        files_archived=report.files_archived,
        errors=len(report.errors),
    )
    return report
