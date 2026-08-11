from __future__ import annotations

from typing import Any

from app.services.crew_progress import CrewProgressService


def build_play_progress_hud(child: dict[str, Any], progress_bundle: dict[str, Any] | None = None) -> dict[str, Any]:
    """Map crew progress → play HUD DTO (SPEC_APP_PLAY_PROGRESS_HUD)."""
    settings = child.get("settings") if isinstance(child.get("settings"), dict) else {}
    learning = settings.get("learning") if isinstance(settings.get("learning"), dict) else {}
    show_levels = bool(learning.get("show_levels_to_child"))
    placement = str(child.get("placement_status") or "")
    progress = (progress_bundle or {}).get("progress") if isinstance(progress_bundle, dict) else None
    if not isinstance(progress, dict):
        progress = {}
    general = progress.get("general_progress")
    rank = progress.get("rank") if isinstance(progress.get("rank"), dict) else None
    visible = placement == "completed" and isinstance(general, dict)
    return {
        "visible": visible,
        "show_levels_to_child": show_levels,
        "rank_label_child": (rank.get("label_child") if rank else None),
        "general_progress": (
            {
                "current": general.get("current"),
                "next": general.get("next"),
                "percent_to_next": int(general.get("percent_to_next") or 0),
            }
            if visible
            else None
        ),
    }


async def progress_hud_for_child(child: dict[str, Any]) -> dict[str, Any]:
    built = await CrewProgressService().build_for_child(child)
    return build_play_progress_hud(child, built)
