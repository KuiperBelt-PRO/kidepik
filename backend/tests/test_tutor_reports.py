"""Tests de informes tutor y weak_spots."""
from __future__ import annotations

from pathlib import Path

from app.services.crew import CrewService
from app.services.tutor_reports import TutorReportService


def test_normalize_weak_spots_string_and_list() -> None:
    assert CrewService._normalize_weak_spots("Divisiones") == [
        {"subject_id": None, "note": "Divisiones"}
    ]
    assert CrewService._normalize_weak_spots(
        [{"subject_id": "math", "note": "Tablas"}]
    ) == [{"subject_id": "math", "note": "Tablas"}]
    assert CrewService._normalize_weak_spots([]) == []


def test_tutor_report_writes_markdown(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    svc = TutorReportService()
    parent = "11111111-1111-4111-8111-111111111111"
    child = "22222222-2222-4222-8222-222222222222"
    out = svc.write_evaluation_report(
        parent_id=parent,
        child_id=child,
        world_theme="fantasy",
        display_name="Ada",
        progress={"general_level": "L2", "rank": {"label_tutor": "Aprendiz"}, "subjects": []},
        weak_spots=[{"note": "Restas con llevada"}],
        reason="tutor_request",
    )
    assert out["filename"].startswith("informe-")
    assert "Ada" in out["body"]
    assert "Restas con llevada" in out["body"]
    assert Path(out["path"]).is_file()
    get_settings.cache_clear()
