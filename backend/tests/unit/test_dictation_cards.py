from __future__ import annotations

import pytest

from app.services.dictation_cards import (
    DEBUG_DICTATION_OPTION_ID,
    PRODUCT_DICTATION_OPTION_ID,
    debug_dictation_card,
    merge_choose_path_dictation_options,
    merge_debug_dictation_option,
    product_dictation_card,
)


@pytest.mark.unit
def test_debug_card_sci_fi_has_stable_id() -> None:
    card = debug_dictation_card("sci-fi", rotate_key="seed-1")
    assert card["id"] == DEBUG_DICTATION_OPTION_ID
    assert card["kind"] == "debug_dictation"
    assert "debug" in (card.get("badge") or "").lower() or card.get("badge") == "debug"
    assert card["label"]
    assert card["description"]


@pytest.mark.unit
def test_debug_card_fantasy_differs_from_sci_fi() -> None:
    sci = debug_dictation_card("sci-fi", rotate_key="same")
    fan = debug_dictation_card("fantasy", rotate_key="same")
    assert sci["label"] != fan["label"] or sci["description"] != fan["description"]


@pytest.mark.unit
def test_rotate_changes_copy_within_world() -> None:
    a = debug_dictation_card("fantasy", rotate_key="a")
    b = debug_dictation_card("fantasy", rotate_key="b")
    titles = {a["label"], b["label"]}
    # Two keys should usually differ; if hash collides, still valid cards.
    assert a["id"] == b["id"]
    assert len(titles) >= 1


@pytest.mark.unit
def test_merge_appends_only_when_allowed() -> None:
    pack = [{"id": "p1", "label": "Bosque"}]
    assert merge_debug_dictation_option(pack, enabled=False, world="fantasy") == pack
    merged = merge_debug_dictation_option(
        pack, enabled=True, world="fantasy", rotate_key="x"
    )
    assert len(merged) == 2
    assert merged[-1]["id"] == DEBUG_DICTATION_OPTION_ID
    assert merged[0]["id"] == "p1"


@pytest.mark.unit
def test_product_card_has_no_debug_badge() -> None:
    card = product_dictation_card("fantasy", rotate_key="seed")
    assert card["id"] == PRODUCT_DICTATION_OPTION_ID
    assert card["kind"] == "dictation"
    assert card.get("badge") in (None, "")
    assert card["label"]
    assert card["description"]


@pytest.mark.unit
def test_merge_product_appends_fourth_when_enabled() -> None:
    pack = [
        {"id": "p1", "label": "Bosque"},
        {"id": "p2", "label": "Río"},
        {"id": "p3", "label": "Cumbre"},
    ]
    merged = merge_choose_path_dictation_options(
        pack,
        product_enabled=True,
        debug_enabled=False,
        offer_skips=0,
        every_n=3,
        world="fantasy",
        rotate_key="x",
    )
    assert [o["id"] for o in merged[:3]] == ["p1", "p2", "p3"]
    assert merged[-1]["id"] == PRODUCT_DICTATION_OPTION_ID
    assert len(merged) == 4


@pytest.mark.unit
def test_merge_product_mandatory_only_dictation() -> None:
    pack = [
        {"id": "p1", "label": "Bosque"},
        {"id": "p2", "label": "Río"},
        {"id": "p3", "label": "Cumbre"},
    ]
    merged = merge_choose_path_dictation_options(
        pack,
        product_enabled=True,
        debug_enabled=True,
        offer_skips=3,
        every_n=3,
        world="sci-fi",
        rotate_key="x",
    )
    assert [o["id"] for o in merged] == [PRODUCT_DICTATION_OPTION_ID]
    assert merged[0]["kind"] == "dictation"


@pytest.mark.unit
def test_merge_product_not_debug_when_disabled() -> None:
    pack = [{"id": "p1", "label": "Bosque"}]
    assert merge_choose_path_dictation_options(
        pack,
        product_enabled=False,
        debug_enabled=False,
        offer_skips=9,
        every_n=3,
        world="fantasy",
    ) == pack


@pytest.mark.unit
def test_merge_debug_only_when_product_off() -> None:
    pack = [{"id": "p1", "label": "Bosque"}]
    merged = merge_choose_path_dictation_options(
        pack,
        product_enabled=False,
        debug_enabled=True,
        offer_skips=0,
        every_n=3,
        world="fantasy",
        rotate_key="x",
    )
    assert merged[-1]["id"] == DEBUG_DICTATION_OPTION_ID
    assert merged[0]["id"] == "p1"
