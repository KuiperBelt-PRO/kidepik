from __future__ import annotations

import uuid

import pytest

from app.ai.journey.ledger import JourneyLedger, require_uuid


def test_require_uuid_rejects_traversal() -> None:
    with pytest.raises(ValueError):
        require_uuid("../etc/passwd", label="child_id")
    with pytest.raises(ValueError):
        require_uuid("not-a-uuid", label="child_id")


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

    # Eco en sesión (2 eventos echo)
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
