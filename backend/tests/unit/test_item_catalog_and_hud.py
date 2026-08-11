from __future__ import annotations

import pytest

from app.catalogs.item_catalog import ItemCatalog
from app.services.play_progress_hud import build_play_progress_hud


@pytest.mark.unit
def test_item_catalog_seed_loads() -> None:
    fantasy = ItemCatalog.list_for_world("fantasy")
    scifi = ItemCatalog.list_for_world("sci-fi")
    assert len(fantasy) >= 6
    assert len(scifi) >= 6
    potion = ItemCatalog.require("fantasy_potion_focus_math")
    assert potion["kind"] == "potion"
    assert "math" in potion["subject_ids"]
    assert ItemCatalog.effect_label("challenge_hint")


@pytest.mark.unit
def test_item_catalog_subject_filter() -> None:
    math_items = ItemCatalog.list_for_subject("fantasy", "math")
    assert math_items
    assert all("math" in d["subject_ids"] for d in math_items)


@pytest.mark.unit
def test_play_progress_hud_hidden_before_placement() -> None:
    hud = build_play_progress_hud(
        {"placement_status": "in_progress", "settings": {"learning": {}}},
        {"progress": {"general_progress": {"current": "L2", "next": "L3", "percent_to_next": 40}}},
    )
    assert hud["visible"] is False


@pytest.mark.unit
def test_play_progress_hud_visible_after_placement() -> None:
    hud = build_play_progress_hud(
        {
            "placement_status": "completed",
            "settings": {"learning": {"show_levels_to_child": True}},
        },
        {
            "progress": {
                "rank": {"label_child": "Adept"},
                "rank_next": {"label_child": "Guardian"},
                "general_progress": {"current": "L3", "next": "L4", "percent_to_next": 62},
            }
        },
    )
    assert hud["visible"] is True
    assert hud["show_levels_to_child"] is True
    assert hud["general_progress"]["percent_to_next"] == 62
    assert hud["rank_label_child"] == "Adept"
    assert hud["rank_next_label_child"] == "Guardian"
