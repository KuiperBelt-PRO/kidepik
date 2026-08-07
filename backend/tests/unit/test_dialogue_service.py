from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.ai.agents.envelopes import (
    DialogueEnvelope,
    PlacementItemEnvelope,
    PlacementQueueEnvelope,
    TravelerProfileEnvelope,
)
from app.ai.errors import AiProductError
from app.ai.journey.ledger import JourneyLedger
from app.ai.orchestrator.orchestrator import TurnResult
from app.services.dialogue import DialogueService
from app.services.mentor_profiles import mentor_profile
from tests.helpers.db_session import FakeExecuteResult, ScriptedSession
from tests.helpers.factories import AUTH_USER_ID, CHILD_ID, PARENT_ID

SESSION_ID = "33333333-3333-4333-8333-333333333333"


def sample_child(**overrides: Any) -> dict[str, Any]:
    row = {
        "id": CHILD_ID,
        "parent_id": PARENT_ID,
        "display_name": "Ada",
        "world_theme": "fantasy",
        "active_world_theme": "fantasy",
        "onboarding_step": "choose_world",
        "placement_status": "pending",
        "age_band": "band_child",
        "effective_age_band": "band_child",
        "age_years": 9,
    }
    row.update(overrides)
    return row


def sample_session_row(**overrides: Any) -> dict[str, Any]:
    row = {
        "id": SESSION_ID,
        "child_id": CHILD_ID,
        "flow_id": "first_run",
        "mentor_id": "guardian",
        "status": "open",
    }
    row.update(overrides)
    return row


def sample_turn_row(**overrides: Any) -> dict[str, Any]:
    row = {
        "id": str(uuid4()),
        "child_id": CHILD_ID,
        "session_id": SESSION_ID,
        "flow_id": "first_run",
        "sequence": 1,
        "role": "mentor",
        "text": "Hola",
        "options": None,
        "input_mode": "options_only",
        "explorer_reply": None,
        "meta": {"phase": "choose_world"},
        "model_used": None,
        "created_at": datetime.now(timezone.utc),
    }
    row.update(overrides)
    return row


@pytest.fixture
def dialogue_svc(tmp_path, monkeypatch, mocker):
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path / "journey"))
    monkeypatch.setenv("LOG_TO_FILES", "false")
    from app.config import get_settings

    get_settings.cache_clear()
    gateway = mocker.MagicMock()
    gateway.is_enabled.return_value = False
    session = ScriptedSession([])
    service = DialogueService(session, gateway=gateway)
    mocker.patch(
        "app.services.dialogue.WaitingCopyService",
    ).return_value.waiting_copy_from_cache = AsyncMock(return_value=[])
    yield service
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.parametrize(
    "child,expected",
    [
        ({"world_theme": "fantasy"}, "fantasy"),
        ({"active_world_theme": "sci-fi"}, "sci-fi"),
        ({"world_theme": "invalid"}, None),
        ({}, None),
    ],
    ids=["fantasy", "active-sci-fi", "invalid", "empty"],
)
def test_world_helper(child: dict, expected: str | None) -> None:
    assert DialogueService._world(child) == expected


@pytest.mark.unit
@pytest.mark.parametrize(
    "step,expected",
    [
        ("placement", "placement"),
        ("complete", "adventure"),
        ("choose_world", "first_run"),
    ],
)
def test_flow_helper(step: str, expected: str) -> None:
    assert DialogueService._flow({"onboarding_step": step}) == expected


@pytest.mark.unit
def test_mentor_and_world_options() -> None:
    architect = mentor_profile("architect")
    guardian = mentor_profile("guardian")
    host = mentor_profile("host")
    assert architect["display_name"] == "El Arquitecto del Saber"
    assert guardian["display_name"] == "El Guardián del Conocimiento"
    assert host["display_name"] == "El Guía"
    assert guardian["id"] == "guardian"
    options = DialogueService._world_options()
    assert {o["id"] for o in options} == {"fantasy", "sci-fi"}


@pytest.mark.unit
def test_turn_parses_json_fields() -> None:
    turn = DialogueService._turn(
        {
            **sample_turn_row(),
            "options": '[{"id":"fantasy","label":"Fantasía"}]',
            "meta": '{"phase":"choose_world"}',
        }
    )
    assert turn["options"][0]["id"] == "fantasy"
    assert turn["meta"]["phase"] == "choose_world"


@pytest.mark.unit
def test_deps_builds_run_context(dialogue_svc) -> None:
    deps = dialogue_svc._deps(sample_child(), SESSION_ID, "mentor_guide")
    assert str(deps.child_id) == CHILD_ID
    assert deps.purpose == "mentor_guide"
    assert deps.mentor["id"] == "guardian"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_child_not_found(dialogue_svc) -> None:
    dialogue_svc.session = ScriptedSession([FakeExecuteResult(rows=None)])
    with pytest.raises(RuntimeError, match="Crew member not found"):
        await dialogue_svc._child(AUTH_USER_ID, CHILD_ID)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_load_history_session_closed(dialogue_svc) -> None:
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(rows=sample_child()),
            FakeExecuteResult(scalar=None),
        ]
    )
    with pytest.raises(RuntimeError, match="Dialogue session not found or closed"):
        await dialogue_svc.load_history(AUTH_USER_ID, CHILD_ID, SESSION_ID, "turn-1")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_load_history_before_turn_missing(dialogue_svc) -> None:
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(rows=sample_child()),
            FakeExecuteResult(scalar=1),
            FakeExecuteResult(rows=None),
        ]
    )
    with pytest.raises(ValueError, match="before_turn_id not found"):
        await dialogue_svc.load_history(AUTH_USER_ID, CHILD_ID, SESSION_ID, "missing")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_submit_turn_rejects_invalid_reply(dialogue_svc) -> None:
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(rows=sample_child()),
            FakeExecuteResult(rows=sample_session_row()),
        ]
    )
    with pytest.raises(ValueError, match="reply invalid"):
        await dialogue_svc.submit_turn(
            AUTH_USER_ID,
            CHILD_ID,
            SESSION_ID,
            {"kind": "invalid"},
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_submit_turn_rejects_empty_text(dialogue_svc) -> None:
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(rows=sample_child()),
            FakeExecuteResult(rows=sample_session_row()),
        ]
    )
    with pytest.raises(ValueError, match="reply empty"):
        await dialogue_svc.submit_turn(
            AUTH_USER_ID,
            CHILD_ID,
            SESSION_ID,
            {"kind": "text", "text": "   "},
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_open_session_reuses_existing_row(dialogue_svc, mocker) -> None:
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(rows=sample_child()),
            FakeExecuteResult(rows=sample_session_row()),
            FakeExecuteResult(rows=[]),
            FakeExecuteResult(rows=None),
        ]
    )
    mocker.patch.object(dialogue_svc, "_history", new=AsyncMock(return_value={"has_older": False}))
    body = await dialogue_svc.open_session(AUTH_USER_ID, CHILD_ID, "first_run")
    assert body["session_id"] == SESSION_ID
    assert body["flow_id"] == "first_run"
    assert body["onboarding_step"] == "choose_world"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_phase_choose_world_invalid_option(dialogue_svc) -> None:
    dialogue_svc._mentor_turn = AsyncMock(return_value={"id": "t-clarify", "role": "mentor"})
    effects, turns = await dialogue_svc._phase_choose_world(
        CHILD_ID,
        SESSION_ID,
        sample_session_row(),
        1,
        {"kind": "option", "option_id": "invalid"},
        "invalid",
    )
    assert effects == []
    assert turns[0]["role"] == "mentor"
    dialogue_svc._mentor_turn.assert_awaited_once()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_phase_choose_world_valid_updates_theme(dialogue_svc, mocker) -> None:
    dialogue_svc._agent_mentor_turn = AsyncMock(return_value={"id": "t-next", "role": "agent"})
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(),
            FakeExecuteResult(),
            FakeExecuteResult(rows=sample_child(onboarding_step="choose_name")),
        ]
    )
    effects, turns = await dialogue_svc._phase_choose_world(
        CHILD_ID,
        SESSION_ID,
        sample_session_row(),
        1,
        {"kind": "option", "option_id": "sci-fi"},
        "sci-fi",
    )
    assert {"type": "set_world_theme", "value": "sci-fi"} in effects
    assert turns[0]["role"] == "agent"


@pytest.mark.unit
def test_read_placement_state_from_ledger(dialogue_svc, tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    dialogue_svc.ledger = JourneyLedger(tmp_path)
    dialogue_svc.ledger.append_event(
        PARENT_ID,
        CHILD_ID,
        SESSION_ID,
        kind="placement_queue",
        payload={"queue": [{"item_key": "a"}, {"item_key": "b"}]},
        world_theme="fantasy",
    )
    dialogue_svc.ledger.append_event(
        PARENT_ID,
        CHILD_ID,
        SESSION_ID,
        kind="placement_answer",
        payload={"index": 0, "score": 1.0},
        world_theme="fantasy",
    )
    state = dialogue_svc._read_placement_state(PARENT_ID, CHILD_ID, SESSION_ID, "fantasy")
    assert state is not None
    assert state["index"] == 1
    assert len(state["queue"]) == 2
    get_settings.cache_clear()


@pytest.mark.unit
def test_read_path_pack_and_progress(dialogue_svc, tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    dialogue_svc.ledger = JourneyLedger(tmp_path)
    dialogue_svc.ledger.append_event(
        PARENT_ID,
        CHILD_ID,
        SESSION_ID,
        kind="path_pack",
        payload={"pack": [{"path_id": "p1", "title": "Bosque"}]},
        world_theme="fantasy",
    )
    dialogue_svc.ledger.append_event(
        PARENT_ID,
        CHILD_ID,
        SESSION_ID,
        kind="path_progress",
        payload={"current_index": 2},
        world_theme="fantasy",
    )
    pack = dialogue_svc._read_path_pack(PARENT_ID, CHILD_ID, SESSION_ID, "fantasy")
    progress = dialogue_svc._read_path_progress(PARENT_ID, CHILD_ID, SESSION_ID, "fantasy")
    assert pack[0]["path_id"] == "p1"
    assert progress["current_index"] == 2
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_submit_turn_compose_failed_fallback(dialogue_svc, mocker) -> None:
    child = sample_child(onboarding_step="complete", placement_status="completed")
    mentor_turn = sample_turn_row(meta={"phase": "dialogue"})
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(rows=child),
            FakeExecuteResult(rows=sample_session_row(flow_id="adventure")),
            FakeExecuteResult(scalar=1),
            FakeExecuteResult(rows=sample_turn_row(role="explorer", sequence=2)),
            FakeExecuteResult(rows=child),
            FakeExecuteResult(rows=child),
        ]
    )
    dialogue_svc._insert = AsyncMock(side_effect=lambda row: DialogueService._turn(sample_turn_row(**row)))
    dialogue_svc._last_mentor = AsyncMock(return_value=DialogueService._turn(mentor_turn))
    dialogue_svc._agent_mentor_turn = AsyncMock(
        side_effect=AiProductError("ai_compose_failed", "fallo", retryable=False)
    )
    dialogue_svc._mentor_turn = AsyncMock(
        return_value=DialogueService._turn(sample_turn_row(meta={"phase": "compose_failed"}))
    )
    mocker.patch(
        "app.services.dialogue.WaitingCopyService"
    ).return_value.waiting_copy_from_cache = AsyncMock(return_value=[])
    result = await dialogue_svc.submit_turn(
        AUTH_USER_ID,
        CHILD_ID,
        SESSION_ID,
        {"kind": "text", "text": "Hola"},
    )
    assert result["agent_turns"][0]["meta"]["phase"] == "compose_failed"
    dialogue_svc._mentor_turn.assert_awaited()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_submit_turn_session_not_found(dialogue_svc) -> None:
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(rows=sample_child()),
            FakeExecuteResult(rows=None),
        ]
    )
    with pytest.raises(ValueError, match="session not found"):
        await dialogue_svc.submit_turn(
            AUTH_USER_ID,
            CHILD_ID,
            SESSION_ID,
            {"kind": "text", "text": "Hola"},
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_load_history_success(dialogue_svc, mocker) -> None:
    anchor = {"id": "turn-2", "created_at": datetime.now(timezone.utc)}
    turn_row = sample_turn_row(id="turn-1", sequence=1)
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(rows=sample_child()),
            FakeExecuteResult(scalar=1),
            FakeExecuteResult(rows=anchor),
            FakeExecuteResult(rows=[turn_row]),
        ]
    )
    mocker.patch.object(
        dialogue_svc,
        "_history",
        new=AsyncMock(return_value={"has_older": False, "page_size": 24}),
    )
    result = await dialogue_svc.load_history(AUTH_USER_ID, CHILD_ID, SESSION_ID, "turn-2")
    assert len(result["turns"]) == 1
    assert result["turns"][0]["id"] == "turn-1"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_open_session_creates_new_session(dialogue_svc, mocker) -> None:
    new_session = sample_session_row(id="44444444-4444-4444-8444-444444444444")
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(rows=sample_child(onboarding_step="pending_entry")),
            FakeExecuteResult(rows=None),
            FakeExecuteResult(rows=None),
            FakeExecuteResult(rows=new_session),
            FakeExecuteResult(rows=sample_child(onboarding_step="choose_world")),
            FakeExecuteResult(rows=[]),
        ]
    )
    mocker.patch.object(dialogue_svc, "_seed", new=AsyncMock())
    mocker.patch.object(
        dialogue_svc,
        "_history",
        new=AsyncMock(return_value={"has_older": False}),
    )
    mocker.patch.object(dialogue_svc, "_last_mentor", new=AsyncMock(return_value=None))
    body = await dialogue_svc.open_session(AUTH_USER_ID, CHILD_ID)
    dialogue_svc._seed.assert_awaited_once()
    assert body["session_id"] == "44444444-4444-4444-8444-444444444444"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_phase_choose_name_empty_clarifies(dialogue_svc) -> None:
    dialogue_svc._mentor_turn = AsyncMock(
        return_value=DialogueService._turn(
            sample_turn_row(meta={"phase": "choose_name", "clarification": True})
        )
    )
    effects, turns = await dialogue_svc._phase_choose_name(
        CHILD_ID,
        SESSION_ID,
        sample_session_row(),
        1,
        "   ",
    )
    assert effects == []
    assert turns[0]["meta"]["clarification"] is True


@pytest.mark.unit
@pytest.mark.asyncio
async def test_phase_choose_name_valid(dialogue_svc) -> None:
    dialogue_svc._agent_mentor_turn = AsyncMock(return_value={"id": "t-age", "role": "agent"})
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(),
            FakeExecuteResult(rows=sample_child(display_name="Luna", onboarding_step="choose_age")),
        ]
    )
    effects, turns = await dialogue_svc._phase_choose_name(
        CHILD_ID,
        SESSION_ID,
        sample_session_row(),
        1,
        "Luna",
    )
    assert effects[0] == {"type": "set_display_name", "value": "Luna"}
    assert turns[0]["role"] == "agent"
    dialogue_svc._agent_mentor_turn.assert_awaited_once()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_phase_choose_age_invalid_text(dialogue_svc) -> None:
    with pytest.raises(ValueError, match="age invalid"):
        await dialogue_svc._phase_choose_age(
            CHILD_ID,
            SESSION_ID,
            sample_session_row(),
            1,
            "no-es-numero",
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_phase_choose_age_out_of_range(dialogue_svc) -> None:
    with pytest.raises(ValueError, match="age_years invalid"):
        await dialogue_svc._phase_choose_age(
            CHILD_ID,
            SESSION_ID,
            sample_session_row(),
            1,
            "4",
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_phase_choose_age_valid(dialogue_svc) -> None:
    dialogue_svc._agent_mentor_turn = AsyncMock(return_value={"id": "t-char", "role": "agent"})
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(),
            FakeExecuteResult(
                rows=sample_child(
                    age_years=9,
                    age_band="band_child",
                    onboarding_step="choose_character",
                )
            ),
        ]
    )
    effects, turns = await dialogue_svc._phase_choose_age(
        CHILD_ID,
        SESSION_ID,
        sample_session_row(),
        1,
        "9",
    )
    assert effects[0]["type"] == "set_age"
    assert effects[1]["to"] == "choose_character"
    assert turns[0]["role"] == "agent"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_phase_character_fallback_without_llm(dialogue_svc, mocker) -> None:
    mocker.patch(
        "app.services.dialogue.run_purpose",
        new=AsyncMock(side_effect=RuntimeError("sin ia")),
    )
    dialogue_svc._mentor_turn = AsyncMock(
        return_value=DialogueService._turn(
            sample_turn_row(meta={"phase": "handoff_placement"}, role="mentor")
        )
    )
    dialogue_svc.session = ScriptedSession([FakeExecuteResult()])
    child = sample_child(onboarding_step="choose_character")
    effects, turns = await dialogue_svc._phase_character(
        CHILD_ID,
        SESSION_ID,
        sample_session_row(),
        1,
        "dragón azul",
        child,
    )
    assert effects[1]["to"] == "placement"
    assert turns[0]["meta"]["phase"] == "handoff_placement"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_phase_character_with_profile(dialogue_svc, mocker) -> None:
    profile = TravelerProfileEnvelope(
        agent_text="Eres un dragón azul valiente.",
        species="dragón",
        palette="azul y plata",
        features=["valiente", "curioso"],
        abilities=["volar"],
        vibe="dragón azul",
        description_md="Un dragón curioso.",
    )
    mocker.patch(
        "app.services.dialogue.run_purpose",
        new=AsyncMock(return_value=(profile, "gemini-test")),
    )
    dialogue_svc._mentor_turn = AsyncMock(
        return_value=DialogueService._turn(
            sample_turn_row(meta={"phase": "handoff_placement"}, role="mentor")
        )
    )
    dialogue_svc.session = ScriptedSession([FakeExecuteResult()])
    child = sample_child(onboarding_step="choose_character", parent_id=PARENT_ID)
    effects, _turns = await dialogue_svc._phase_character(
        CHILD_ID,
        SESSION_ID,
        sample_session_row(),
        1,
        "dragón azul",
        child,
    )
    assert effects[0]["value"]["species"] == "dragón"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_compose_placement_queue_fallback(dialogue_svc, mocker) -> None:
    mocker.patch(
        "app.services.dialogue.run_purpose",
        new=AsyncMock(side_effect=RuntimeError("fallo")),
    )
    queue = await dialogue_svc._compose_placement_queue(
        sample_child(),
        SESSION_ID,
        ["math"],
    )
    assert queue[0]["item_key"] == "fallback_1"
    assert queue[0]["correct_option_id"] == "b"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_compose_placement_queue_from_llm(dialogue_svc, mocker) -> None:
    bundle = PlacementQueueEnvelope(
        items=[
            PlacementItemEnvelope(
                subject_id="math",
                item_key="q1",
                prompt_text="¿2+2?",
                options=[],
                correct_option_id="b",
            )
        ]
    )
    mocker.patch(
        "app.services.dialogue.run_purpose",
        new=AsyncMock(return_value=(bundle, "gemini-test")),
    )
    queue = await dialogue_svc._compose_placement_queue(
        sample_child(),
        SESSION_ID,
        ["math"],
    )
    assert queue[0]["item_key"] == "q1"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_compose_path_pack_fallback(dialogue_svc, mocker) -> None:
    mocker.patch(
        "app.services.dialogue.run_purpose",
        new=AsyncMock(side_effect=RuntimeError("fallo")),
    )
    pack = await dialogue_svc._compose_path_pack(sample_child(), SESSION_ID)
    assert len(pack) == 3
    assert pack[0]["path_id"] == "path_1"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_placement_answer_without_queue(dialogue_svc) -> None:
    dialogue_svc._mentor_turn = AsyncMock(
        return_value=DialogueService._turn(
            sample_turn_row(meta={"phase": "handoff_placement"})
        )
    )
    effects, turns = await dialogue_svc._placement_answer(
        CHILD_ID,
        SESSION_ID,
        sample_session_row(),
        1,
        "continuar",
        {"kind": "continue"},
        {"meta": {"phase": "placement_item"}},
    )
    assert effects == []
    assert turns[0]["meta"]["phase"] == "handoff_placement"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_placement_answer_finishes_and_starts_paths(dialogue_svc, mocker, tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    dialogue_svc.ledger = JourneyLedger(tmp_path)
    dialogue_svc.ledger.append_event(
        PARENT_ID,
        CHILD_ID,
        SESSION_ID,
        kind="placement_queue",
        payload={
            "queue": [
                {
                    "subject_id": "math",
                    "item_key": "only",
                    "item_type": "mcq",
                    "prompt_text": "¿2+2?",
                    "correct_option_id": "b",
                    "options": [{"id": "b", "label": "4"}],
                }
            ]
        },
        world_theme="fantasy",
    )
    dialogue_svc.session = ScriptedSession(
        [FakeExecuteResult(rows=sample_child(parent_id=PARENT_ID))]
    )
    mocker.patch.object(dialogue_svc, "_finish_placement", new=AsyncMock())
    mocker.patch.object(
        dialogue_svc,
        "_start_path_choice",
        new=AsyncMock(return_value=([{"type": "placement_completed"}], [{"id": "path-turn"}])),
    )
    effects, turns = await dialogue_svc._placement_answer(
        CHILD_ID,
        SESSION_ID,
        sample_session_row(),
        1,
        "b",
        {"kind": "option", "option_id": "b"},
        {"meta": {"phase": "placement_item"}},
    )
    dialogue_svc._finish_placement.assert_awaited_once()
    dialogue_svc._start_path_choice.assert_awaited_once()
    assert turns[0]["id"] == "path-turn"
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_choose_path_without_pack(dialogue_svc) -> None:
    dialogue_svc._mentor_turn = AsyncMock(
        return_value=DialogueService._turn(sample_turn_row(meta={"phase": "choose_path"}))
    )
    child = sample_child(parent_id=PARENT_ID)
    effects, turns = await dialogue_svc._choose_path(
        CHILD_ID,
        SESSION_ID,
        sample_session_row(),
        1,
        {"kind": "option", "option_id": "p1"},
        "p1",
        child,
    )
    assert effects == []
    assert turns[0]["meta"]["phase"] == "choose_path"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_choose_path_valid_selection(dialogue_svc, tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    dialogue_svc.ledger = JourneyLedger(tmp_path)
    dialogue_svc.ledger.append_event(
        PARENT_ID,
        CHILD_ID,
        SESSION_ID,
        kind="path_pack",
        payload={
            "pack": [
                {
                    "path_id": "p1",
                    "title": "Bosque",
                    "intro": "Entramos al bosque.",
                    "learning_blurb": "Practicamos lógica.",
                    "challenges": [],
                }
            ]
        },
        world_theme="fantasy",
    )
    dialogue_svc._mentor_turn = AsyncMock(
        return_value=DialogueService._turn(sample_turn_row(meta={"phase": "path_intro"}))
    )
    child = sample_child(parent_id=PARENT_ID)
    effects, turns = await dialogue_svc._choose_path(
        CHILD_ID,
        SESSION_ID,
        sample_session_row(),
        1,
        {"kind": "option", "option_id": "p1"},
        "p1",
        child,
    )
    assert effects[0] == {"type": "path_chosen", "value": "p1"}
    assert turns[0]["meta"]["phase"] == "path_intro"
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_path_next_challenge_presents_mcq(dialogue_svc, tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    dialogue_svc.ledger = JourneyLedger(tmp_path)
    dialogue_svc.ledger.append_event(
        PARENT_ID,
        CHILD_ID,
        SESSION_ID,
        kind="path_progress",
        payload={
            "path_id": "p1",
            "challenge_index": 0,
            "path": {
                "path_id": "p1",
                "challenges": [
                    {
                        "prompt_text": "¿Seguimos?",
                        "item_type": "mcq",
                        "options": [{"id": "a", "label": "Sí"}],
                        "correct_option_id": "a",
                    }
                ],
            },
        },
        world_theme="fantasy",
    )
    dialogue_svc._mentor_turn = AsyncMock(
        return_value=DialogueService._turn(sample_turn_row(meta={"phase": "path_challenge"}))
    )
    child = sample_child(parent_id=PARENT_ID)
    effects, turns = await dialogue_svc._path_next_challenge(
        CHILD_ID,
        SESSION_ID,
        sample_session_row(),
        1,
        child,
    )
    assert effects == []
    assert turns[0]["meta"]["phase"] == "path_challenge"
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_path_challenge_answer_wrong_retries(dialogue_svc, tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    dialogue_svc.ledger = JourneyLedger(tmp_path)
    dialogue_svc.ledger.append_event(
        PARENT_ID,
        CHILD_ID,
        SESSION_ID,
        kind="path_progress",
        payload={
            "path_id": "p1",
            "challenge_index": 0,
            "path": {
                "path_id": "p1",
                "challenges": [
                    {
                        "prompt_text": "¿2+2?",
                        "item_type": "mcq",
                        "options": [{"id": "a", "label": "3"}, {"id": "b", "label": "4"}],
                        "correct_option_id": "b",
                        "explanation": "Casi, prueba otra vez.",
                    }
                ],
            },
        },
        world_theme="fantasy",
    )
    dialogue_svc._mentor_turn = AsyncMock(
        return_value=DialogueService._turn(
            sample_turn_row(meta={"phase": "path_intro", "retry": True})
        )
    )
    child = sample_child(parent_id=PARENT_ID)
    effects, turns = await dialogue_svc._path_challenge_answer(
        CHILD_ID,
        SESSION_ID,
        sample_session_row(),
        1,
        "a",
        {"kind": "option", "option_id": "a"},
        {"meta": {"phase": "path_challenge", "challenge_index": 0}},
        child,
    )
    assert effects == []
    assert turns[0]["meta"]["retry"] is True
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_agent_mentor_turn_uses_orchestrator(dialogue_svc, mocker) -> None:
    envelope = DialogueEnvelope(agent_text="Hola explorador", input_mode="continue")
    dialogue_svc.orchestrator.run = AsyncMock(
        return_value=TurnResult(
            purpose="mentor_guide",
            output=envelope,
            model_used="gemini-test",
            tool_notes=[],
        )
    )
    dialogue_svc._mentor_turn = AsyncMock(return_value={"id": "t-agent", "role": "mentor"})
    child = sample_child()
    turn = await dialogue_svc._agent_mentor_turn(
        child,
        SESSION_ID,
        "first_run",
        2,
        "hola",
        "choose_name",
        purpose="mentor_guide",
    )
    dialogue_svc.orchestrator.run.assert_awaited_once()
    dialogue_svc._mentor_turn.assert_awaited_once()
    assert turn["id"] == "t-agent"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_history_empty_turns(dialogue_svc) -> None:
    result = await dialogue_svc._history(CHILD_ID, [])
    assert result["has_older"] is False
    assert result["oldest_turn_id"] is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_history_detects_older_pages(dialogue_svc) -> None:
    turn = DialogueService._turn(sample_turn_row())
    dialogue_svc.session = ScriptedSession([FakeExecuteResult(scalar=1)])
    result = await dialogue_svc._history(CHILD_ID, [turn])
    assert result["has_older"] is True
    assert result["oldest_turn_id"] == turn["id"]


@pytest.mark.unit
def test_read_placement_state_without_parent(dialogue_svc) -> None:
    assert dialogue_svc._read_placement_state(None, CHILD_ID, SESSION_ID, "fantasy") is None


@pytest.mark.unit
def test_read_path_pack_without_parent(dialogue_svc) -> None:
    assert dialogue_svc._read_path_pack(None, CHILD_ID, SESSION_ID, "fantasy") == []


@pytest.mark.unit
@pytest.mark.asyncio
async def test_child_by_id_missing_returns_stub(dialogue_svc) -> None:
    dialogue_svc.session = ScriptedSession([FakeExecuteResult(rows=None)])
    child = await dialogue_svc._child_by_id("missing-id")
    assert child == {"id": "missing-id"}


@pytest.mark.unit
@pytest.mark.asyncio
async def test_seed_pending_entry(dialogue_svc, mocker) -> None:
    dialogue_svc._insert = AsyncMock()
    dialogue_svc.session = ScriptedSession([FakeExecuteResult()])
    await dialogue_svc._seed(
        SESSION_ID,
        CHILD_ID,
        "first_run",
        sample_child(onboarding_step="pending_entry"),
    )
    dialogue_svc._insert.assert_awaited_once()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_seed_placement_handoff(dialogue_svc, mocker) -> None:
    dialogue_svc._insert = AsyncMock()
    await dialogue_svc._seed(
        SESSION_ID,
        CHILD_ID,
        "placement",
        sample_child(onboarding_step="placement"),
    )
    dialogue_svc._insert.assert_awaited_once()
    assert dialogue_svc._insert.await_args.args[0]["meta"]["phase"] == "handoff_placement"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_finish_placement_persists_levels(dialogue_svc, tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    dialogue_svc.ledger = JourneyLedger(tmp_path)
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(),
            FakeExecuteResult(),
            FakeExecuteResult(),
        ]
    )
    child = sample_child(parent_id=PARENT_ID, placement_status="in_progress")
    await dialogue_svc._finish_placement(
        child,
        SESSION_ID,
        [{"subject_id": "math", "item_key": "q1"}],
    )
    assert len(dialogue_svc.session.executed) == 3
    events = dialogue_svc.ledger.read_events(
        PARENT_ID, CHILD_ID, SESSION_ID, world_theme="fantasy"
    )
    assert any(e.get("kind") == "placement_result" for e in events)
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_submit_turn_compose_failed_retries_path_pack(dialogue_svc, mocker) -> None:
    child = sample_child(onboarding_step="complete", placement_status="completed")
    mentor_turn = sample_turn_row(
        meta={"phase": "compose_failed", "retry_action": "path_pack", "retry": True}
    )
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(rows=child),
            FakeExecuteResult(rows=sample_session_row(flow_id="adventure")),
            FakeExecuteResult(scalar=1),
            FakeExecuteResult(rows=sample_turn_row(role="explorer", sequence=2)),
            FakeExecuteResult(rows=child),
            FakeExecuteResult(rows=child),
        ]
    )
    dialogue_svc._insert = AsyncMock(side_effect=lambda row: DialogueService._turn(sample_turn_row(**row)))
    dialogue_svc._last_mentor = AsyncMock(return_value=DialogueService._turn(mentor_turn))
    dialogue_svc._start_path_choice = AsyncMock(
        return_value=([{"type": "path_pack"}], [{"id": "retry-turn", "role": "mentor"}])
    )
    mocker.patch(
        "app.services.dialogue.WaitingCopyService"
    ).return_value.waiting_copy_from_cache = AsyncMock(return_value=[])
    result = await dialogue_svc.submit_turn(
        AUTH_USER_ID,
        CHILD_ID,
        SESSION_ID,
        {"kind": "continue"},
    )
    dialogue_svc._start_path_choice.assert_awaited_once()
    assert result["agent_turns"][0]["id"] == "retry-turn"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_start_placement_starts_exam(dialogue_svc, mocker) -> None:
    child = sample_child(parent_id=PARENT_ID)
    queue_item = {
        "subject_id": "math",
        "item_key": "q1",
        "item_type": "mcq",
        "prompt_text": "¿2+2?",
        "presentation_text": "Calienta motores",
        "options": [{"id": "b", "label": "4"}],
        "correct_option_id": "b",
    }
    mocker.patch(
        "app.services.dialogue.pick_waiting_batch",
        new=AsyncMock(return_value=["Un momento..."]),
    )
    mocker.patch.object(
        dialogue_svc,
        "_compose_placement_queue",
        new=AsyncMock(return_value=[queue_item]),
    )
    mocker.patch.object(dialogue_svc, "_child", new=AsyncMock(return_value=child))
    placement = mocker.patch("app.services.dialogue.PlacementService").return_value
    placement.start_exam = AsyncMock(
        return_value={
            "effects": [{"type": "advance_onboarding", "to": "placement"}],
            "turn": {
                "session_id": SESSION_ID,
                "child_id": CHILD_ID,
                "flow_id": "first_run",
                "sequence": 2,
                "role": "mentor",
                "text": "Calienta motores",
                "input_mode": "options_only",
                "options": queue_item["options"],
                "meta": {"phase": "placement_item", "waiting_hints": ["Un momento..."]},
                "model_used": None,
            },
        }
    )
    dialogue_svc._insert = AsyncMock(
        return_value=DialogueService._turn(sample_turn_row(meta={"phase": "placement_item"}))
    )
    effects, turns = await dialogue_svc._start_placement(
        AUTH_USER_ID, CHILD_ID, SESSION_ID, sample_session_row(), 1
    )
    assert effects[0]["to"] == "placement"
    assert turns[0]["meta"]["phase"] == "placement_item"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_start_path_choice_presents_options(dialogue_svc, mocker, tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    child = sample_child(parent_id=PARENT_ID, placement_status="completed")
    mocker.patch(
        "app.services.dialogue.pick_waiting_batch",
        new=AsyncMock(return_value=["Preparando caminos..."]),
    )
    mocker.patch.object(
        dialogue_svc,
        "_compose_path_pack",
        new=AsyncMock(
            return_value=[
                {
                    "path_id": "p1",
                    "title": "Bosque",
                    "intro": "Entramos",
                    "learning_blurb": "Lógica",
                    "challenges": [],
                }
            ]
        ),
    )
    dialogue_svc._mentor_turn = AsyncMock(
        return_value=DialogueService._turn(sample_turn_row(meta={"phase": "choose_path"}))
    )
    effects, turns = await dialogue_svc._start_path_choice(
        child, SESSION_ID, sample_session_row(), 3
    )
    assert effects[1]["type"] == "placement_completed"
    assert turns[0]["meta"]["phase"] == "choose_path"
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_placement_answer_advances_queue(dialogue_svc, tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    dialogue_svc.ledger = JourneyLedger(tmp_path)
    dialogue_svc.ledger.append_event(
        PARENT_ID,
        CHILD_ID,
        SESSION_ID,
        kind="placement_queue",
        payload={
            "queue": [
                {
                    "subject_id": "math",
                    "item_key": "q1",
                    "item_type": "mcq",
                    "prompt_text": "¿2+2?",
                    "correct_option_id": "b",
                    "options": [{"id": "b", "label": "4"}],
                },
                {
                    "subject_id": "language",
                    "item_key": "q2",
                    "item_type": "mcq",
                    "prompt_text": "¿Letra A?",
                    "correct_option_id": "a",
                    "options": [{"id": "a", "label": "A"}],
                },
            ]
        },
        world_theme="fantasy",
    )
    dialogue_svc.session = ScriptedSession(
        [FakeExecuteResult(rows=sample_child(parent_id=PARENT_ID))]
    )
    dialogue_svc._insert = AsyncMock(
        return_value=DialogueService._turn(sample_turn_row(meta={"phase": "placement_item"}))
    )
    effects, turns = await dialogue_svc._placement_answer(
        CHILD_ID,
        SESSION_ID,
        sample_session_row(),
        1,
        "b",
        {"kind": "option", "option_id": "b"},
        {"meta": {"phase": "placement_item"}},
    )
    assert effects == []
    assert turns[0]["meta"]["phase"] == "placement_item"
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_path_next_challenge_completed(dialogue_svc, tmp_path, monkeypatch, mocker) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    dialogue_svc.ledger = JourneyLedger(tmp_path)
    dialogue_svc.ledger.append_event(
        PARENT_ID,
        CHILD_ID,
        SESSION_ID,
        kind="path_progress",
        payload={
            "path_id": "p1",
            "challenge_index": 1,
            "path": {
                "path_id": "p1",
                "challenges": [
                    {
                        "prompt_text": "¿Seguimos?",
                        "item_type": "mcq",
                        "options": [{"id": "a", "label": "Sí"}],
                        "correct_option_id": "a",
                    }
                ],
            },
        },
        world_theme="fantasy",
    )
    dialogue_svc._mentor_turn = AsyncMock(
        return_value=DialogueService._turn(
            sample_turn_row(meta={"phase": "adventure_ready", "path_completed": True})
        )
    )
    child = sample_child(parent_id=PARENT_ID)
    effects, turns = await dialogue_svc._path_next_challenge(
        CHILD_ID, SESSION_ID, sample_session_row(), 2, child
    )
    assert effects[0]["type"] == "path_completed"
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_path_challenge_answer_correct(dialogue_svc, tmp_path, monkeypatch, mocker) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    dialogue_svc.ledger = JourneyLedger(tmp_path)
    dialogue_svc.ledger.append_event(
        PARENT_ID,
        CHILD_ID,
        SESSION_ID,
        kind="path_progress",
        payload={
            "path_id": "p1",
            "challenge_index": 0,
            "path": {
                "path_id": "p1",
                "challenges": [
                    {
                        "prompt_text": "¿2+2?",
                        "item_type": "mcq",
                        "options": [{"id": "b", "label": "4"}],
                        "correct_option_id": "b",
                    }
                ],
            },
        },
        world_theme="fantasy",
    )
    dialogue_svc._path_next_challenge = AsyncMock(
        return_value=([], [{"id": "next", "role": "mentor"}])
    )
    dialogue_svc.session = ScriptedSession(
        [FakeExecuteResult(rows=sample_child(parent_id=PARENT_ID))]
    )
    child = sample_child(parent_id=PARENT_ID)
    await dialogue_svc._path_challenge_answer(
        CHILD_ID,
        SESSION_ID,
        sample_session_row(),
        1,
        "b",
        {"kind": "option", "option_id": "b"},
        {"meta": {"phase": "path_challenge", "challenge_index": 0}},
        child,
    )
    dialogue_svc._path_next_challenge.assert_awaited_once()
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_mentor_turn_persists(dialogue_svc, tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    dialogue_svc.ledger = JourneyLedger(tmp_path)
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(rows=sample_turn_row(role="mentor")),
            FakeExecuteResult(rows={"parent_id": PARENT_ID}),
        ]
    )
    turn = await dialogue_svc._mentor_turn(
        SESSION_ID,
        CHILD_ID,
        "first_run",
        2,
        "Hola",
        "continue",
        None,
        {"phase": "dialogue"},
    )
    assert turn["role"] == "mentor"
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_submit_turn_routes_choose_name(dialogue_svc, mocker) -> None:
    child = sample_child(onboarding_step="choose_name")
    mentor_turn = sample_turn_row(meta={"phase": "choose_name"})
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(rows=child),
            FakeExecuteResult(rows=sample_session_row()),
            FakeExecuteResult(scalar=1),
            FakeExecuteResult(rows=sample_turn_row(role="explorer", sequence=2)),
            FakeExecuteResult(rows=child),
            FakeExecuteResult(rows=child),
        ]
    )
    dialogue_svc._insert = AsyncMock(side_effect=lambda row: DialogueService._turn(sample_turn_row(**row)))
    dialogue_svc._last_mentor = AsyncMock(return_value=DialogueService._turn(mentor_turn))
    dialogue_svc._phase_choose_name = AsyncMock(
        return_value=([{"type": "set_display_name", "value": "Luna"}], [{"id": "t1", "role": "agent"}])
    )
    mocker.patch(
        "app.services.dialogue.WaitingCopyService"
    ).return_value.waiting_copy_from_cache = AsyncMock(return_value=[])
    result = await dialogue_svc.submit_turn(
        AUTH_USER_ID, CHILD_ID, SESSION_ID, {"kind": "text", "text": "Luna"}
    )
    dialogue_svc._phase_choose_name.assert_awaited_once()
    assert result["agent_turns"][0]["role"] == "agent"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_maybe_write_session_summary_fallback(dialogue_svc, tmp_path, monkeypatch, mocker) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    dialogue_svc.ledger = JourneyLedger(tmp_path)
    dialogue_svc.ledger.append_dialogue(
        PARENT_ID, CHILD_ID, SESSION_ID, kind="explorer_reply", text="hola"
    )
    dialogue_svc.session = ScriptedSession(
        [FakeExecuteResult(rows=sample_child(parent_id=PARENT_ID))]
    )
    mocker.patch(
        "app.services.dialogue.run_purpose",
        new=AsyncMock(side_effect=RuntimeError("sin ia")),
    )
    await dialogue_svc._maybe_write_session_summary(CHILD_ID, SESSION_ID)
    summaries = list(tmp_path.rglob("summary.md"))
    assert summaries
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.asyncio
@pytest.mark.parametrize(
    "phase,handler_name",
    [
        ("choose_age", "_phase_choose_age"),
        ("choose_character_species", "_phase_character"),
        ("handoff_placement", "_start_placement"),
        ("placement_item", "_placement_answer"),
        ("choose_path", "_choose_path"),
        ("path_intro", "_path_next_challenge"),
        ("path_challenge", "_path_challenge_answer"),
    ],
)
async def test_submit_turn_routes_onboarding_phases(
    dialogue_svc, mocker, phase: str, handler_name: str
) -> None:
    child = sample_child(onboarding_step=phase, placement_status="in_progress")
    mentor_turn = sample_turn_row(meta={"phase": phase})
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(rows=child),
            FakeExecuteResult(rows=sample_session_row()),
            FakeExecuteResult(scalar=1),
            FakeExecuteResult(rows=sample_turn_row(role="explorer", sequence=2)),
            FakeExecuteResult(rows=child),
            FakeExecuteResult(rows=child),
        ]
    )
    handler = AsyncMock(return_value=([], [{"id": "phase-turn", "role": "mentor"}]))
    setattr(dialogue_svc, handler_name, handler)
    dialogue_svc._insert = AsyncMock(side_effect=lambda row: DialogueService._turn(sample_turn_row(**row)))
    dialogue_svc._last_mentor = AsyncMock(return_value=DialogueService._turn(mentor_turn))
    mocker.patch(
        "app.services.dialogue.WaitingCopyService"
    ).return_value.waiting_copy_from_cache = AsyncMock(return_value=[])
    reply = (
        {"kind": "continue"}
        if phase in {"handoff_placement", "path_intro"}
        else {"kind": "text", "text": "valor"}
    )
    result = await dialogue_svc.submit_turn(AUTH_USER_ID, CHILD_ID, SESSION_ID, reply)
    handler.assert_awaited_once()
    assert result["agent_turns"][0]["id"] == "phase-turn"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_submit_turn_compose_failed_retries_placement(dialogue_svc, mocker) -> None:
    child = sample_child(onboarding_step="placement", placement_status="in_progress")
    mentor_turn = sample_turn_row(
        meta={"phase": "compose_failed", "retry_action": "placement", "retry": True}
    )
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(rows=child),
            FakeExecuteResult(rows=sample_session_row(flow_id="placement")),
            FakeExecuteResult(scalar=1),
            FakeExecuteResult(rows=sample_turn_row(role="explorer", sequence=2)),
            FakeExecuteResult(rows=child),
            FakeExecuteResult(rows=child),
        ]
    )
    dialogue_svc._insert = AsyncMock(side_effect=lambda row: DialogueService._turn(sample_turn_row(**row)))
    dialogue_svc._last_mentor = AsyncMock(return_value=DialogueService._turn(mentor_turn))
    dialogue_svc._start_placement = AsyncMock(
        return_value=([{"type": "placement"}], [{"id": "place-turn", "role": "mentor"}])
    )
    mocker.patch(
        "app.services.dialogue.WaitingCopyService"
    ).return_value.waiting_copy_from_cache = AsyncMock(return_value=[])
    result = await dialogue_svc.submit_turn(
        AUTH_USER_ID, CHILD_ID, SESSION_ID, {"kind": "continue"}
    )
    dialogue_svc._start_placement.assert_awaited_once()
    assert result["agent_turns"][0]["id"] == "place-turn"


@pytest.mark.unit
def test_ledger_explorer_without_parent(dialogue_svc) -> None:
    child = sample_child()
    child.pop("parent_id", None)
    dialogue_svc._ledger_explorer(child, SESSION_ID, "hola", {"kind": "text"})


@pytest.mark.unit
@pytest.mark.asyncio
async def test_choose_path_falls_back_to_first_pack(dialogue_svc, tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    dialogue_svc.ledger = JourneyLedger(tmp_path)
    dialogue_svc.ledger.append_event(
        PARENT_ID,
        CHILD_ID,
        SESSION_ID,
        kind="path_pack",
        payload={
            "pack": [
                {
                    "path_id": "p1",
                    "title": "Bosque",
                    "intro": "Entramos",
                    "learning_blurb": "",
                    "challenges": [],
                }
            ]
        },
        world_theme="fantasy",
    )
    dialogue_svc._mentor_turn = AsyncMock(
        return_value=DialogueService._turn(sample_turn_row(meta={"phase": "path_intro"}))
    )
    child = sample_child(parent_id=PARENT_ID)
    effects, _turns = await dialogue_svc._choose_path(
        CHILD_ID,
        SESSION_ID,
        sample_session_row(),
        1,
        {"kind": "option", "option_id": "missing"},
        "missing",
        child,
    )
    assert effects[0]["value"] == "p1"
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_compose_path_pack_with_weak_spots(dialogue_svc, mocker) -> None:
    child = sample_child(
        settings={
            "learning": {
                "active_subjects": ["math", "language", "logic"],
                "weak_spots": [{"subject_id": "math", "note": "sumas"}],
            }
        }
    )
    mocker.patch(
        "app.services.dialogue.run_purpose",
        new=AsyncMock(side_effect=RuntimeError("fallo")),
    )
    pack = await dialogue_svc._compose_path_pack(child, SESSION_ID)
    assert len(pack) == 3

