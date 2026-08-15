from __future__ import annotations

from pathlib import Path

import pytest

from app.config import get_settings
from app.services.crew import CrewService
from app.services.tutor_reports import TutorReportService


@pytest.mark.unit
def test_normalize_weak_spots_string_and_list() -> None:
    assert CrewService._normalize_weak_spots("Divisiones") == [
        {"subject_id": None, "note": "Divisiones"}
    ]
    assert CrewService._normalize_weak_spots(
        [{"subject_id": "math", "note": "Tablas"}]
    ) == [{"subject_id": "math", "note": "Tablas"}]
    assert CrewService._normalize_weak_spots([]) == []


@pytest.mark.unit
def test_tutor_report_writes_markdown(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
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
        subject_notes=[{"subject_id": "math", "note": "Restas con llevada"}],
        general_note="Muy adelantado en general",
        reason="tutor_request",
    )
    assert out["filename"].startswith("informe-")
    assert "Ada" in out["body"]
    assert "Restas con llevada" in out["body"]
    assert "Muy adelantado" in out["body"]
    assert Path(out["path"]).is_file()
    get_settings.cache_clear()
