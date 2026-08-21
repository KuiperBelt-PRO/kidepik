from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.services.journey_rewind import (
    _anchor_datetime,
    _derive_child_patch,
    _mentor_regenerate_mode,
    _phase_base_fields,
    _replay_explorer_state,
)
from tests.helpers.factories import CHILD_ID, PARENT_ID


def _turn(**overrides):
    row = {
        "id": str(uuid4()),
        "child_id": CHILD_ID,
        "session_id": "33333333-3333-4333-8333-333333333333",
        "sequence": 1,
        "role": "mentor",
        "text": "Hola",
        "meta": {"phase": "choose_world"},
        "explorer_reply": None,
        "created_at": datetime.now(timezone.utc),
    }
    row.update(overrides)
    return row


@pytest.mark.unit
def test_anchor_datetime_parses_iso_z() -> None:
    dt = _anchor_datetime("2026-08-10T11:58:18.554394Z")
    assert dt.tzinfo is not None
    assert dt.year == 2026


@pytest.mark.unit
def test_mentor_regenerate_mode_path_challenge_not_choose_path() -> None:
    assert _mentor_regenerate_mode("path_challenge", placement_completed=True) == (
        "path_challenge_reemit"
    )
    assert _mentor_regenerate_mode("path_intro", placement_completed=True) == (
        "path_intro_reemit"
    )
    assert _mentor_regenerate_mode("choose_path", placement_completed=True) == (
        "choose_path_reemit"
    )
    assert _mentor_regenerate_mode("placement_feedback", placement_completed=True) == (
        "choose_path_reemit"
    )


@pytest.mark.unit
def test_mentor_regenerate_mode_placement_item() -> None:
    assert _mentor_regenerate_mode("placement_item", placement_completed=True) == (
        "placement_reemit"
    )
    assert _mentor_regenerate_mode("placement_item", placement_completed=False) == (
        "placement_reemit"
    )


@pytest.mark.unit
def test_phase_base_fields_choose_world() -> None:
    fields = _phase_base_fields("choose_world")
    assert fields["onboarding_step"] == "choose_world"
    assert fields["placement_status"] == "not_started"
    assert fields["world_theme"] is None


@pytest.mark.unit
def test_phase_base_fields_placement_item() -> None:
    fields = _phase_base_fields("placement_item")
    assert fields["onboarding_step"] == "placement"
    assert fields["placement_status"] == "in_progress"


@pytest.mark.unit
def test_phase_base_fields_choose_path() -> None:
    fields = _phase_base_fields("choose_path")
    assert fields["onboarding_step"] == "complete"
    assert fields["placement_status"] == "completed"


@pytest.mark.unit
def test_phase_base_fields_path_challenge() -> None:
    fields = _phase_base_fields("path_challenge")
    assert fields["placement_status"] == "completed"


@pytest.mark.unit
def test_replay_explorer_state_world_and_name() -> None:
    turns = [
        _turn(sequence=1, role="mentor", meta={"phase": "choose_world"}),
        _turn(
            sequence=2,
            role="explorer",
            text="fantasy",
            explorer_reply={"kind": "option", "option_id": "fantasy"},
        ),
        _turn(sequence=3, role="mentor", meta={"phase": "choose_name"}),
        _turn(sequence=4, role="explorer", text="Ada", explorer_reply={"kind": "text", "text": "Ada"}),
    ]
    state = _replay_explorer_state(turns)
    assert state["world_theme"] == "fantasy"
    assert state["display_name"] == "Ada"


@pytest.mark.unit
def test_derive_child_patch_mentor_anchor_choose_name() -> None:
    turns = [
        _turn(sequence=1, role="mentor", meta={"phase": "choose_world"}),
        _turn(
            sequence=2,
            role="explorer",
            explorer_reply={"kind": "option", "option_id": "sci-fi"},
        ),
        _turn(sequence=3, role="mentor", meta={"phase": "choose_name"}),
    ]
    pending = turns[-1]
    patch, changed = _derive_child_patch(turns, pending)
    assert patch["onboarding_step"] == "choose_name"
    assert patch["world_theme"] == "sci-fi"
    assert "display_name" in changed


@pytest.mark.unit
def test_ledger_trim_after(tmp_path) -> None:
    from app.ai.journey.ledger import JourneyLedger

    parent = "11111111-1111-4111-8111-111111111111"
    child = "22222222-2222-4222-8222-222222222222"
    session = "33333333-3333-4333-8333-333333333333"
    ledger = JourneyLedger(tmp_path)

    ledger.append_dialogue(
        parent,
        child,
        session,
        kind="mentor_utterance",
        text="uno",
        world_theme="fantasy",
    )
    ledger.append_dialogue(
        parent,
        child,
        session,
        kind="explorer_reply",
        text="dos",
        world_theme="fantasy",
    )
    events = ledger.read_dialogue(parent, child, world_theme="fantasy")
    assert len(events) == 2
    anchor_at = events[0]["at"]
    trimmed = ledger.trim_after(
        parent,
        child,
        session_id=session,
        anchor_at=anchor_at,
        world_theme="fantasy",
    )
    assert trimmed >= 1
    assert len(ledger.read_dialogue(parent, child, world_theme="fantasy")) == 1


@pytest.mark.unit
def test_rewind_report_includes_regenerated_flag() -> None:
    from app.services.journey_rewind import RewindReport

    report = RewindReport(
        anchor_turn_id="turn-1",
        deleted_turns=1,
        regenerated=True,
        regenerate_mode="placement_reemit",
    )
    payload = report.to_dict()
    assert payload["regenerated"] is True
    assert payload["regenerate_mode"] == "placement_reemit"
    assert payload["deleted_turns"] == 1


@pytest.mark.unit
@pytest.mark.asyncio
async def test_trim_related_tables_post_placement_keeps_subject_levels() -> None:
    from app.services.journey_rewind import JourneyRewindService

    executed: list[str] = []

    class FakeSession:
        async def execute(self, stmt, params=None):  # noqa: ANN001
            executed.append(str(stmt))
            return None

    svc = JourneyRewindService.__new__(JourneyRewindService)
    svc.session = FakeSession()  # type: ignore[assignment]
    await svc._trim_related_tables(
        CHILD_ID, "2026-08-19T12:00:00Z", "path_challenge"
    )
    assert not any("user_subject_levels" in sql for sql in executed)
    assert any("story_beats" in sql for sql in executed)
