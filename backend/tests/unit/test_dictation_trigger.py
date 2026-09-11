from __future__ import annotations

import uuid

import pytest

from app.ai.journey.ledger import JourneyLedger
from app.services.dictation_settings import effective_dictation_settings
from app.services.dictation_trigger import (
    count_path_completions,
    is_completed_path_progress,
    should_trigger_dictation,
)


def _completed_event(path_id: str = "p1") -> dict:
    return {
        "kind": "path_progress",
        "payload": {
            "path_id": path_id,
            "last_ok": True,
            "challenge_index": 3,
            "path": {"challenges": [{}, {}, {}]},
        },
    }


@pytest.mark.unit
def test_disabled_never_triggers() -> None:
    settings = effective_dictation_settings({"enabled": False, "every_n": 3})
    assert (
        should_trigger_dictation(
            settings,
            completed_path_count=9,
            subject_id="language",
            child_id="c",
            world="fantasy",
            path_id="p1",
        )
        is False
    )


@pytest.mark.unit
def test_floor_d5b_blocks_gap_under_3() -> None:
    settings = effective_dictation_settings(
        {
            "enabled": True,
            "trigger": "every_n_paths",
            "every_n": 3,
            "last_gate_path_count": 8,
        }
    )
    assert (
        should_trigger_dictation(
            settings,
            completed_path_count=10,
            subject_id="math",
            child_id="c",
            world="fantasy",
            path_id="p1",
        )
        is False
    )


@pytest.mark.unit
def test_every_n_triggers_at_n() -> None:
    settings = effective_dictation_settings(
        {
            "enabled": True,
            "trigger": "every_n_paths",
            "every_n": 4,
            "last_gate_path_count": 6,
        }
    )
    assert (
        should_trigger_dictation(
            settings,
            completed_path_count=9,
            subject_id="math",
            child_id="c",
            world="fantasy",
            path_id="p1",
        )
        is False
    )
    assert (
        should_trigger_dictation(
            settings,
            completed_path_count=10,
            subject_id="math",
            child_id="c",
            world="fantasy",
            path_id="p1",
        )
        is True
    )


@pytest.mark.unit
def test_every_n_clamped_to_minimum_3() -> None:
    settings = effective_dictation_settings(
        {
            "enabled": True,
            "trigger": "every_n_paths",
            "every_n": 3,
            "last_gate_path_count": 0,
        }
    )
    assert (
        should_trigger_dictation(
            settings,
            completed_path_count=2,
            subject_id="math",
            child_id="c",
            world="fantasy",
            path_id="p1",
        )
        is False
    )
    assert (
        should_trigger_dictation(
            settings,
            completed_path_count=3,
            subject_id="math",
            child_id="c",
            world="fantasy",
            path_id="p1",
        )
        is True
    )


@pytest.mark.unit
def test_language_paths_only() -> None:
    settings = effective_dictation_settings(
        {
            "enabled": True,
            "trigger": "language_paths_only",
            "last_gate_path_count": 0,
        }
    )
    kwargs = {
        "completed_path_count": 3,
        "child_id": "c",
        "world": "fantasy",
        "path_id": "p1",
    }
    assert should_trigger_dictation(settings, subject_id="math", **kwargs) is False
    assert should_trigger_dictation(settings, subject_id="language", **kwargs) is True


@pytest.mark.unit
def test_random_is_stable_for_same_path() -> None:
    settings = effective_dictation_settings(
        {
            "enabled": True,
            "trigger": "random",
            "random_p": 0.5,
            "last_gate_path_count": 0,
        }
    )
    kwargs = {
        "settings": settings,
        "completed_path_count": 5,
        "subject_id": "math",
        "child_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "world": "sci-fi",
        "path_id": "path-stable",
    }
    first = should_trigger_dictation(**kwargs)
    second = should_trigger_dictation(**kwargs)
    assert first is second


@pytest.mark.unit
def test_never_gated_uses_total_completed_as_gap() -> None:
    settings = effective_dictation_settings({"enabled": True, "every_n": 3})
    assert (
        should_trigger_dictation(
            settings,
            completed_path_count=2,
            subject_id="math",
            child_id="c",
            world="fantasy",
            path_id="p1",
        )
        is False
    )
    assert (
        should_trigger_dictation(
            settings,
            completed_path_count=3,
            subject_id="math",
            child_id="c",
            world="fantasy",
            path_id="p1",
        )
        is True
    )


@pytest.mark.unit
def test_count_path_completions_from_ledger(tmp_path) -> None:
    ledger = JourneyLedger(tmp_path)
    parent = str(uuid.uuid4())
    child = str(uuid.uuid4())
    session = str(uuid.uuid4())
    payload = _completed_event("alpha")["payload"]
    ledger.append_event(
        parent,
        child,
        session,
        kind="path_progress",
        payload=payload,
        world_theme="fantasy",
    )
    ledger.append_event(
        parent,
        child,
        session,
        kind="path_progress",
        payload={
            "path_id": "beta",
            "last_ok": True,
            "challenge_index": 1,
            "path": {"challenges": [{}, {}, {}]},
        },
        world_theme="fantasy",
    )
    assert count_path_completions(ledger, parent, child, "fantasy") == 1
    assert is_completed_path_progress(_completed_event()) is True
