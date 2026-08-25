from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.ai.agents.curriculum_knowledge import (
    ANSWER_LEAK_IN_STIMULUS_RULE,
    GAP_QUESTION_IN_STIMULUS_RULE,
    MEANING_QUESTION_NO_ECHO_RULE,
    PATH_LORE_ONLY_IF_TAUGHT_RULE,
    PLACEMENT_PRIOR_KNOWLEDGE_RULE,
    STIMULUS_PROMPT_ALIGNMENT_RULE,
)
from app.ai.agents.envelopes import (
    DialogueEnvelope,
    DialogueOption,
    PlacementItemEnvelope,
    PlacementQueueEnvelope,
    PathChallengeSeed,
    PathDetail,
    PathOption,
    PathPackEnvelope,
    TravelerProfileEnvelope,
)
from app.ai.errors import AiProductError
from app.ai.journey.ledger import JourneyLedger
from app.ai.orchestrator.orchestrator import TurnResult
from app.services.dialogue import DialogueService
from app.services.mentor_profiles import mentor_profile
from app.services.path_composer_context import PathComposerContextService
from app.services.traveler_profile import extract_palette_tokens
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
def test_turn_normalizes_input_mode_from_phase() -> None:
    turn = DialogueService._turn(
        {
            **sample_turn_row(),
            "input_mode": "continue",
            "options": None,
            "meta": {"phase": "choose_age"},
        }
    )
    assert turn["input_mode"] == "options_or_text"
    assert len(turn["options"]) == 11
    assert turn["options"][0]["id"] == "6"


@pytest.mark.unit
def test_turn_normalizes_choose_name_text_only() -> None:
    turn = DialogueService._turn(
        {
            **sample_turn_row(),
            "input_mode": "continue",
            "meta": {"phase": "choose_name"},
        }
    )
    assert turn["input_mode"] == "text_only"


@pytest.mark.unit
def test_turn_normalizes_species_options() -> None:
    turn = DialogueService._turn(
        {
            **sample_turn_row(),
            "input_mode": "continue",
            "options": None,
            "meta": {"phase": "choose_character_species", "world_theme": "fantasy"},
        }
    )
    assert turn["input_mode"] == "options_or_text"
    assert len(turn["options"]) == 3
    assert turn["options"][0]["id"] == "mago_noche_blanca"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_recent_orders_by_sequence_within_session(dialogue_svc) -> None:
    mentor = sample_turn_row(
        id="11111111-1111-4111-8111-111111111111",
        sequence=1,
        role="mentor",
        text="Edad?",
        meta={"phase": "choose_age"},
    )
    explorer = sample_turn_row(
        id="22222222-2222-4222-8222-222222222222",
        sequence=2,
        role="explorer",
        text="42",
        meta={},
    )
    species = sample_turn_row(
        id="33333333-3333-4333-8333-333333333333",
        sequence=3,
        role="mentor",
        text="Elige forma",
        meta={"phase": "choose_character_species"},
    )
    dialogue_svc.session = ScriptedSession(
        [FakeExecuteResult(rows=[mentor, explorer, species])]
    )
    turns = await dialogue_svc._recent(CHILD_ID, 24, SESSION_ID)
    assert [t["sequence"] for t in turns] == [1, 2, 3]
    assert turns[1]["text"] == "42"


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
    mocker.patch.object(dialogue_svc, "_last_mentor", new=AsyncMock(return_value=None))
    body = await dialogue_svc.open_session(AUTH_USER_ID, CHILD_ID, "first_run")
    assert body["session_id"] == SESSION_ID
    assert body["flow_id"] == "first_run"
    assert body["onboarding_step"] == "choose_world"
    assert body["chapter"]["id"] == "umbral"
    assert body["chapter"]["title"] == "El umbral"
    assert body["chapter"]["source"] == "system"


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
def test_completed_path_ids_from_events() -> None:
    challenges = [{"prompt_text": "a"}, {"prompt_text": "b"}, {"prompt_text": "c"}]
    events = [
        {
            "kind": "path_progress",
            "payload": {
                "path_id": "path_geo",
                "challenge_index": 3,
                "last_ok": True,
                "path": {"path_id": "path_geo", "challenges": challenges},
            },
        },
        {
            "kind": "path_progress",
            "payload": {
                "path_id": "path_lang",
                "challenge_index": 1,
                "last_ok": True,
                "path": {"path_id": "path_lang", "challenges": challenges},
            },
        },
    ]
    completed = DialogueService._completed_path_ids_from_events(events)
    assert completed == {"path_geo"}
    assert DialogueService._latest_completed_path_id(events) == "path_geo"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reemit_choose_path_excludes_completed_path(
    dialogue_svc, mocker, tmp_path, monkeypatch
) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    child = sample_child(parent_id=PARENT_ID)
    dialogue_svc.ledger = JourneyLedger(tmp_path)
    challenges = [{"prompt_text": f"q{i}"} for i in range(3)]
    pack = [
        {"path_id": "path_a", "title": "Nexo sintaxis", "subject_id": "language"},
        {"path_id": "path_b", "title": "Observatorio", "subject_id": "reading"},
        {
            "path_id": "path_geo",
            "title": "Cartografía de Sectores Inexplorados",
            "subject_id": "geography",
        },
    ]
    dialogue_svc.ledger.append_event(
        PARENT_ID,
        CHILD_ID,
        SESSION_ID,
        kind="path_pack",
        payload={"pack": pack},
        world_theme="fantasy",
    )
    dialogue_svc.ledger.append_event(
        PARENT_ID,
        CHILD_ID,
        SESSION_ID,
        kind="path_progress",
        payload={
            "path_id": "path_geo",
            "challenge_index": 3,
            "last_ok": True,
            "path": {"path_id": "path_geo", "challenges": challenges},
        },
        world_theme="fantasy",
    )
    refreshed = [
        {"path_id": "path_a", "title": "Nexo sintaxis", "subject_id": "language"},
        {"path_id": "path_b", "title": "Observatorio", "subject_id": "reading"},
        {"path_id": "path_new", "title": "Nuevo camino", "subject_id": "math"},
    ]
    mocker.patch.object(
        dialogue_svc,
        "_refresh_path_pack_after_complete",
        new=AsyncMock(return_value=(refreshed, {"compose_mode": "refresh_after_complete"})),
    )
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(rows=child),
            FakeExecuteResult(rows=sample_session_row()),
            FakeExecuteResult(scalar=10),
        ]
    )
    mentor_mock = mocker.patch.object(
        dialogue_svc,
        "_mentor_turn",
        new=AsyncMock(return_value=sample_turn_row(meta={"phase": "choose_path"})),
    )
    mocker.patch(
        "app.services.dialogue.pick_waiting_batch",
        new=AsyncMock(return_value=[]),
    )

    await dialogue_svc.reemit_choose_path("auth", CHILD_ID, SESSION_ID)

    mentor_mock.assert_awaited_once()
    options = mentor_mock.await_args.args[6]
    labels = [opt["label"] for opt in options]
    assert "Cartografía de Sectores Inexplorados" not in labels
    assert "Nuevo camino" in labels
    assert "Camino superado" in mentor_mock.await_args.args[4]
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
    anchor = {"id": "turn-2", "sequence": 2, "session_id": SESSION_ID}
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
    dialogue_svc._mentor_turn = AsyncMock(
        return_value={
            "id": "t-gender",
            "role": "mentor",
            "meta": {"phase": "choose_gender"},
            "input_mode": "options_only",
            "text": "En la aventura, ¿eres chico o chica?",
        }
    )
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(),
            FakeExecuteResult(
                rows=sample_child(
                    age_years=9,
                    age_band="band_child",
                    onboarding_step="choose_gender",
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
    assert effects[1]["to"] == "choose_gender"
    assert turns[0]["meta"]["phase"] == "choose_gender"
    assert turns[0]["input_mode"] == "options_only"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_phase_choose_gender_invalid_reprompts(dialogue_svc) -> None:
    dialogue_svc._mentor_turn = AsyncMock(
        return_value={
            "id": "t-gender-retry",
            "role": "mentor",
            "meta": {"phase": "choose_gender"},
            "text": "No he entendido. En la aventura, ¿eres chico o chica?",
        }
    )
    dialogue_svc.session = ScriptedSession([])
    child = sample_child(age_years=9, age_band="band_child", onboarding_step="choose_gender")
    dialogue_svc._child_by_id = AsyncMock(return_value=child)  # type: ignore[method-assign]
    effects, turns = await dialogue_svc._phase_choose_gender(
        CHILD_ID,
        SESSION_ID,
        sample_session_row(),
        1,
        "no-valido",
    )
    assert effects == []
    assert turns[0]["meta"]["phase"] == "choose_gender"
    assert "No he entendido" in turns[0]["text"]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_phase_choose_gender_valid(dialogue_svc) -> None:
    dialogue_svc._agent_mentor_turn = AsyncMock(return_value={"id": "t-char", "role": "agent"})
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(),
            FakeExecuteResult(
                rows=sample_child(
                    age_years=9,
                    age_band="band_child",
                    explorer_gender="female",
                    onboarding_step="choose_character",
                )
            ),
        ]
    )
    effects, turns = await dialogue_svc._phase_choose_gender(
        CHILD_ID,
        SESSION_ID,
        sample_session_row(),
        1,
        "female",
    )
    assert effects[0] == {"type": "set_explorer_gender", "value": "female"}
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
async def test_phase_character_fallback_simple_copy_for_child_audience(
    dialogue_svc, mocker
) -> None:
    profile = TravelerProfileEnvelope(
        agent_text="Eres un Vigía Onírico. Un guardián de estrellas.",
        species="Vigía Onírico",
        palette="plata",
        features=["valiente"],
        abilities=[],
        vibe="vigía onírico",
    )
    mocker.patch(
        "app.services.dialogue.run_purpose",
        new=AsyncMock(return_value=(profile, "gemini-test")),
    )
    captured: list[str] = []

    async def _capture_turn(*args: Any, **_kwargs: Any) -> dict[str, Any]:
        captured.append(str(args[4]))
        return DialogueService._turn(
            sample_turn_row(meta={"phase": "handoff_placement"}, role="mentor")
        )

    dialogue_svc._mentor_turn = AsyncMock(side_effect=_capture_turn)
    dialogue_svc.session = ScriptedSession([FakeExecuteResult()])
    child = sample_child(
        onboarding_step="choose_character",
        parent_id=PARENT_ID,
        age_years=10,
        age_band="band_child",
    )
    await dialogue_svc._phase_character(
        CHILD_ID,
        SESSION_ID,
        sample_session_row(),
        1,
        "Protector de los sueños abandonados",
        child,
    )
    assert captured
    final = captured[-1].lower()
    assert "protector de los sueños abandonados" in final
    assert "onírico" not in final


@pytest.mark.unit
@pytest.mark.asyncio
async def test_compose_placement_queue_raises_on_compose_failure(dialogue_svc, mocker) -> None:
    mocker.patch(
        "app.services.dialogue.run_purpose",
        new=AsyncMock(side_effect=AiProductError("ai_compose_failed", "fallo", retryable=False)),
    )
    child = sample_child(
        settings={"learning": {"active_subjects": ["math"]}},
    )
    with pytest.raises(AiProductError, match="fallo"):
        await dialogue_svc._compose_placement_queue(child, SESSION_ID)


@pytest.mark.unit
def test_chunk_subject_slots() -> None:
    slots = ["math", "language", "reading", "logic", "science"]
    assert DialogueService._chunk_subject_slots(slots, 4) == [
        ["math", "language", "reading", "logic"],
        ["science"],
    ]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_compose_placement_queue_batches_large_subject_list(
    dialogue_svc, mocker
) -> None:
    child = sample_child(
        settings={
            "learning": {
                "active_subjects": [
                    "math",
                    "language",
                    "reading",
                    "logic",
                    "science",
                    "arts",
                    "communication",
                    "sports",
                ]
            }
        },
        display_name="Aleria",
    )
    calls: list[list[str]] = []

    async def fake_batch(
        _child,
        _session_id,
        subject_slots,
        _band,
        *,
        batch_index=0,
        palette_tokens=None,
        **_kwargs,
    ):
        calls.append(list(subject_slots))
        return [
            {
                "subject_id": sid,
                "item_key": f"{sid}_1",
                "item_type": "mcq",
                "prompt_text": f"Pregunta {sid}",
                "presentation_text": f"Pregunta {sid}",
                "options": [
                    {"id": "a", "label": "uno"},
                    {"id": "b", "label": "dos"},
                ],
                "correct_option_id": "a",
            }
            for sid in subject_slots
        ]

    mocker.patch.object(
        dialogue_svc,
        "_compose_placement_batch",
        side_effect=fake_batch,
    )
    queue = await dialogue_svc._compose_placement_queue(child, SESSION_ID)
    assert len(queue) == 8
    assert len(calls) == 2
    assert len(calls[0]) == 4
    assert len(calls[1]) == 4


@pytest.mark.unit
@pytest.mark.asyncio
async def test_compose_placement_batch_quality_fallback_on_last_retry(
    dialogue_svc,
) -> None:
    fallback_items = [
        {
            "subject_id": "reading",
            "item_key": "reading_1",
            "item_type": "mcq",
            "presentation_text": "¿Qué ocurre?",
            "options": [{"id": "a", "label": "El viento suave"}, {"id": "b", "label": "Nada"}],
            "correct_option_id": "a",
        }
    ]

    async def always_quality_reject(*_args, **_kwargs):
        raise dialogue_svc._placement_compose_error(
            issue="reading_event_answer_mismatch",
            quality_fallback_items=fallback_items,
        )

    dialogue_svc._compose_placement_batch = always_quality_reject  # type: ignore[method-assign]

    result = await dialogue_svc._compose_placement_batch_with_retry(
        sample_child(),
        SESSION_ID,
        ["reading"],
        "band_child",
        batch_index=0,
        batch_retries=2,
    )
    assert result == fallback_items


@pytest.mark.unit
@pytest.mark.asyncio
async def test_compose_placement_batch_llm_failure_still_raises_on_last_retry(
    dialogue_svc,
) -> None:
    async def always_llm_fail(*_args, **_kwargs):
        raise dialogue_svc._placement_compose_error(issue="batch_count_mismatch")

    dialogue_svc._compose_placement_batch = always_llm_fail  # type: ignore[method-assign]

    with pytest.raises(AiProductError, match="No se pudo generar"):
        await dialogue_svc._compose_placement_batch_with_retry(
            sample_child(),
            SESSION_ID,
            ["math"],
            "band_child",
            batch_index=0,
            batch_retries=1,
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_compose_placement_queue_from_llm(dialogue_svc, mocker) -> None:
    bundle = PlacementQueueEnvelope(
        items=[
            PlacementItemEnvelope(
                subject_id="math",
                item_key="q1",
                prompt_text="¿Cuánto es 2+2?",
                options=[
                    {"id": "a", "label": "3"},
                    {"id": "b", "label": "4"},
                ],
                correct_option_id="b",
            ),
            PlacementItemEnvelope(
                subject_id="language",
                item_key="q2",
                prompt_text="¿Sinónimo de grande?",
                options=[
                    {"id": "a", "label": "enorme"},
                    {"id": "b", "label": "pequeño"},
                ],
                correct_option_id="a",
            ),
        ]
    )
    run_mock = AsyncMock(return_value=(bundle, "gemini-test"))
    mocker.patch("app.services.dialogue.run_purpose", new=run_mock)
    child = sample_child(
        settings={"learning": {"active_subjects": ["math", "language"]}},
        display_name="Aleria",
        explorer_gender="female",
    )
    queue = await dialogue_svc._compose_placement_queue(child, SESSION_ID)
    assert len(queue) == 2
    assert queue[0]["item_key"] == "q1"
    assert queue[1]["subject_id"] == "language"
    assert run_mock.await_count == 1
    prompt = run_mock.await_args.args[1]
    assert "math" in prompt and "language" in prompt
    assert "Aleria" in prompt
    assert MEANING_QUESTION_NO_ECHO_RULE in prompt
    assert ANSWER_LEAK_IN_STIMULUS_RULE in prompt


@pytest.mark.unit
@pytest.mark.asyncio
async def test_compose_placement_batch_does_not_retry_on_meaning_echo(
    dialogue_svc, mocker
) -> None:
    bundle = PlacementQueueEnvelope(
        items=[
            PlacementItemEnvelope(
                subject_id="reading",
                item_key="q1",
                prompt_text="¿Cuál es el significado preciso de 'inefable'?",
                presentation_text=(
                    "El registro mostraba una anomalía inefable. "
                    "¿Cuál es el significado preciso de 'inefable'?"
                ),
                options=[
                    {"id": "a", "label": "Inefable"},
                    {"id": "b", "label": "Frecuente"},
                    {"id": "c", "label": "Mesurable"},
                ],
                correct_option_id="a",
            )
        ]
    )
    run_mock = AsyncMock(return_value=(bundle, "gemini-test"))
    mocker.patch("app.services.dialogue.run_purpose", new=run_mock)
    child = sample_child(
        settings={"learning": {"active_subjects": ["reading"]}},
        age_band="band_teen",
        effective_age_band="band_teen",
        age_years=15,
    )
    items = await dialogue_svc._compose_placement_batch(
        child, SESSION_ID, ["reading"], "band_teen"
    )
    assert run_mock.await_count == 1
    assert items[0]["options"][0]["label"] == "Inefable"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_compose_placement_queue_rejects_incomplete_batch(dialogue_svc, mocker) -> None:
    bundle = PlacementQueueEnvelope(
        items=[
            PlacementItemEnvelope(
                subject_id="math",
                item_key="q1",
                prompt_text="¿Cuánto es 2+2?",
                options=[
                    {"id": "a", "label": "3"},
                    {"id": "b", "label": "4"},
                ],
                correct_option_id="b",
            )
        ]
    )
    mocker.patch(
        "app.services.dialogue.run_purpose",
        new=AsyncMock(return_value=(bundle, "gemini-test")),
    )
    child = sample_child(
        settings={"learning": {"active_subjects": ["math", "language"]}},
    )
    with pytest.raises(AiProductError):
        await dialogue_svc._compose_placement_queue(child, SESSION_ID)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_compose_path_pack_raises_when_slots_exhausted(dialogue_svc, mocker) -> None:
    mocker.patch(
        "app.services.dialogue.run_purpose",
        new=AsyncMock(side_effect=RuntimeError("fallo")),
    )
    with pytest.raises(AiProductError):
        await dialogue_svc._compose_path_pack(sample_child(), SESSION_ID)


_CHALLENGE_WRAPPER = (
    "En el mercado del cruce, el guía junta dos manzanas y dos peras en un cesto. "
    "«Mira», dice, «son cuatro piezas en total si las cuentas juntas.» "
    "El viajero repite la cuenta en voz baja antes de responder."
)


@pytest.mark.unit
def _path_challenge_seed(prompt: str = "¿2+2?") -> PathChallengeSeed:
    return PathChallengeSeed(
        prompt_text=prompt,
        narrative_wrapper=_CHALLENGE_WRAPPER,
        item_type="mcq",
        options=[
            DialogueOption(id="a", label="4"),
            DialogueOption(id="b", label="5"),
            DialogueOption(id="c", label="6"),
        ],
        correct_option_id="a",
        explanation="La respuesta correcta es 4.",
    )


_LONG_SCENE = (
    "El sendero baja hacia un cruce de piedras. "
    "Un guía local detiene al viajero y le pide escuchar con atención."
)
_LONG_LESSON = (
    "El guía muestra dos montones de fruta y cuenta en voz alta. "
    "«Si juntas lo mismo en cada lado, el trueque sale justo», dice. "
    "Explica que sumar es juntar cantidades sin perder el orden. "
    "Te deja practicar con los dedos antes de los retos del camino."
)


def _valid_path_challenges() -> list[dict[str, Any]]:
    return [
        {
            "narrative_wrapper": _CHALLENGE_WRAPPER,
            "prompt_text": "¿Cuánto es 2+2?",
            "item_type": "mcq",
            "options": [
                {"id": "a", "label": "4"},
                {"id": "b", "label": "5"},
                {"id": "c", "label": "6"},
            ],
            "correct_option_id": "a",
            "explanation": "La respuesta correcta es 4.",
        }
    ] * 3


def _path_detail(i: int, *, title: str | None = None) -> PathDetail:
    return PathDetail(
        path=PathOption(
            path_id=f"path_{i}",
            subject_id="math",
            title=title or f"El cruce de las balanzas {i}",
            intro="Intro breve",
            learning_blurb="Blurb",
            path_narrative=_LONG_SCENE,
            lesson_narrative=_LONG_LESSON,
        ),
        challenges=[_path_challenge_seed(f"¿2+{i}?") for _ in range(3)],
    )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_compose_path_pack_parallel_calls(dialogue_svc, mocker) -> None:
    bundle = PathPackEnvelope(
        agent_text="Elige tu camino",
        paths=[_path_detail(1)],
    )
    run_mock = AsyncMock(return_value=(bundle, "gemini-3.1-flash-lite"))
    mocker.patch("app.services.dialogue.run_purpose", new=run_mock)

    pack = await dialogue_svc._compose_path_pack(sample_child(), SESSION_ID)
    assert len(pack) == 3
    assert run_mock.await_count == 3
    assert pack[0]["title"] == "El cruce de las balanzas 1"
    assert len(pack[0]["challenges"]) == 3
    assert pack[0]["lesson_narrative"]
    assert "4" in pack[0]["challenges"][0]["explanation"]


@pytest.mark.unit
def test_path_pack_quality_treats_cliche_title_as_soft() -> None:
    entry = {
        "path_id": "p1",
        "subject_id": "math",
        "title": "El bosque de los números",
        "intro": "Intro",
        "path_narrative": _LONG_SCENE,
        "lesson_narrative": _LONG_LESSON,
        "challenges": _valid_path_challenges(),
    }
    assert DialogueService._path_pack_entry_quality_issue(entry, "fantasy") is None
    warns = DialogueService._path_pack_soft_quality_warnings(entry, "fantasy")
    assert "path_title_cliche" in warns


@pytest.mark.unit
def test_path_pack_quality_accepts_original_title() -> None:
    entry = {
        "path_id": "p1",
        "subject_id": "math",
        "title": "El cruce de las balanzas",
        "intro": "Intro",
        "path_narrative": _LONG_SCENE,
        "lesson_narrative": _LONG_LESSON,
        "challenges": _valid_path_challenges(),
    }
    assert DialogueService._path_pack_entry_quality_issue(entry, "fantasy") is None


@pytest.mark.unit
def test_path_pack_quality_soft_warnings_do_not_reject() -> None:
    entry = {
        "path_id": "p1",
        "subject_id": "language",
        "title": "El salón de las palabras vivas",
        "intro": "Intro",
        "path_narrative": "Corta.",
        "lesson_narrative": "Corta.",
        "challenges": [
            {
                "narrative_wrapper": _CHALLENGE_WRAPPER,
                "prompt_text": "¿Qué tipo de palabra es correr?",
                "item_type": "mcq",
                "options": [
                    {"id": "a", "label": "Verbo"},
                    {"id": "b", "label": "Sustantivo propio"},
                    {"id": "c", "label": "Adjetivo"},
                ],
                "correct_option_id": "b",
                "explanation": "Correr es una acción, así que es un verbo.",
            }
        ]
        * 3,
    }
    # No rechazo duro por lección corta ni explanation desalineada.
    assert DialogueService._path_pack_entry_quality_issue(entry, "fantasy") is None
    warns = DialogueService._path_pack_soft_quality_warnings(entry, "fantasy")
    assert "path_lesson_short" in warns
    assert "path_explanation_may_mismatch_correct" in warns


@pytest.mark.unit
@pytest.mark.parametrize(
    "challenge,issue",
    [
        (
            {
                "narrative_wrapper": (
                    "La sonda autónoma realizó el escaneo orbital. Se detectó una señal "
                    "anómala, y los sistemas de seguridad se activaron de forma automática."
                ),
                "prompt_text": (
                    "¿Cuál es la forma correcta de escribir la locución causal que falta "
                    "en el pasaje?"
                ),
                "item_type": "mcq",
                "options": [
                    {"id": "a", "label": "Por el cual"},
                    {"id": "b", "label": "Por lo cual"},
                    {"id": "c", "label": "Porlo cual"},
                ],
                "correct_option_id": "b",
            },
            "path_challenge_missing_gap",
        ),
        (
            {
                "narrative_wrapper": (
                    "El capitán revisó la tripulación. La diferencia entre ambos grupos "
                    "era evidente."
                ),
                "prompt_text": (
                    "¿Qué categoría gramatical tiene la palabra «notable» en la frase "
                    "«La diferencia entre ambos grupos era notable»?"
                ),
                "item_type": "mcq",
                "options": [
                    {"id": "a", "label": "Adjetivo"},
                    {"id": "b", "label": "Sustantivo"},
                    {"id": "c", "label": "Verbo"},
                ],
                "correct_option_id": "a",
            },
            "path_challenge_quote_not_in_wrapper",
        ),
        (
            {
                "narrative_wrapper": (
                    "El protocolo cambió ____ cuando llegó la alerta."
                ),
                "prompt_text": (
                    "¿Cuál es la forma correcta de escribir la locución causal que falta "
                    "en el pasaje?"
                ),
                "item_type": "mcq",
                "options": [
                    {"id": "a", "label": "Por el cual"},
                    {"id": "b", "label": "Por lo cual"},
                    {"id": "c", "label": "Porlo cual"},
                ],
                "correct_option_id": "b",
            },
            None,
        ),
    ],
)
def test_path_challenge_stimulus_coherence_issue(
    challenge: dict[str, Any], issue: str | None
) -> None:
    assert (
        DialogueService._path_challenge_stimulus_coherence_issue(
            challenge, subject_id="language"
        )
        == issue
    )


@pytest.mark.unit
def test_compose_failed_mentor_text_for_path_pack_sci_fi() -> None:
    child = {"world_theme": "sci-fi", "display_name": "Binar Star"}
    exc = AiProductError("ai_compose_failed", "detalle técnico ignorado")
    text = DialogueService._compose_failed_mentor_text(
        exc, retry_action="path_pack", child=child
    )
    assert "Binar Star" in text
    assert "observatorio" in text.lower()
    assert "Reintentar" in text
    assert "detalle técnico" not in text


@pytest.mark.unit
def test_compose_failed_mentor_text_for_path_pack_fantasy() -> None:
    child = {"world_theme": "fantasy", "display_name": "Aleria"}
    exc = AiProductError("ai_compose_failed", "fallo")
    text = DialogueService._compose_failed_mentor_text(
        exc, retry_action="path_pack", child=child
    )
    assert "Aleria" in text
    assert "pergamino" in text.lower() or "runas" in text.lower()
    assert "niebla" in text.lower() or "encrucijada" in text.lower()


@pytest.mark.unit
def test_format_path_intro_text_includes_lesson() -> None:
    path = {
        "path_narrative": "Escena breve.",
        "lesson_narrative": "Lección larga con teoría.",
        "intro": "Intro",
        "learning_blurb": "Lógica",
    }
    text = DialogueService._format_path_intro_text(path)
    assert "Escena breve." in text
    assert "Lección larga con teoría." in text


@pytest.mark.unit
def test_format_path_challenge_text_includes_wrapper() -> None:
    ch = {
        "narrative_wrapper": "La puerta brilla bajo la luna. El guardián espera una respuesta clara.",
        "teaching_beat": "Miramos el patrón.",
        "prompt_text": "¿Cuál sigue?",
    }
    text = DialogueService._format_path_challenge_text(ch)
    assert "La puerta brilla" in text
    assert "¿Cuál sigue?" in text


@pytest.mark.unit
def test_path_challenge_context_rejects_missing_wrapper() -> None:
    issue = DialogueService._path_challenge_context_issue(
        {"prompt_text": "¿Dónde se escondió?", "item_type": "mcq"},
        subject_id="reading",
        lesson_narrative=_LONG_LESSON,
    )
    assert issue == "path_challenge_missing_wrapper"


@pytest.mark.unit
def test_path_challenge_context_rejects_answer_not_in_wrapper() -> None:
    issue = DialogueService._path_challenge_context_issue(
        {
            "narrative_wrapper": (
                "El hada se escondió detrás del árbol cuando el viento sopló fuerte. "
                "No dijo nada más y el bosque quedó en silencio."
            ),
            "prompt_text": "¿Qué hizo el hada cuando el viento paró?",
            "item_type": "mcq",
            "options": [
                {"id": "a", "label": "Cantó"},
                {"id": "b", "label": "Voló"},
                {"id": "c", "label": "Durmió"},
            ],
            "correct_option_id": "a",
        },
        subject_id="reading",
        lesson_narrative=_LONG_LESSON,
    )
    assert issue == "path_challenge_answer_not_in_context"


@pytest.mark.unit
def test_format_path_recap_text_includes_blurb_and_questions() -> None:
    path = {
        "title": "El Jardín de los Cuentos",
        "learning_blurb": "Buscar datos en el texto.",
        "npc": {"name": "El Guardián del Conocimiento"},
        "challenges": [
            {"prompt_text": "¿Dónde se escondió?"},
            {"prompt_text": "¿Quién habló primero?"},
        ],
    }
    recap = DialogueService._format_path_recap_text(path, passed=True)
    assert "Camino superado" in recap
    assert "Buscar datos" in recap
    assert "Guardián" in recap


@pytest.mark.unit
def test_format_path_challenge_text_prompt_only_when_no_wrapper() -> None:
    ch = {
        "teaching_beat": "Miramos el patrón.",
        "prompt_text": "¿Cuál sigue?",
    }
    assert DialogueService._format_path_challenge_text(ch) == "¿Cuál sigue?"


@pytest.mark.unit
def test_path_pitch_description_prefers_blurb() -> None:
    assert DialogueService._path_pitch_description(
        {"learning_blurb": "Lógica", "intro": "Intro"}
    ) == "Lógica"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_compose_path_slot_retries_before_fallback(dialogue_svc, mocker) -> None:
    bad = PathPackEnvelope(agent_text="Elige", paths=[])
    good = PathPackEnvelope(agent_text="Elige", paths=[_path_detail(1)])
    run_mock = AsyncMock(side_effect=[(bad, "m1"), (good, "m2")])
    mocker.patch("app.services.dialogue.run_purpose", new=run_mock)

    entry = await dialogue_svc._compose_path_slot_with_retry(
        sample_child(),
        SESSION_ID,
        0,
        "math",
        await dialogue_svc._path_composer_context(sample_child()),
        ["math"],
        "fantasy",
        [],
        retries=1,
    )
    assert entry["model_used"] == "m2"
    assert run_mock.await_count == 2


@pytest.mark.unit
@pytest.mark.asyncio
async def test_compose_path_pack_parallel_propagates_slot_failure(dialogue_svc, mocker) -> None:
    good = {
        "path_id": "ok",
        "subject_id": "math",
        "title": "LLM",
        "model_used": "m1",
        "challenges": [{}] * 3,
    }

    async def slot_side_effect(*args, **kwargs):
        slot_index = args[2]
        if slot_index == 1:
            raise dialogue_svc._path_compose_error(
                issue="path_challenge_missing_gap",
                path_index=1,
                subject_id="language",
            )
        return good

    mocker.patch.object(
        dialogue_svc,
        "_compose_path_slot_with_retry",
        new=AsyncMock(side_effect=slot_side_effect),
    )
    with pytest.raises(AiProductError):
        await dialogue_svc._compose_path_pack_parallel(
            sample_child(),
            SESSION_ID,
            ["math", "language", "reading"],
            await dialogue_svc._path_composer_context(sample_child()),
            ["math", "language", "reading"],
            "fantasy",
            [],
            retries=0,
        )


@pytest.mark.unit
def test_pick_refresh_subject_avoids_reused_material() -> None:
    reused = [
        {"path_id": "a", "subject_id": "language"},
        {"path_id": "b", "subject_id": "reading"},
    ]
    context = {
        "weak_subjects_ranked": [
            {"subject_id": "language"},
            {"subject_id": "reading"},
            {"subject_id": "geography"},
        ]
    }
    assert DialogueService._pick_refresh_subject(reused, context) == "geography"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_refresh_path_pack_after_complete_reuses_two_paths(dialogue_svc, mocker, tmp_path) -> None:
    child = sample_child()
    parent_id = str(child["parent_id"])
    world = "fantasy"
    pack = [
        {"path_id": "path_a", "subject_id": "language", "title": "A"},
        {"path_id": "path_b", "subject_id": "reading", "title": "B"},
        {"path_id": "path_c", "subject_id": "geography", "title": "C"},
    ]

    def fake_read_events(parent, cid, sid, world_theme=None):
        return [{"kind": "path_pack", "payload": {"pack": pack}}]

    mocker.patch.object(dialogue_svc.ledger, "read_events", side_effect=fake_read_events)
    new_path = {
        "path_id": "path_d",
        "subject_id": "math",
        "title": "Nuevo",
        "model_used": "gemini-test",
        "challenges": [{}] * 3,
    }
    mocker.patch.object(
        dialogue_svc,
        "_compose_path_slot_with_retry",
        new=AsyncMock(return_value=new_path),
    )

    refreshed, meta = await dialogue_svc._refresh_path_pack_after_complete(
        child, SESSION_ID, "path_c"
    )
    assert [p["path_id"] for p in refreshed] == ["path_a", "path_b", "path_d"]
    assert meta["compose_mode"] == "refresh_after_complete"
    assert meta["reused_path_ids"] == ["path_a", "path_b"]
    assert meta["new_subject_id"] == "math"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_refresh_path_pack_skips_earlier_completed_paths(
    dialogue_svc, mocker, tmp_path
) -> None:
    child = sample_child()
    pack = [
        {"path_id": "path_a", "subject_id": "language", "title": "A"},
        {"path_id": "path_b", "subject_id": "reading", "title": "B"},
        {"path_id": "path_c", "subject_id": "geography", "title": "C"},
    ]
    challenges = [{"prompt_text": f"q{i}"} for i in range(3)]
    events = [
        {"kind": "path_pack", "payload": {"pack": pack}},
        {
            "kind": "path_progress",
            "payload": {
                "path_id": "path_a",
                "challenge_index": 3,
                "last_ok": True,
                "path": {"path_id": "path_a", "challenges": challenges},
            },
        },
    ]

    mocker.patch.object(
        dialogue_svc,
        "_ledger_events_for_session",
        return_value=events,
    )
    mocker.patch.object(dialogue_svc.ledger, "read_events", return_value=events)
    compose_mock = mocker.patch.object(
        dialogue_svc,
        "_compose_path_slot_with_retry",
        new=AsyncMock(
            side_effect=[
                {
                    "path_id": "path_d",
                    "subject_id": "math",
                    "title": "D",
                    "model_used": "gemini-test",
                    "challenges": [{}] * 3,
                },
                {
                    "path_id": "path_e",
                    "subject_id": "logic",
                    "title": "E",
                    "model_used": "gemini-test",
                    "challenges": [{}] * 3,
                },
            ]
        ),
    )

    refreshed, meta = await dialogue_svc._refresh_path_pack_after_complete(
        child, SESSION_ID, "path_c"
    )
    assert [p["path_id"] for p in refreshed] == ["path_b", "path_d", "path_e"]
    assert meta["reused_path_ids"] == ["path_b"]
    assert compose_mock.await_count == 2


@pytest.mark.unit
def test_pack_entries_not_completed() -> None:
    pack = [
        {"path_id": "path_a"},
        {"path_id": "path_b"},
        {"path_id": "path_c"},
    ]
    filtered = DialogueService._pack_entries_not_completed(pack, {"path_a", "path_c"})
    assert [p["path_id"] for p in filtered] == ["path_b"]


@pytest.mark.unit
def test_format_path_intro_text_includes_title() -> None:
    path = {
        "title": "Análisis del Ecosistema Político Español",
        "path_narrative": "Escena breve.",
        "lesson_narrative": "Lección larga con teoría.",
    }
    text = DialogueService._format_path_intro_text(path)
    assert text.startswith("Análisis del Ecosistema Político Español")
    assert "Lección larga con teoría." in text


@pytest.mark.unit
@pytest.mark.asyncio
async def test_compose_path_pack_accepts_cliche_title_without_retry(
    dialogue_svc, mocker
) -> None:
    bundle = PathPackEnvelope(
        agent_text="Elige",
        paths=[_path_detail(1, title="El bosque de los números")],
    )
    run_mock = AsyncMock(return_value=(bundle, "m1"))
    mocker.patch("app.services.dialogue.run_purpose", new=run_mock)
    pack = await dialogue_svc._compose_path_pack(sample_child(), SESSION_ID)
    assert len(pack) == 3
    assert pack[0]["title"] == "El bosque de los números"
    assert run_mock.await_count == 3


@pytest.mark.unit
@pytest.mark.parametrize(
    "item,reply,expected",
    [
        (
            {"correct_option_id": "b"},
            {"kind": "option", "option_id": "b"},
            1.0,
        ),
        (
            {"correct_option_id": "b"},
            {"kind": "option", "option_id": "a"},
            0.0,
        ),
        (
            {"expected_answer": "adjetivo|adj"},
            {"kind": "text", "text": "Adjetivo"},
            1.0,
        ),
        (
            {"expected_answer": "sustantivo"},
            {"kind": "text", "text": "verbo"},
            0.0,
        ),
        (
            {
                "correct_option_id": "a",
                "options": [
                    {"id": "8", "label": "8"},
                    {"id": "5", "label": "5"},
                    {"id": "7", "label": "7"},
                ],
            },
            {"kind": "option", "option_id": "8"},
            1.0,
        ),
        (
            {
                "correct_option_id": "8",
                "options": [
                    {"id": "a", "label": "8"},
                    {"id": "b", "label": "5"},
                ],
            },
            {"kind": "option", "option_id": "a"},
            1.0,
        ),
    ],
)
def test_score_placement_item(item, reply, expected) -> None:
    assert DialogueService._score_placement_item(item, reply) == expected


@pytest.mark.unit
def test_finalize_placement_queue_item_maps_letter_correct_id() -> None:
    item = DialogueService._finalize_placement_queue_item(
        {
            "correct_option_id": "a",
            "options": [
                {"id": "8", "label": "8"},
                {"id": "5", "label": "5"},
            ],
        }
    )
    assert item["correct_option_id"] == "8"


@pytest.mark.unit
@pytest.mark.parametrize(
    "item,issue",
    [
        (
            {
                "item_type": "mcq",
                "presentation_text": "¿Cuánto es 2+2?",
                "options": [{"id": "a", "label": "4"}, {"id": "b", "label": "5"}],
                "correct_option_id": "a",
            },
            None,
        ),
        (
            {
                "item_type": "mcq",
                "presentation_text": "La respuesta es valle. ¿Cómo se dice valle?",
                "options": [{"id": "a", "label": "valle"}, {"id": "b", "label": "río"}],
                "correct_option_id": "a",
            },
            "answer_leak_in_prompt",
        ),
        (
            {
                "item_type": "short_text",
                "presentation_text": "¿Cómo se dice valle?",
                "expected_answer": "valle",
            },
            "answer_leak_in_prompt",
        ),
        (
            {
                "subject_id": "reading",
                "item_type": "short_text",
                "presentation_text": "El dragón volaba sobre el lago. ¿Qué animal era?",
                "expected_answer": "dragón",
            },
            None,
        ),
        (
            {
                "subject_id": "reading",
                "item_type": "mcq",
                "presentation_text": (
                    "El viento mueve las hojas del bosque. "
                    "¿Qué ocurre en el bosque según el texto?"
                ),
                "options": [
                    {"id": "a", "label": "El viento suave"},
                    {"id": "b", "label": "El sol brillante"},
                ],
                "correct_option_id": "a",
            },
            "reading_event_answer_mismatch",
        ),
        (
            {
                "subject_id": "language",
                "item_type": "mcq",
                "presentation_text": "¿Qué llave necesita Aleria?",
                "options": [
                    {"id": "a", "label": "Llave plata"},
                    {"id": "b", "label": "Llave de madera"},
                ],
                "correct_option_id": "a",
            },
            "language_ungrammatical_option",
        ),
        (
            {
                "subject_id": "arts",
                "item_type": "mcq",
                "presentation_text": (
                    "En los templos, los maestros dibujan mapas. Para que un dibujo "
                    "tenga volumen y parezca real, los artistas usan una técnica "
                    "especial. ¿Para qué sirven los colores oscuros y los colores "
                    "claros juntos en una obra?"
                ),
                "options": [
                    {"id": "a", "label": "Oscuros y claros"},
                    {"id": "b", "label": "Solo colores brillantes"},
                    {"id": "c", "label": "Tinta de color negro"},
                ],
                "correct_option_id": "a",
            },
            "purpose_question_echo_option",
        ),
        (
            {
                "subject_id": "arts",
                "item_type": "mcq",
                "presentation_text": (
                    "¿Para qué sirven los colores oscuros y los colores claros "
                    "juntos en una obra?"
                ),
                "options": [
                    {"id": "a", "label": "Para dar volumen al dibujo"},
                    {"id": "b", "label": "Solo colores brillantes"},
                    {"id": "c", "label": "Tinta de color negro"},
                ],
                "correct_option_id": "a",
            },
            None,
        ),
    ],
)
def test_placement_item_quality_issue(item, issue) -> None:
    item = DialogueService._finalize_placement_queue_item(item)
    assert DialogueService._placement_item_quality_issue(item) == issue


@pytest.mark.unit
def test_placement_batch_quality_rejects_palette_overuse() -> None:
    tokens = extract_palette_tokens("Azul claro, blanco y plata")
    items = [
        {"presentation_text": "Un bosque azul brilla.", "prompt_text": ""},
        {"presentation_text": "Cristales plateados en la cueva.", "prompt_text": ""},
    ]
    assert (
        DialogueService._placement_batch_quality_issue(items, palette_tokens=tokens)
        == "palette_overuse"
    )


@pytest.mark.unit
def test_placement_batch_quality_allows_one_palette_mention() -> None:
    tokens = extract_palette_tokens("Azul claro, blanco y plata")
    items = [
        {"presentation_text": "Un bosque azul brilla.", "prompt_text": ""},
        {"presentation_text": "Cristales verdes en la cueva.", "prompt_text": ""},
    ]
    assert (
        DialogueService._placement_batch_quality_issue(items, palette_tokens=tokens)
        is None
    )


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
    dialogue_svc._mentor_turn = AsyncMock(
        return_value=DialogueService._turn(
            sample_turn_row(meta={"phase": "placement_feedback", "score": 1.0})
        )
    )
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
    assert len(turns) == 2
    assert turns[0]["meta"]["phase"] == "placement_feedback"
    assert turns[1]["id"] == "path-turn"
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
                    "path_narrative": "Rumi te guía al claro.",
                    "lesson_narrative": (
                        "Rumi te enseña el truco del bosque con ejemplos claros "
                        "antes de cualquier reto."
                    ),
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
    dialogue_svc._mentor_turn.assert_awaited_once()
    mentor_args = dialogue_svc._mentor_turn.await_args[0]
    mentor_text = mentor_args[4]
    assert mentor_args[5] == "options_or_text"
    assert mentor_args[6][0]["id"] == "start_challenges"
    assert "Rumi te guía al claro." in mentor_text
    assert "truco del bosque" in mentor_text
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
                            "narrative_wrapper": (
                                "Sela bloquea el paso y señala dos piedras en el suelo. "
                                "«Cuenta antes de saltar», dice con voz firme."
                            ),
                            "teaching_beat": "Contamos antes de saltar.",
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
    dialogue_svc._mentor_turn.assert_awaited_once()
    mentor_text = dialogue_svc._mentor_turn.await_args[0][4]
    assert "Sela bloquea el paso" in mentor_text
    assert "¿Seguimos?" in mentor_text
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.parametrize(
    "has_usable_baggage,expect_equipaje",
    [(True, True), (False, False)],
    ids=["with-usable", "without-usable"],
)
def test_wrong_path_challenge_copy(
    has_usable_baggage: bool, expect_equipaje: bool
) -> None:
    text = DialogueService._wrong_path_challenge_copy(
        has_usable_baggage=has_usable_baggage
    ).lower()
    assert "continuar" in text
    assert ("equipaje" in text) is expect_equipaje


@pytest.mark.unit
@pytest.mark.asyncio
@pytest.mark.parametrize(
    "offers,expect_equipaje,expect_skip",
    [
        ([], False, True),
        ([{"can_use": False, "effect_id": "challenge_hint"}], False, True),
        ([{"can_use": True, "effect_id": "challenge_retry"}], True, False),
        ([{"can_use": True, "effect_id": "challenge_hint"}], True, False),
    ],
    ids=["empty", "blocked-only", "retry", "hint"],
)
async def test_path_challenge_answer_wrong_retries(
    dialogue_svc,
    tmp_path,
    monkeypatch,
    offers: list[dict],
    expect_equipaje: bool,
    expect_skip: bool,
) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setattr(
        "app.services.dialogue.BaggageOfferService.offers_for_play",
        AsyncMock(return_value=offers),
    )
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
                    },
                    {
                        "prompt_text": "¿3+3?",
                        "item_type": "mcq",
                        "options": [{"id": "a", "label": "5"}, {"id": "b", "label": "6"}],
                        "correct_option_id": "b",
                    },
                ],
            },
        },
        world_theme="fantasy",
    )
    dialogue_svc._mentor_turn = AsyncMock(
        side_effect=lambda *args, **kwargs: DialogueService._turn(
            sample_turn_row(
                text=args[4] if len(args) > 4 else kwargs.get("text", ""),
                meta=kwargs.get("meta") or (args[7] if len(args) > 7 else {}),
            )
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
    assert effects and effects[0]["type"] == "record_learning_result"
    assert effects[0]["score"] == 0.0
    if expect_skip:
        assert len(turns) == 2
        assert turns[0]["meta"]["explanation_shown"] is True
        assert turns[1]["meta"]["phase"] == "path_challenge"
        assert turns[1]["meta"]["challenge_index"] == 1
    else:
        assert len(turns) == 1
        assert turns[0]["meta"]["retry"] is True
        assert turns[0]["meta"]["explanation_shown"] is False
        assert turns[0]["meta"]["challenge_index"] == 0
        text = str(turns[0].get("text") or "").lower()
        assert "continuar" in text
        assert ("equipaje" in text) is expect_equipaje
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
    from app.catalogs.subject_catalog import SubjectCatalog

    expected_subjects = set(SubjectCatalog.resolve_active_subjects(child, {})) | {"math"}
    assert len(dialogue_svc.session.executed) == len(expected_subjects) + 2
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
    mentor_args = dialogue_svc._mentor_turn.await_args[0]
    assert mentor_args[5] == "options_or_text"
    assert mentor_args[6][0]["id"] == "p1"
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_path_phase_mentor_consult_choose_path(dialogue_svc, tmp_path, monkeypatch) -> None:
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
                    "learning_blurb": "Lógica",
                    "subject_id": "logic",
                    "challenges": [{"prompt_text": "SECRETO", "correct_option_id": "a"}],
                }
            ]
        },
        world_theme="fantasy",
    )
    dialogue_svc._agent_mentor_turn = AsyncMock(
        return_value=DialogueService._turn(
            sample_turn_row(
                meta={"phase": "choose_path"},
                input_mode="options_or_text",
                options=[{"id": "p1", "label": "Bosque"}],
            )
        )
    )
    child = sample_child(parent_id=PARENT_ID)
    effects, turns = await dialogue_svc._path_phase_mentor_consult(
        CHILD_ID,
        SESSION_ID,
        sample_session_row(),
        4,
        "¿Cuál es más fácil?",
        child,
        phase="choose_path",
        last={"meta": {"phase": "choose_path"}},
    )
    assert effects == []
    assert turns[0]["meta"]["phase"] == "choose_path"
    call_kwargs = dialogue_svc._agent_mentor_turn.await_args.kwargs
    assert call_kwargs["force_input_mode"] == "options_or_text"
    assert call_kwargs["force_options"][0]["id"] == "p1"
    assert call_kwargs["extra_prompt"] and "NO reveles" in call_kwargs["extra_prompt"]
    explorer_q = dialogue_svc._agent_mentor_turn.await_args[0][4]
    assert explorer_q == "¿Cuál es más fácil?"
    get_settings.cache_clear()
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
    dialogue_svc._mentor_turn = AsyncMock(
        return_value=DialogueService._turn(
            sample_turn_row(meta={"phase": "placement_feedback", "score": 1.0})
        )
    )
    dialogue_svc._insert = AsyncMock(
        side_effect=lambda row: DialogueService._turn(
            sample_turn_row(meta=row.get("meta") or {"phase": "placement_item"})
        )
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
    assert len(turns) == 2
    assert turns[0]["meta"]["phase"] == "placement_feedback"
    assert turns[1]["meta"]["phase"] == "placement_item"
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
async def test_submit_turn_stores_option_display_label(dialogue_svc, mocker) -> None:
    child = sample_child(onboarding_step="choose_gender")
    mentor_turn = sample_turn_row(meta={"phase": "choose_gender"})
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
    dialogue_svc._phase_choose_gender = AsyncMock(
        return_value=([], [{"id": "gender-turn", "role": "mentor"}])
    )
    mocker.patch(
        "app.services.dialogue.WaitingCopyService"
    ).return_value.waiting_copy_from_cache = AsyncMock(return_value=[])
    await dialogue_svc.submit_turn(
        AUTH_USER_ID,
        CHILD_ID,
        SESSION_ID,
        {"kind": "option", "option_id": "male", "displayLabel": "Chico"},
    )
    insert_row = dialogue_svc._insert.await_args.args[0]
    assert insert_row["text"] == "Chico"
    assert insert_row["explorer_reply"]["option_id"] == "male"


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
    "phase,handler_name,reply",
    [
        ("choose_age", "_phase_choose_age", {"kind": "text", "text": "valor"}),
        ("choose_gender", "_phase_choose_gender", {"kind": "text", "text": "valor"}),
        ("choose_character_species", "_phase_character", {"kind": "text", "text": "valor"}),
        ("handoff_placement", "_start_placement", {"kind": "continue"}),
        ("placement_item", "_placement_answer", {"kind": "text", "text": "valor"}),
        ("placement_feedback", "_placement_feedback_continue", {"kind": "text", "text": "valor"}),
        (
            "choose_path",
            "_choose_path",
            {"kind": "option", "option_id": "path-a"},
        ),
        ("path_intro", "_path_next_challenge", {"kind": "continue"}),
        ("path_challenge", "_path_challenge_answer", {"kind": "text", "text": "valor"}),
        ("adventure_ready", "_start_path_choice", {"kind": "continue"}),
    ],
)
async def test_submit_turn_routes_onboarding_phases(
    dialogue_svc, mocker, phase: str, handler_name: str, reply: dict
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
    result = await dialogue_svc.submit_turn(AUTH_USER_ID, CHILD_ID, SESSION_ID, reply)
    handler.assert_awaited_once()
    assert result["agent_turns"][0]["id"] == "phase-turn"


@pytest.mark.unit
@pytest.mark.asyncio
@pytest.mark.parametrize(
    "phase",
    ["choose_path", "path_intro"],
)
async def test_submit_turn_text_routes_to_path_mentor_consult(
    dialogue_svc, mocker, phase: str
) -> None:
    child = sample_child(onboarding_step="complete", placement_status="completed")
    mentor_turn = sample_turn_row(meta={"phase": phase, "path_id": "p1"})
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
    consult = AsyncMock(return_value=([], [{"id": "consult-turn", "role": "mentor"}]))
    dialogue_svc._path_phase_mentor_consult = consult
    dialogue_svc._choose_path = AsyncMock()
    dialogue_svc._path_next_challenge = AsyncMock()
    dialogue_svc._insert = AsyncMock(side_effect=lambda row: DialogueService._turn(sample_turn_row(**row)))
    dialogue_svc._last_mentor = AsyncMock(return_value=DialogueService._turn(mentor_turn))
    mocker.patch(
        "app.services.dialogue.WaitingCopyService"
    ).return_value.waiting_copy_from_cache = AsyncMock(return_value=[])
    result = await dialogue_svc.submit_turn(
        AUTH_USER_ID, CHILD_ID, SESSION_ID, {"kind": "text", "text": "¿Cuál me conviene?"}
    )
    consult.assert_awaited_once()
    dialogue_svc._choose_path.assert_not_awaited()
    dialogue_svc._path_next_challenge.assert_not_awaited()
    assert result["agent_turns"][0]["id"] == "consult-turn"


@pytest.mark.unit
def test_turn_normalizes_choose_path_options_or_text() -> None:
    turn = DialogueService._turn(
        {
            **sample_turn_row(),
            "input_mode": "options_only",
            "options": [{"id": "a", "label": "A"}],
            "meta": {"phase": "choose_path"},
        }
    )
    assert turn["input_mode"] == "options_or_text"


@pytest.mark.unit
def test_turn_normalizes_path_intro_start_option() -> None:
    turn = DialogueService._turn(
        {
            **sample_turn_row(),
            "input_mode": "continue",
            "options": None,
            "meta": {"phase": "path_intro", "path_id": "p1"},
        }
    )
    assert turn["input_mode"] == "options_or_text"
    assert turn["options"][0]["id"] == "start_challenges"


@pytest.mark.unit
def test_turn_path_intro_retry_stays_continue() -> None:
    turn = DialogueService._turn(
        {
            **sample_turn_row(),
            "input_mode": "options_or_text",
            "options": None,
            "meta": {"phase": "path_intro", "retry": True, "path_id": "p1"},
        }
    )
    assert turn["input_mode"] == "continue"


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
async def test_compose_path_pack_with_subject_notes(dialogue_svc, mocker) -> None:
    child = sample_child(
        settings={
            "learning": {
                "active_subjects": ["math", "language", "logic"],
                "subject_notes": [
                    {"subject_id": "math", "note": "Domina tablas de multiplicar"}
                ],
            }
        }
    )
    bundle = PathPackEnvelope(
        agent_text="Elige tu camino",
        paths=[_path_detail(1)],
    )
    mocker.patch(
        "app.services.dialogue.run_purpose",
        new=AsyncMock(return_value=(bundle, "gemini-3.1-flash-lite")),
    )
    pack = await dialogue_svc._compose_path_pack(child, SESSION_ID)
    assert len(pack) == 3


@pytest.mark.unit
@pytest.mark.asyncio
async def test_weak_subjects_for_path_pack_prefers_low_levels(dialogue_svc) -> None:
    child = sample_child(
        placement_status="completed",
        settings={
            "learning": {
                "active_subjects": ["math", "language", "logic", "reading"],
            }
        },
    )
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(
                rows=[
                    {"subject_id": "math", "level_id": "L3", "accuracy_rolling": 0.75},
                    {"subject_id": "language", "level_id": "L1", "accuracy_rolling": 0.4},
                    {"subject_id": "logic", "level_id": "L2", "accuracy_rolling": 0.55},
                    {"subject_id": "reading", "level_id": "L1", "accuracy_rolling": 0.35},
                ]
            )
        ]
    )
    weak = await dialogue_svc._weak_subjects_for_path_pack(child)
    assert weak == ["reading", "language", "logic"]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_weak_subjects_for_path_pack_boosts_tutor_note(dialogue_svc) -> None:
    child = sample_child(
        settings={
            "learning": {
                "active_subjects": ["math", "language", "logic"],
                "subject_notes": [{"subject_id": "logic", "note": "secuencias"}],
            }
        },
    )
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(
                rows=[
                    {"subject_id": "math", "level_id": "L2", "accuracy_rolling": 0.5},
                    {"subject_id": "language", "level_id": "L2", "accuracy_rolling": 0.5},
                    {"subject_id": "logic", "level_id": "L2", "accuracy_rolling": 0.5},
                ]
            )
        ]
    )
    weak = await dialogue_svc._weak_subjects_for_path_pack(child)
    assert weak[0] == "logic"


@pytest.mark.unit
def test_path_compose_prompt_includes_structured_tutor_context() -> None:
    child = sample_child(
        settings={
            "learning": {
                "general_note": "Muy adelantado",
                "subject_notes": [{"subject_id": "math", "note": "Tablas del 7"}],
            }
        }
    )
    context = PathComposerContextService.build_context(child)
    svc = DialogueService.__new__(DialogueService)
    prompt = svc._path_compose_prompt(
        child,
        ["math", "language", "logic"],
        context,
        path_count=3,
    )
    assert "## Contexto del tutor" in prompt
    assert "Tablas del 7" in prompt
    assert "Camino 1" in prompt
    assert PATH_LORE_ONLY_IF_TAUGHT_RULE in prompt
    assert MEANING_QUESTION_NO_ECHO_RULE in prompt
    assert ANSWER_LEAK_IN_STIMULUS_RULE in prompt
    assert STIMULUS_PROMPT_ALIGNMENT_RULE in prompt
    assert GAP_QUESTION_IN_STIMULUS_RULE in prompt
    assert "explanation enseña la regla" in prompt
    assert "Ruta de math/language/reading" in prompt


@pytest.mark.unit
def test_path_compose_prompt_calibrates_teen_math_after_strong_placement() -> None:
    child = sample_child(
        age_years=15,
        age_band="band_teen",
        effective_age_band="band_teen",
        settings={"learning": {"active_subjects": ["math", "language", "logic"]}},
    )
    context = PathComposerContextService.build_context(
        child,
        subject_rows=[
            {"subject_id": "math", "level_id": "L4", "accuracy_rolling": 0.10},
            {"subject_id": "language", "level_id": "L4", "accuracy_rolling": 0.10},
            {"subject_id": "logic", "level_id": "L3", "accuracy_rolling": 0.10},
        ],
    )
    svc = DialogueService.__new__(DialogueService)
    prompt = svc._path_compose_prompt(
        child,
        ["math", "language", "logic"],
        context,
        path_count=3,
    )
    assert "Calibración pedagógica" in prompt
    assert "suelo 2" in prompt
    assert "10+5" in prompt
    assert "Dificultad objetivo 4" in prompt


@pytest.mark.unit
def test_placement_compose_prompt_includes_tutor_context() -> None:
    child = sample_child(
        settings={
            "learning": {
                "general_note": "Necesita ritmo pausado",
                "subject_notes": [{"subject_id": "math", "note": "Sumas simples"}],
            }
        }
    )
    svc = DialogueService.__new__(DialogueService)
    prompt = svc._placement_compose_prompt(child, ["math", "language"], "band_child")
    assert "Contexto del tutor" in prompt
    assert "Sumas simples" in prompt
    assert PLACEMENT_PRIOR_KNOWLEDGE_RULE in prompt
    assert MEANING_QUESTION_NO_ECHO_RULE in prompt
    assert ANSWER_LEAK_IN_STIMULUS_RULE in prompt


@pytest.mark.unit
def test_placement_compose_prompt_calibrates_teen_band() -> None:
    child = sample_child(
        age_years=15,
        age_band="band_teen",
        effective_age_band="band_teen",
    )
    svc = DialogueService.__new__(DialogueService)
    prompt = svc._placement_compose_prompt(child, ["math", "language"], "band_teen")
    assert "2–4" in prompt
    assert "10+5" in prompt
    assert "suelo" in prompt


@pytest.mark.unit
def test_placement_compose_prompt_forbids_invented_world_lore() -> None:
    svc = DialogueService.__new__(DialogueService)
    prompt = svc._placement_compose_prompt(
        sample_child(), ["mythology", "culture"], "band_tween"
    )
    assert "lore inventado" in prompt
    assert "mitos reales" in prompt
    assert "Prometeo" in prompt


@pytest.mark.unit
def test_placement_compose_prompt_includes_fantasy_world_prose() -> None:
    svc = DialogueService.__new__(DialogueService)
    prompt = svc._placement_compose_prompt(
        sample_child(world_theme="fantasy"), ["math", "language"], "band_child"
    )
    assert "Regla de voz fantasy" in prompt
    assert "Reinos Unidos" in prompt
    assert "Guardián del Conocimiento" in prompt


@pytest.mark.unit
def test_placement_compose_prompt_includes_scifi_world_prose() -> None:
    svc = DialogueService.__new__(DialogueService)
    prompt = svc._placement_compose_prompt(
        sample_child(world_theme="sci-fi"), ["math", "language"], "band_child"
    )
    assert "Regla de voz sci-fi" in prompt
    assert "Arquitecto del Saber" in prompt
    assert "Reinos Unidos" not in prompt


@pytest.mark.unit
def test_path_compose_prompt_includes_fantasy_title_guidance() -> None:
    svc = DialogueService.__new__(DialogueService)
    prompt = svc._path_compose_prompt(
        sample_child(world_theme="fantasy"),
        ["math", "language", "reading"],
        {},
        path_count=1,
    )
    assert "Regla de voz fantasy" in prompt
    assert "Títulos de camino fantasy" in prompt
    assert "linterna del archivista" in prompt


@pytest.mark.unit
def test_normalize_options_maps_text_and_value_to_label() -> None:
    opts = DialogueService._normalize_options_list(
        [
            {"id": "A", "text": "240"},
            {"id": "B", "value": "180"},
        ]
    )
    assert opts is not None
    assert opts[0]["label"] == "240"
    assert opts[1]["label"] == "180"


@pytest.mark.unit
def test_normalize_options_uses_description_when_label_is_letter() -> None:
    opts = DialogueService._normalize_options_list(
        [{"id": "A", "label": "A", "description": "240 monedas"}]
    )
    assert opts is not None
    assert opts[0]["label"] == "240 monedas"


@pytest.mark.parametrize(
    ("mentor_phase", "echo_phase"),
    [
        ("placement_item", "placement_choice_echo"),
        ("choose_path", "path_choice_echo"),
        ("path_challenge", "path_challenge_echo"),
    ],
)
@pytest.mark.unit
def test_choice_echo_meta_for_journey_and_placement(
    mentor_phase: str, echo_phase: str
) -> None:
    mentor = DialogueService._turn(
        {
            "id": uuid4(),
            "child_id": CHILD_ID,
            "session_id": SESSION_ID,
            "flow_id": "first_run",
            "sequence": 3,
            "role": "mentor",
            "text": "Elige",
            "options": [
                {"id": "a", "label": "Ruta A"},
                {"id": "b", "label": "Ruta B"},
            ],
            "meta": {"phase": mentor_phase},
        }
    )
    meta = DialogueService._choice_echo_meta(
        mentor,
        selected_id="a",
        display_label="Ruta A",
    )
    assert meta["phase"] == echo_phase
    assert meta["choice_taken"] == {"id": "a", "label": "Ruta A"}
    assert meta["choices_discarded"] == [{"id": "b", "label": "Ruta B"}]


@pytest.mark.unit
def test_choice_echo_meta_ignores_non_option_phases() -> None:
    mentor = DialogueService._turn(
        {
            "id": uuid4(),
            "child_id": CHILD_ID,
            "session_id": SESSION_ID,
            "flow_id": "first_run",
            "sequence": 3,
            "role": "mentor",
            "text": "¿Cómo te llamas?",
            "options": [{"id": "ada", "label": "Ada"}],
            "meta": {"phase": "choose_name"},
        }
    )
    assert (
        DialogueService._choice_echo_meta(
            mentor,
            selected_id="ada",
            display_label="Ada",
        )
        == {}
    )


@pytest.mark.unit
def test_choice_echo_meta_marks_incorrect_answer() -> None:
    mentor = DialogueService._turn(
        {
            "id": uuid4(),
            "child_id": CHILD_ID,
            "session_id": SESSION_ID,
            "flow_id": "first_run",
            "sequence": 3,
            "role": "mentor",
            "text": "¿Sinónimo de veloz?",
            "options": [
                {"id": "a", "label": "Lento"},
                {"id": "b", "label": "Rápido"},
            ],
            "meta": {"phase": "path_challenge"},
        }
    )
    scoring_item = {
        "item_type": "mcq",
        "options": [
            {"id": "a", "label": "Lento"},
            {"id": "b", "label": "Rápido"},
        ],
        "correct_option_id": "b",
    }
    meta = DialogueService._choice_echo_meta(
        mentor,
        selected_id="a",
        display_label="Lento",
        reply={"option_id": "a"},
        scoring_item=scoring_item,
    )
    assert meta["choice_correct"] is False


@pytest.mark.unit
def test_path_challenge_seed_requires_correct_option_id() -> None:
    with pytest.raises(ValueError, match="mcq_missing_correct_option_id"):
        PathChallengeSeed(
            prompt_text="¿Cuántas flores?",
            narrative_wrapper=_CHALLENGE_WRAPPER,
            item_type="mcq",
            options=[
                DialogueOption(id="a", label="10"),
                DialogueOption(id="b", label="24"),
            ],
            correct_option_id=None,
            explanation="La opción correcta es 24.",
        )


@pytest.mark.unit
def test_path_detail_to_pack_entry_rejects_unscorable_challenge(dialogue_svc) -> None:
    detail = PathDetail(
        path=PathOption(
            path_id="math_path_01",
            subject_id="math",
            title="Camino",
            intro="Intro",
            learning_blurb="Blurb",
            path_narrative=_LONG_SCENE,
            lesson_narrative=_LONG_LESSON,
        ),
        challenges=[
            PathChallengeSeed(
                prompt_text="¿Cuántas flores?",
                narrative_wrapper=_CHALLENGE_WRAPPER,
                item_type="mcq",
                options=[
                    DialogueOption(id="a", label="10"),
                    DialogueOption(id="b", label="24"),
                ],
                correct_option_id="z",
                explanation="Sin pista útil.",
            )
            for _ in range(3)
        ],
    )
    parsed, issue = dialogue_svc._path_detail_to_pack_entry(
        detail, "math", ["math"], 0, "test-model"
    )
    assert parsed is None
    assert issue == "path_mcq_invalid_correct_option"


@pytest.mark.unit
def test_path_detail_to_pack_entry_persists_resolved_correct_option_id(dialogue_svc) -> None:
    detail = PathDetail(
        path=PathOption(
            path_id="math_path_01",
            subject_id="math",
            title="Camino",
            intro="Intro",
            learning_blurb="Blurb",
            path_narrative=_LONG_SCENE,
            lesson_narrative=_LONG_LESSON,
        ),
        challenges=[
            PathChallengeSeed(
                prompt_text="¿Cuántas flores?",
                narrative_wrapper=_CHALLENGE_WRAPPER,
                item_type="mcq",
                options=[
                    DialogueOption(id="a", label="10"),
                    DialogueOption(id="b", label="24"),
                    DialogueOption(id="c", label="20"),
                ],
                correct_option_id="24",
                explanation="La opción correcta es 24, porque 4 veces 6 es 24.",
            )
            for _ in range(3)
        ],
    )
    parsed, issue = dialogue_svc._path_detail_to_pack_entry(
        detail, "math", ["math"], 0, "test-model"
    )
    assert parsed is not None
    assert issue is None
    assert parsed["challenges"][0]["correct_option_id"] == "b"


@pytest.mark.unit
def test_path_detail_to_pack_entry_reports_short_challenge_count(dialogue_svc) -> None:
    detail = PathDetail(
        path=PathOption(
            path_id="math_path_01",
            subject_id="math",
            title="Camino",
            intro="Intro",
            learning_blurb="Blurb",
            path_narrative=_LONG_SCENE,
            lesson_narrative=_LONG_LESSON,
        ),
        challenges=[_path_challenge_seed("¿2+2?") for _ in range(2)],
    )
    parsed, issue = dialogue_svc._path_detail_to_pack_entry(
        detail, "math", ["math"], 0, "test-model"
    )
    assert parsed is None
    assert issue == "path_challenge_count_short"


@pytest.mark.unit
def test_path_detail_to_pack_entry_rejects_short_when_expected_five(dialogue_svc) -> None:
    detail = PathDetail(
        path=PathOption(
            path_id="math_path_01",
            subject_id="math",
            title="Camino",
            intro="Intro",
            learning_blurb="Blurb",
            path_narrative=_LONG_SCENE,
            lesson_narrative=_LONG_LESSON,
        ),
        challenges=[_path_challenge_seed("¿2+2?") for _ in range(4)],
    )
    parsed, issue = dialogue_svc._path_detail_to_pack_entry(
        detail, "math", ["math"], 0, "test-model", expected_count=5
    )
    assert parsed is None
    assert issue == "path_challenge_count_short"


@pytest.mark.unit
def test_path_detail_to_pack_entry_truncates_extra_challenges(dialogue_svc) -> None:
    detail = PathDetail(
        path=PathOption(
            path_id="math_path_01",
            subject_id="math",
            title="Camino",
            intro="Intro",
            learning_blurb="Blurb",
            path_narrative=_LONG_SCENE,
            lesson_narrative=_LONG_LESSON,
        ),
        challenges=[_path_challenge_seed(f"¿{i}?") for i in range(7)],
    )
    parsed, issue = dialogue_svc._path_detail_to_pack_entry(
        detail, "math", ["math"], 0, "test-model", expected_count=5
    )
    assert issue is None
    assert parsed is not None
    assert len(parsed["challenges"]) == 5
    assert parsed["challenges_per_path"] == 5


@pytest.mark.unit
def test_path_compose_prompt_uses_band_and_tutor_challenge_count() -> None:
    child = sample_child(age_years=15, age_band="band_teen")
    context = PathComposerContextService.build_context(child)
    svc = DialogueService.__new__(DialogueService)
    prompt = svc._path_compose_prompt(
        child, ["math"], context, path_count=1, slot_subject="math"
    )
    assert "EXACTAMENTE 5 retos" in prompt
    sticky = sample_child(
        age_years=9,
        age_band="band_child",
        settings={"learning": {"challenges_per_path": 8}},
    )
    sticky_prompt = svc._path_compose_prompt(
        sticky, ["math"], PathComposerContextService.build_context(sticky), path_count=1
    )
    assert "EXACTAMENTE 8 retos" in sticky_prompt


@pytest.mark.unit
def test_finalize_placement_queue_item_infers_from_explanation() -> None:
    item = DialogueService._finalize_placement_queue_item(
        {
            "item_type": "mcq",
            "options": [
                {"id": "a", "label": "10"},
                {"id": "b", "label": "24"},
            ],
            "correct_option_id": None,
            "explanation": "La opción correcta es 24, porque 4 veces 6 es 24.",
        }
    )
    assert item["correct_option_id"] == "b"


@pytest.mark.unit
def test_finalize_path_challenge_infers_correct_option_from_explanation() -> None:
    challenge = DialogueService._finalize_path_challenge(
        {
            "item_type": "mcq",
            "options": [
                {"id": "a", "label": "10"},
                {"id": "b", "label": "24"},
                {"id": "c", "label": "20"},
            ],
            "correct_option_id": None,
            "explanation": "La opción correcta es 24, porque 4 veces 6 es 24.",
        }
    )
    assert challenge["correct_option_id"] == "b"


@pytest.mark.unit
def test_finalize_path_challenge_normalizes_malformed_option_ids() -> None:
    challenge = DialogueService._finalize_path_challenge(
        {
            "item_type": "mcq",
            "options": [
                {"id": "a", "label": "9"},
                {"id": "b:", "label": "18"},
                {"id": "c:", "label": "12"},
            ],
            "correct_option_id": None,
            "explanation": "La opción correcta es 18, porque 3 veces 6 es 18.",
        }
    )
    assert [opt["id"] for opt in challenge["options"]] == ["a", "b", "c"]
    assert challenge["correct_option_id"] == "b"


@pytest.mark.unit
def test_choice_echo_meta_marks_correct_when_llm_omits_correct_option_id() -> None:
    mentor = DialogueService._turn(
        {
            "id": uuid4(),
            "child_id": CHILD_ID,
            "session_id": SESSION_ID,
            "flow_id": "first_run",
            "sequence": 3,
            "role": "mentor",
            "text": "¿Cuántas flores?",
            "options": [
                {"id": "a", "label": "10"},
                {"id": "b", "label": "24"},
                {"id": "c", "label": "20"},
            ],
            "meta": {"phase": "path_challenge"},
        }
    )
    scoring_item = {
        "item_type": "mcq",
        "options": [
            {"id": "a", "label": "10"},
            {"id": "b", "label": "24"},
            {"id": "c", "label": "20"},
        ],
        "correct_option_id": None,
        "explanation": "La opción correcta es 24, porque 4 veces 6 es 24.",
    }
    meta = DialogueService._choice_echo_meta(
        mentor,
        selected_id="b",
        display_label="24",
        reply={"option_id": "b"},
        scoring_item=scoring_item,
    )
    assert meta["choice_correct"] is True


@pytest.mark.unit
@pytest.mark.asyncio
async def test_path_challenge_answer_rejects_wrong_when_correct_id_inferred(
    dialogue_svc, tmp_path, monkeypatch
) -> None:
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
            "path_id": "math_path_01",
            "challenge_index": 0,
            "path": {
                "path_id": "math_path_01",
                "challenges": [
                    {
                        "prompt_text": "¿Cuántas flores?",
                        "item_type": "mcq",
                        "options": [
                            {"id": "a", "label": "10"},
                            {"id": "b", "label": "24"},
                            {"id": "c", "label": "20"},
                        ],
                        "correct_option_id": None,
                        "explanation": "La opción correcta es 24, porque 4 veces 6 es 24.",
                    }
                ],
            },
        },
        world_theme="fantasy",
    )
    dialogue_svc._mentor_turn = AsyncMock(
        side_effect=lambda *args, **kwargs: DialogueService._turn(
            sample_turn_row(
                text=args[4] if len(args) > 4 else kwargs.get("text", ""),
                meta=kwargs.get("meta") or (args[7] if len(args) > 7 else {}),
            )
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
    assert effects[0]["score"] == 0.0
    assert turns[0]["meta"]["retry"] is True
    get_settings.cache_clear()


@pytest.mark.unit
def test_incorrect_choice_feedback_prefixes_weak_explanation() -> None:
    item = {
        "options": [
            {"id": "a", "label": "Lento"},
            {"id": "b", "label": "Rápido"},
        ],
        "correct_option_id": "b",
        "explanation": "'Veloz' es lo mismo que rápido.",
    }
    text = DialogueService._incorrect_choice_feedback(item, {"option_id": "a"})
    assert text.startswith("«Lento» no es correcto.")
    assert "rápido" in text.lower()


@pytest.mark.unit
def test_incorrect_choice_feedback_without_explanation_names_correct() -> None:
    item = {
        "options": [
            {"id": "a", "label": "Sopló"},
            {"id": "b", "label": "Soplo"},
        ],
        "correct_option_id": "a",
    }
    text = DialogueService._incorrect_choice_feedback(item, {"option_id": "b"})
    assert "«Soplo» no es correcto." in text
    assert "«Sopló»" in text


@pytest.mark.unit
@pytest.mark.asyncio
async def test_path_intro_retry_shows_explanation_then_challenge(
    dialogue_svc, tmp_path, monkeypatch,
) -> None:
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
            "last_ok": False,
            "last_wrong_reply": {"kind": "option", "option_id": "a"},
            "path": {
                "path_id": "p1",
                "subject_id": "math",
                "challenges": [
                    {
                        "prompt_text": "¿2+2?",
                        "item_type": "mcq",
                        "options": [{"id": "a", "label": "3"}, {"id": "b", "label": "4"}],
                        "correct_option_id": "b",
                        "explanation": "Casi, prueba otra vez.",
                    },
                    {
                        "prompt_text": "¿3+3?",
                        "item_type": "mcq",
                        "options": [{"id": "a", "label": "5"}, {"id": "b", "label": "6"}],
                        "correct_option_id": "b",
                    },
                ],
            },
        },
        world_theme="fantasy",
    )
    dialogue_svc._mentor_turn = AsyncMock(
        side_effect=lambda *args, **kwargs: DialogueService._turn(
            sample_turn_row(
                text=args[4] if len(args) > 4 else kwargs.get("text", ""),
                meta=kwargs.get("meta") or (args[7] if len(args) > 7 else {}),
            )
        )
    )
    child = sample_child(parent_id=PARENT_ID)
    last = {
        "meta": {
            "phase": "path_intro",
            "retry": True,
            "explanation_shown": False,
            "challenge_index": 0,
            "path_id": "p1",
        }
    }
    effects, turns = await dialogue_svc._path_intro_retry_continue(
        CHILD_ID, SESSION_ID, sample_session_row(), 3, child, last
    )
    assert not effects
    assert turns[0]["meta"]["explanation_shown"] is True
    assert "«3» no es correcto." in str(turns[0].get("text") or "")

    last2 = {"meta": turns[0]["meta"]}
    effects2, turns2 = await dialogue_svc._path_intro_retry_continue(
        CHILD_ID, SESSION_ID, sample_session_row(), 4, child, last2
    )
    assert turns2[0]["meta"]["phase"] == "path_challenge"
    assert turns2[0]["meta"]["challenge_index"] == 1
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reemit_path_challenge_restores_question(dialogue_svc, tmp_path, monkeypatch) -> None:
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
                        "prompt_text": "¿2+2?",
                        "item_type": "mcq",
                        "options": [{"id": "a", "label": "3"}, {"id": "b", "label": "4"}],
                        "correct_option_id": "b",
                    },
                    {
                        "prompt_text": "¿3+3?",
                        "item_type": "mcq",
                        "options": [{"id": "a", "label": "5"}, {"id": "b", "label": "6"}],
                        "correct_option_id": "b",
                    },
                ],
            },
        },
        world_theme="fantasy",
    )
    dialogue_svc._child = AsyncMock(return_value=sample_child(parent_id=PARENT_ID))
    dialogue_svc.session.execute = AsyncMock(
        side_effect=[
            MagicMock(
                mappings=MagicMock(
                    return_value=MagicMock(
                        first=MagicMock(return_value=sample_session_row())
                    )
                )
            ),
            MagicMock(scalar=MagicMock(return_value=10)),
        ]
    )
    dialogue_svc._mentor_turn = AsyncMock(
        return_value=DialogueService._turn(
            sample_turn_row(
                sequence=11,
                meta={"phase": "path_challenge", "challenge_index": 0},
                text="¿2+2?",
            )
        )
    )
    turn = await dialogue_svc.reemit_path_challenge(
        AUTH_USER_ID,
        CHILD_ID,
        SESSION_ID,
        challenge_index=0,
        path_id="p1",
    )
    assert turn is not None
    assert turn["meta"]["phase"] == "path_challenge"
    assert turn["meta"]["challenge_index"] == 0
    assert turn["text"] == "¿2+2?"
    get_settings.cache_clear()


@pytest.mark.unit
def test_enrich_turn_restores_placement_options_from_ledger(dialogue_svc, mocker) -> None:
    child = sample_child()
    turn = DialogueService._turn(
        {
            "id": uuid4(),
            "child_id": CHILD_ID,
            "session_id": SESSION_ID,
            "flow_id": "first_run",
            "sequence": 5,
            "role": "mentor",
            "text": "¿Cuántas monedas?",
            "options": [
                {"id": "A", "label": "A"},
                {"id": "B", "label": "B"},
            ],
            "input_mode": "options_only",
            "explorer_reply": None,
            "meta": {
                "phase": "placement_item",
                "index": 0,
                "total": 3,
                "world_theme": "fantasy",
            },
            "model_used": None,
            "created_at": datetime.now(timezone.utc),
        }
    )
    mocker.patch.object(
        dialogue_svc,
        "_read_placement_state",
        return_value={
            "queue": [
                {
                    "item_key": "q1",
                    "options": [
                        {"id": "A", "label": "240"},
                        {"id": "B", "label": "180"},
                    ],
                }
            ],
            "index": 0,
        },
    )
    enriched = dialogue_svc._enrich_turn(turn, child)
    assert enriched["options"][0]["label"] == "240"
    assert enriched["options"][1]["label"] == "180"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reemit_placement_item_reuses_queue(dialogue_svc, mocker) -> None:
    child = sample_child(onboarding_step="placement", placement_status="in_progress")
    session = sample_session_row()
    queue_item = {
        "subject_id": "math",
        "item_key": "q1",
        "item_type": "mcq",
        "prompt_text": "¿2+2?",
        "presentation_text": "Calienta motores: ¿2+2?",
        "options": [
            {"id": "a", "label": "3"},
            {"id": "b", "label": "4"},
        ],
        "correct_option_id": "b",
    }
    dialogue_svc._child = mocker.AsyncMock(return_value=child)
    dialogue_svc.session = ScriptedSession(
        [
            FakeExecuteResult(rows=session),
            FakeExecuteResult(scalar=6),
        ]
    )
    dialogue_svc._read_placement_state = mocker.Mock(
        return_value={"queue": [queue_item, queue_item], "index": 0}
    )
    inserted: dict[str, Any] = {}

    async def fake_insert(row: dict[str, Any]) -> dict[str, Any]:
        inserted.update(row)
        return DialogueService._turn(
            sample_turn_row(
                sequence=row["sequence"],
                text=row["text"],
                options=row.get("options"),
                meta=row.get("meta"),
            )
        )

    dialogue_svc._insert = fake_insert
    turn = await dialogue_svc.reemit_placement_item(
        AUTH_USER_ID,
        CHILD_ID,
        SESSION_ID,
        item_index=0,
    )
    assert turn is not None
    assert inserted["text"] == "Calienta motores: ¿2+2?"
    assert inserted["meta"]["phase"] == "placement_item"
    assert inserted["meta"]["index"] == 0
    assert inserted["meta"]["total"] == 2

