"""Informes tutor desde progreso + ledger (SPEC_APP_PRODUCT_BACKLOG_AGO2026 B10/B16)."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.ai.journey.ledger import JourneyLedger
from app.config import get_settings


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class TutorReportService:
    def __init__(self, ledger: JourneyLedger | None = None) -> None:
        settings = get_settings()
        self.ledger = ledger or JourneyLedger(settings.journey_data_dir)

    def reports_dir(
        self, parent_id: str, child_id: str, world_theme: str | None
    ) -> Path:
        base = self.ledger.world_dir(parent_id, child_id, world_theme)
        path = base / "reports"
        path.mkdir(parents=True, exist_ok=True)
        return path

    def write_evaluation_report(
        self,
        *,
        parent_id: str,
        child_id: str,
        world_theme: str | None,
        display_name: str | None,
        progress: dict[str, Any] | None,
        weak_spots: list[dict[str, Any]] | None = None,
        reason: str = "tutor_request",
    ) -> dict[str, str]:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        filename = f"informe-{stamp}.md"
        path = self.reports_dir(parent_id, child_id, world_theme) / filename
        name = display_name or "Viajero"
        general = (progress or {}).get("general_level") or "—"
        rank = ((progress or {}).get("rank") or {}).get("label_tutor") or "—"
        subjects = (progress or {}).get("subjects") or []
        lines = [
            "---",
            "schema: kidepik.tutor_report/v1",
            f"generated_at: {_utc_now()}",
            f"reason: {reason}",
            f"world_theme: {world_theme or 'neutral'}",
            "---",
            "",
            f"# Informe de evaluación — {name}",
            "",
            f"- Nivel general: **{general}**",
            f"- Rango: **{rank}**",
            "",
            "## Materias",
            "",
        ]
        if subjects:
            for s in subjects:
                label = s.get("label") or s.get("id") or "Materia"
                lp = s.get("level_progress") or {}
                cur = lp.get("current") or "—"
                lines.append(f"- {label}: {cur}")
        else:
            lines.append("- Sin datos de materias todavía.")
        lines.extend(["", "## Puntos flojos indicados por el tutor", ""])
        spots = weak_spots or []
        if spots:
            for spot in spots:
                note = spot.get("note") if isinstance(spot, dict) else str(spot)
                sid = spot.get("subject_id") if isinstance(spot, dict) else None
                prefix = f"[{sid}] " if sid else ""
                lines.append(f"- {prefix}{note}")
        else:
            lines.append("- Ninguno registrado.")
        lines.extend(
            [
                "",
                "## Nota",
                "",
                "Informe generado para seguimiento del tutor. "
                "No sustituye la observación directa en la aventura.",
                "",
            ]
        )
        path.write_text("\n".join(lines), encoding="utf-8")
        return {"path": str(path), "filename": filename, "body": path.read_text(encoding="utf-8")}
