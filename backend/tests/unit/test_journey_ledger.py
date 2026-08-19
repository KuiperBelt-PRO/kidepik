from __future__ import annotations

import uuid

import pytest

from app.ai.journey.ledger import JourneyLedger, require_uuid


@pytest.mark.unit
def test_require_uuid_rejects_traversal() -> None:
    with pytest.raises(ValueError):
        require_uuid("../etc/passwd", label="child_id")
    with pytest.raises(ValueError):
        require_uuid("not-a-uuid", label="child_id")


@pytest.mark.unit
def test_read_item_used_events_across_sessions(tmp_path) -> None:
    ledger = JourneyLedger(tmp_path)
    parent = str(uuid.uuid4())
    child = str(uuid.uuid4())
    session_a = str(uuid.uuid4())
    session_b = str(uuid.uuid4())
    ledger.append_event(
        parent,
        child,
        session_a,
        kind="item_used",
        payload={
            "item_def_id": "fantasy_potion_focus_math",
            "instance_name": "Poción de calma",
            "effect_id": "challenge_hint",
            "challenge_index": 0,
            "path_id": "path-1",
            "subject_id": "math",
        },
        world_theme="fantasy",
    )
    ledger.append_event(
        parent,
        child,
        session_b,
        kind="item_used",
        payload={
            "item_def_id": "fantasy_charm_second_chance_math",
            "effect_id": "challenge_retry",
            "challenge_index": 2,
        },
        world_theme="fantasy",
    )
    rows = ledger.read_item_used_events(parent, child, world_theme="fantasy")
    assert len(rows) == 2
    assert {r["effect_id"] for r in rows} == {"challenge_hint", "challenge_retry"}
    assert rows[0]["used_at"] >= rows[1]["used_at"]


@pytest.mark.unit
def test_append_and_read_events(tmp_path) -> None:
    ledger = JourneyLedger(tmp_path)
    parent = str(uuid.uuid4())
    child = str(uuid.uuid4())
    session = str(uuid.uuid4())

    e1 = ledger.append_event(
        parent,
        child,
        session,
        kind="mentor_utterance",
        text="Hola explorador",
        purpose="mentor_guide",
        model="gemini-3-flash-preview",
    )
    e2 = ledger.append_event(
        parent,
        child,
        session,
        kind="explorer_reply",
        text="Hola",
        payload={"option_id": None},
    )
    assert e1.seq == 1
    assert e2.seq == 2

    rows = ledger.read_events(parent, child, session)
    assert len(rows) == 2
    assert rows[0]["text"] == "Hola explorador"
    assert (tmp_path / parent / child / "index.json").is_file()


@pytest.mark.unit
def test_dialogue_jsonl_world_theme(tmp_path) -> None:
    ledger = JourneyLedger(tmp_path)
    parent = str(uuid.uuid4())
    child = str(uuid.uuid4())
    session = str(uuid.uuid4())
    ledger.append_dialogue(
        parent,
        child,
        session,
        kind="mentor_utterance",
        text="En fantasy",
        world_theme="fantasy",
    )
    path = tmp_path / parent / child / "worlds" / "fantasy" / "dialogue.jsonl"
    assert path.is_file()
    rows = ledger.read_dialogue(parent, child, world_theme="fantasy")
    assert rows[0]["text"] == "En fantasy"


@pytest.mark.unit
def test_dialogue_jsonl_and_traveler_md(tmp_path) -> None:
    ledger = JourneyLedger(tmp_path)
    parent = str(uuid.uuid4())
    child = str(uuid.uuid4())
    session = str(uuid.uuid4())

    d1 = ledger.append_dialogue(
        parent,
        child,
        session,
        kind="mentor_utterance",
        text="Elige tu forma",
        purpose="character_coach",
        model="gemini-3-flash-preview",
    )
    d2 = ledger.append_dialogue(
        parent,
        child,
        session,
        kind="explorer_reply",
        text="Soy un mago",
    )
    assert d1.seq == 1
    assert d2.seq == 2
    assert d1.session_id == session

    journey = ledger.read_dialogue(parent, child)
    assert len(journey) == 2
    assert journey[0]["session_id"] == session

    session_rows = ledger.read_events(parent, child, session)
    assert len(session_rows) == 2

    path = ledger.write_traveler_profile(
        parent,
        child,
        front_matter={
            "display_name": "Vatardar",
            "species": "Mago humano",
            "palette": "índigo",
            "features": ["curioso"],
            "abilities": ["runas"],
        },
        body_markdown="## Descripción\n\nUn mago metódico.\n\n## Atuendo\n\nTúnica índigo.",
    )
    assert path.name == "traveler.md"
    meta, body = ledger.read_traveler_profile(parent, child)
    assert meta["schema"] == "kidepik.traveler_profile/v1"
    assert meta["species"] == "Mago humano"
    assert "mago metódico" in body.lower()


@pytest.mark.unit
def test_events_world_theme_and_placement_kinds(tmp_path) -> None:
    ledger = JourneyLedger(tmp_path)
    parent = str(uuid.uuid4())
    child = str(uuid.uuid4())
    session = str(uuid.uuid4())
    ledger.append_event(
        parent,
        child,
        session,
        kind="placement_queue",
        payload={"queue": [{"item_key": "a"}]},
        world_theme="fantasy",
    )
    ledger.append_event(
        parent,
        child,
        session,
        kind="placement_answer",
        payload={"index": 0, "score": 1.0},
        world_theme="fantasy",
    )
    rows = ledger.read_events(parent, child, session, world_theme="fantasy")
    assert [r["kind"] for r in rows] == ["placement_queue", "placement_answer"]
    assert (tmp_path / parent / child / "worlds" / "fantasy" / "sessions" / session / "events.jsonl").is_file() or (
        tmp_path / parent / child / "worlds" / "fantasy"
    ).exists()


@pytest.mark.unit
def test_summary_md_roundtrip(tmp_path) -> None:
    ledger = JourneyLedger(tmp_path)
    parent = str(uuid.uuid4())
    child = str(uuid.uuid4())
    session = str(uuid.uuid4())
    path = ledger.write_session_summary(
        parent,
        child,
        session,
        front_matter={"world_theme": "fantasy", "events_up_to_seq": 2},
        body_markdown="## Qué pasó\n\nUna sesión corta.",
    )
    meta, body = ledger.read_markdown_document(path)
    assert meta["schema"] == "kidepik.session_summary/v1"
    assert meta["world_theme"] == "fantasy"
    assert "sesión corta" in body


@pytest.mark.unit
def test_archive_child(tmp_path) -> None:
    ledger = JourneyLedger(tmp_path)
    parent = str(uuid.uuid4())
    child = str(uuid.uuid4())
    session = str(uuid.uuid4())
    ledger.append_event(parent, child, session, kind="system", text="boot")
    dest = ledger.archive_child(parent, child, stamp="testrun")
    assert dest is not None
    assert dest.exists()
    assert not (tmp_path / parent / child).exists()
