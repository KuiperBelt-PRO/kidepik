from __future__ import annotations

import pytest

from app.services.placement import PlacementComposeFailedException, PlacementService
from tests.helpers.db_session import FakeExecuteResult, ScriptedSession
from tests.helpers.factories import CHILD_ID


@pytest.mark.unit
def test_active_subjects_for_child_defaults() -> None:
    child = {"age_band": "band_child", "age_years": 9}
    subjects = PlacementService.active_subjects_for_child(child)
    assert "math" in subjects


@pytest.mark.unit
def test_active_subjects_invalid_list_falls_back() -> None:
    child = {
        "age_band": "band_child",
        "settings": {"learning": {"active_subjects": ["invalid_subject"]}},
    }
    subjects = PlacementService.active_subjects_for_child(child)
    assert subjects


@pytest.mark.unit
def test_item_to_turn_mcq() -> None:
    turn = PlacementService(ScriptedSession([])).item_to_turn(
        "sess",
        CHILD_ID,
        "first_run",
        2,
        "guardian",
        "fantasy",
        {
            "subject_id": "math",
            "item_key": "q1",
            "item_type": "mcq",
            "prompt_text": "¿2+2?",
            "options": [{"id": "b", "label": "4"}],
        },
        0,
        3,
    )
    assert turn["meta"]["phase"] == "placement_item"
    assert turn["input_mode"] == "options_only"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_start_exam_updates_child() -> None:
    session = ScriptedSession([FakeExecuteResult(), FakeExecuteResult()])
    svc = PlacementService(session)
    result = await svc.start_exam(
        CHILD_ID,
        {"world_theme": "fantasy"},
        "sess",
        "first_run",
        1,
        "guardian",
        [{"subject_id": "math", "item_key": "q1", "item_type": "mcq", "prompt_text": "?"}],
    )
    assert result["effects"][0]["to"] == "placement"
    assert len(session.executed) == 2


@pytest.mark.unit
@pytest.mark.asyncio
async def test_start_exam_empty_queue() -> None:
    svc = PlacementService(ScriptedSession([]))
    with pytest.raises(PlacementComposeFailedException):
        await svc.start_exam(CHILD_ID, {}, "sess", "first_run", 1, "guardian", [])


@pytest.mark.unit
def test_dump_queue() -> None:
    payload = PlacementService.dump_queue([{"item_key": "a"}])
    assert '"item_key": "a"' in payload
