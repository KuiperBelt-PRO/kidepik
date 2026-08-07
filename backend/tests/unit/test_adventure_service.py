from __future__ import annotations

import pytest

from app.services.adventure import AdventureService


@pytest.mark.unit
def test_adventure_compose_failed_turn() -> None:
    turn = AdventureService.compose_failed_turn("zone_intro")
    assert turn["meta"]["compose_kind"] == "zone_intro"
    assert turn["options"][0]["id"] == "retry_compose"


@pytest.mark.unit
def test_adventure_zone_title() -> None:
    title = AdventureService.zone_title("fantasy", "zone_math")
    assert isinstance(title, str)
    assert title


@pytest.mark.unit
def test_completed_zone_ids_from_settings() -> None:
    child = {"settings": {"journey": {"zones_completed": ["zone_math", "zone_logic"]}}}
    assert AdventureService.completed_zone_ids(child) == ["zone_math", "zone_logic"]
