from __future__ import annotations

import uuid

import pytest

from app.ai.journey.ledger import JourneyLedger
from app.services.inventory import InventoryService


@pytest.mark.unit
def test_hydrate_item_exposes_usage_count() -> None:
    inv = InventoryService()
    row = {
        "id": "row1",
        "item_def_id": "fantasy_potion_focus_math",
        "qty": 2,
        "instance_name": "Poción de calma",
        "acquired_at": "2026-08-15",
        "last_used_at": "2026-08-16T10:00:00Z",
        "meta": {"usage_count": 3},
    }
    dto = inv._hydrate_item(row, "fantasy", ["math"], audience="tutor")
    assert dto is not None
    assert dto["usage_count"] == 3
    assert dto["last_used_at"] == "2026-08-16T10:00:00Z"


@pytest.mark.unit
def test_get_usage_log_hydrates_ledger_events(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    parent = str(uuid.uuid4())
    child = str(uuid.uuid4())
    session = str(uuid.uuid4())
    ledger = JourneyLedger(tmp_path)
    ledger.append_event(
        parent,
        child,
        session,
        kind="item_used",
        payload={
            "item_def_id": "fantasy_potion_focus_math",
            "instance_name": "Poción de calma",
            "effect_id": "challenge_hint",
            "challenge_index": 1,
            "path_id": "path-abc",
            "subject_id": "math",
        },
        world_theme="fantasy",
    )
    inv = InventoryService()
    rows = inv.get_usage_log(parent, child, "fantasy")
    assert len(rows) == 1
    assert rows[0]["effect_id"] == "challenge_hint"
    assert rows[0]["effect_label_tutor"] == "Pista en reto"
    assert rows[0]["label_tutor"]
    assert rows[0]["subject_labels"] == ["Matemáticas"]
    assert rows[0]["context_hint"] == "Reto 2 · camino"
    get_settings.cache_clear()
