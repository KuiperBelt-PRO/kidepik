from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.services.crew_progress import CrewProgressService
from tests.helpers.db_session import FakeExecuteResult, ScriptedSession
from tests.helpers.factories import CHILD_ID
from tests.helpers.session_scope import patch_session_scope


@pytest.fixture
def progress_svc(mocker):
    session = ScriptedSession([])
    patch_session_scope(mocker, session)
    return CrewProgressService(), session


@pytest.mark.unit
def test_level_progress_and_ranks() -> None:
    svc = CrewProgressService()
    progress = svc._level_progress("L2", 0.85, 5, "Matemáticas")
    assert progress["next"] == "L3"
    rank = svc._rank("fantasy", "fantasy", "fantasy_spark", "L2")
    assert rank["tier"] >= 1
    nxt = svc._next_rank("fantasy", 1)
    assert nxt and nxt["tier"] == 2
    assert svc._next_level("L5") is None
    assert svc._level_index("L3") == 3


@pytest.mark.unit
def test_zone_status_branches() -> None:
    from app.services.crew_progress import CrewProgressService

    svc = CrewProgressService()
    assert svc._zone_status("L1", "zone_math", ["zone_math"], None, None) == "completed"
    assert svc._zone_status("L1", "zone_math", [], None, {"zone_id": "zone_math"}) == "in_progress"
    assert svc._zone_status("L1", "zone_math", [], None, None) == "not_visited"


@pytest.mark.unit
def test_plan_zones() -> None:
    svc = CrewProgressService()
    levels = {"math": {"level_id": "L2"}}
    pending = svc._plan_zones(levels, [], CHILD_ID, "fantasy")
    assert pending and pending[0]["id"].startswith("zone_")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_build_for_child(progress_svc, mocker) -> None:
    svc, session = progress_svc
    session._results = [
        FakeExecuteResult(rows=[{"subject_id": "math", "level_id": "L2", "accuracy_rolling": 0.8}]),
        FakeExecuteResult(rows=None),
        FakeExecuteResult(scalar="2026-01-01"),
    ]
    child = {
        "id": CHILD_ID,
        "world_theme": "fantasy",
        "placement_status": "completed",
        "general_level": "L2",
        "rank_id": "fantasy_spark",
        "settings": {
            "learning": {"active_subjects": ["math", "language"]},
            "journey": {"completed_zone_ids": [], "active_zone_id": "zone_math"},
        },
    }
    built = await svc.build_for_child(child)
    assert built["progress"]["general_level"] == "L2"
    assert built["journey"]["active_zone_id"] == "zone_math"
    assert any(s["subject_id"] == "math" for s in built["progress"]["subjects"])
