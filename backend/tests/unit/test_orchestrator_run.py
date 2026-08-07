from __future__ import annotations

from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.ai.agents.deps import AudienceContext, RunDeps
from app.ai.agents.envelopes import DialogueEnvelope
from app.ai.orchestrator import Orchestrator, TurnContext
from tests.helpers.factories import CHILD_ID, PARENT_ID


def sample_deps() -> RunDeps:
    return RunDeps(
        child_id=uuid4(),
        parent_id=uuid4(),
        session_id=str(uuid4()),
        purpose="mentor_guide",
        world_theme="fantasy",
        age_band="band_child",
        audience=AudienceContext(age_band="band_child", age_years=9),
        mentor={"id": "guardian", "display_name": "El Guardián"},
        player_state={"onboarding_step": "choose_name"},
    )


@pytest.mark.unit
@pytest.mark.parametrize(
    "phase,child_theme,expected",
    [
        ("choose_character", "fantasy", "character_coach"),
        ("handoff_placement", "fantasy", "placement_item_writer"),
        ("choose_world", None, "onboarding_host"),
    ],
)
def test_resolve_purpose_phases(phase: str, child_theme: str | None, expected: str) -> None:
    orch = Orchestrator.__new__(Orchestrator)
    child = {"id": CHILD_ID}
    if child_theme:
        child["world_theme"] = child_theme
    ctx = TurnContext(
        child=child,
        session_id="sess",
        flow_id="first_run",
        sequence=1,
        phase=phase,
        purpose="",
    )
    assert orch.resolve_purpose(ctx) == expected


@pytest.mark.unit
@pytest.mark.asyncio
async def test_orchestrator_run_mentor_guide(mocker, tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("GLOSSARY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    envelope = DialogueEnvelope(agent_text="Hola explorador", input_mode="continue")
    mocker.patch(
        "app.ai.orchestrator.orchestrator.run_purpose",
        new=AsyncMock(return_value=(envelope, "gemini-test")),
    )
    orch = Orchestrator()
    ctx = TurnContext(
        child={"id": CHILD_ID, "world_theme": "fantasy", "parent_id": PARENT_ID},
        session_id="sess",
        flow_id="first_run",
        sequence=2,
        phase="choose_name",
        purpose="mentor_guide",
        explorer_reply="Ada",
        deps=sample_deps(),
    )
    result = await orch.run(ctx)
    assert result.output.agent_text == "Hola explorador"
    get_settings.cache_clear()
