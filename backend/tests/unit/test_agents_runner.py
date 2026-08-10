from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.ai.agents.deps import AudienceContext, RunDeps
from app.ai.agents.envelopes import DialogueEnvelope
from app.ai.agents.runner import (
    build_character_coach_prompt,
    build_mentor_prompt,
    run_dialogue_purpose,
    run_purpose,
)
from app.ai.errors import AiProductError
from app.config import Settings


def sample_deps() -> RunDeps:
    return RunDeps(
        child_id=uuid4(),
        parent_id=uuid4(),
        session_id=str(uuid4()),
        purpose="mentor_guide",
        world_theme="fantasy",
        age_band="band_child",
        audience=AudienceContext(age_band="band_child", age_years=9),
        mentor={
            "id": "guardian",
            "mentor_id": "mentor_fantasy_guardian",
            "display_name": "El Guardián del Conocimiento",
        },
        player_state={"onboarding_step": "choose_name"},
    )


@pytest.mark.unit
def test_build_mentor_prompt_includes_state() -> None:
    prompt = build_mentor_prompt(sample_deps(), explorer_reply="Ada")
    assert "purpose=mentor_guide" in prompt
    assert "markdown" in prompt.lower()
    assert "MENTOR_PROFILE" in prompt
    assert "explorer_reply=Ada" in prompt
    assert "age_years=9" in prompt


@pytest.mark.unit
def test_build_character_coach_prompt_includes_age() -> None:
    deps = sample_deps()
    deps = deps.model_copy(update={"purpose": "character_coach"})
    prompt = build_character_coach_prompt(deps, explorer_choice="protector de sueños")
    assert "TravelerProfileEnvelope" in prompt
    assert "protector de sueños" in prompt
    assert "age_years=9" in prompt


@pytest.mark.unit
@pytest.mark.asyncio
async def test_run_purpose_prepends_audience_block_for_child(mocker) -> None:
    envelope = DialogueEnvelope(agent_text="Hola", input_mode="continue")
    agent = MagicMock()
    captured: list[str] = []

    async def _run(prompt: str, **_kwargs: object) -> MagicMock:
        captured.append(prompt)
        return MagicMock(output=envelope)

    agent.run = _run
    mocker.patch("app.ai.agents.runner.build_agent", return_value=agent)

    async def _run_list(_purpose, runner, **_kwargs):
        return await runner("gemini-test"), "gemini-test"

    gateway = MagicMock()
    gateway.model_string = lambda mid: mid
    gateway.run_with_model_list = AsyncMock(side_effect=_run_list)
    await run_purpose(
        "mentor_guide",
        "hola",
        sample_deps(),
        settings=Settings(ai_enabled=False),
        gateway=gateway,
        expect_type=DialogueEnvelope,
    )
    assert captured
    assert captured[0].startswith("AUDIENCIA OBLIGATORIA")
    assert "hola" in captured[0]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_run_purpose_success(mocker) -> None:
    envelope = DialogueEnvelope(agent_text="Hola", input_mode="continue")
    agent = MagicMock()
    agent.run = AsyncMock(return_value=MagicMock(output=envelope))
    mocker.patch("app.ai.agents.runner.build_agent", return_value=agent)

    async def _run_list(_purpose, runner, **_kwargs):
        return await runner("gemini-test"), "gemini-test"

    gateway = MagicMock()
    gateway.model_string = lambda mid: mid
    gateway.run_with_model_list = AsyncMock(side_effect=_run_list)
    output, model = await run_purpose(
        "mentor_guide",
        "hola",
        sample_deps(),
        settings=Settings(ai_enabled=False),
        gateway=gateway,
        expect_type=DialogueEnvelope,
    )
    assert output.agent_text == "Hola"
    assert model == "gemini-test"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_run_dialogue_purpose_appends_ledger(mocker, tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.ai.journey.ledger import JourneyLedger
    from app.config import get_settings

    get_settings.cache_clear()
    deps = sample_deps()
    deps.ledger = JourneyLedger(tmp_path)
    envelope = DialogueEnvelope(agent_text="Hola", input_mode="continue")
    mocker.patch(
        "app.ai.agents.runner.run_purpose",
        new=AsyncMock(return_value=(envelope, "gemini-test")),
    )
    out, model = await run_dialogue_purpose("mentor_guide", "hola", deps)
    assert out.agent_text == "Hola"
    assert model == "gemini-test"
    get_settings.cache_clear()
