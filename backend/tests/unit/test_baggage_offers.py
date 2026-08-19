"""Tests for baggage offer chips in play."""

from __future__ import annotations

import pytest

from app.services.baggage_offers import BaggageOfferService


@pytest.mark.unit
def test_challenge_context_path_challenge() -> None:
    ctx = BaggageOfferService._challenge_context(
        "path_challenge",
        {"phase": "path_challenge", "challenge_index": 1, "path_id": "p1"},
        {
            "path": {
                "path_id": "p1",
                "subject_id": "math",
                "challenges": [{"subject_id": "math"}, {"subject_id": "math"}],
            },
            "challenge_index": 1,
            "helps": {},
        },
        eligible_retry=False,
    )
    assert ctx is not None
    assert ctx["subject_id"] == "math"
    assert ctx["challenge_ref"] == "p1:1"


@pytest.mark.unit
def test_challenge_context_path_intro_retry() -> None:
    ctx = BaggageOfferService._challenge_context(
        "path_intro",
        {"phase": "path_intro", "retry": True, "challenge_index": 0},
        {
            "path": {
                "path_id": "p2",
                "subject_id": "language",
                "challenges": [{"subject_id": "language"}],
            },
            "helps": {},
        },
        eligible_retry=True,
    )
    assert ctx is not None
    assert ctx["eligible_retry"] is True


@pytest.mark.unit
@pytest.mark.asyncio
async def test_offers_remain_visible_after_hint_used(monkeypatch: pytest.MonkeyPatch) -> None:
    child = {"id": "child-1", "world_theme": "fantasy", "age_band": "band_child"}

    async def fake_baggage(*_a: object, **_k: object) -> dict[str, object]:
        return {
            "items": [
                {
                    "id": "row-1",
                    "item_def_id": "fantasy_potion_focus_math",
                    "label_child": "Elixir",
                    "description_child": "Ayuda con números.",
                    "icon_id": "item-potion",
                    "subject_ids": ["math"],
                    "subject_labels": ["Matemáticas"],
                    "usable_now": True,
                    "can_use": True,
                    "effects": ["challenge_hint"],
                    "rarity": "common",
                },
                {
                    "id": "row-2",
                    "item_def_id": "fantasy_charm_second_chance_math",
                    "label_child": "Medallón",
                    "description_child": "Segundo intento.",
                    "icon_id": "item-charm",
                    "subject_ids": ["math"],
                    "subject_labels": ["Matemáticas"],
                    "usable_now": True,
                    "can_use": True,
                    "effects": ["challenge_retry"],
                    "rarity": "uncommon",
                },
            ]
        }

    monkeypatch.setattr(
        "app.catalogs.subject_catalog.SubjectCatalog.resolve_active_subjects",
        lambda _child: ["math"],
    )
    svc = BaggageOfferService()
    monkeypatch.setattr(svc.inventory, "get_baggage", fake_baggage)

    offers = await svc.offers_for_play(
        child,
        phase="path_challenge",
        meta={"phase": "path_challenge", "challenge_index": 0},
        progress={
            "path": {
                "path_id": "p1",
                "subject_id": "math",
                "challenges": [{"subject_id": "math"}],
            },
            "helps": {"0": {"hint": True}},
        },
        eligible_retry=False,
    )

    assert len(offers) == 2
    hint = next(o for o in offers if o["effect_id"] == "challenge_hint")
    retry = next(o for o in offers if o["effect_id"] == "challenge_retry")
    assert hint["can_use"] is False
    assert "pista" in str(hint["use_blocked_reason"]).lower()
    assert retry["can_use"] is False


@pytest.mark.unit
@pytest.mark.asyncio
async def test_offers_include_other_subjects_blocked(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    child = {"id": "child-1", "world_theme": "fantasy", "age_band": "band_child"}

    async def fake_baggage(*_a: object, **_k: object) -> dict[str, object]:
        return {
            "items": [
                {
                    "id": "row-math",
                    "item_def_id": "fantasy_potion_focus_math",
                    "label_child": "Elixir",
                    "description_child": "Ayuda con números.",
                    "icon_id": "item-potion",
                    "subject_ids": ["math"],
                    "subject_labels": ["Matemáticas"],
                    "qty": 1,
                    "effects": ["challenge_hint"],
                    "rarity": "common",
                },
                {
                    "id": "row-lang",
                    "item_def_id": "fantasy_potion_focus_language",
                    "label_child": "Brebaje",
                    "description_child": "Ayuda con palabras.",
                    "icon_id": "item-potion",
                    "subject_ids": ["language"],
                    "subject_labels": ["Lengua"],
                    "qty": 1,
                    "effects": ["challenge_hint"],
                    "rarity": "common",
                },
            ]
        }

    monkeypatch.setattr(
        "app.catalogs.subject_catalog.SubjectCatalog.resolve_active_subjects",
        lambda _child: ["math", "language"],
    )
    svc = BaggageOfferService()
    monkeypatch.setattr(svc.inventory, "get_baggage", fake_baggage)

    offers = await svc.offers_for_play(
        child,
        phase="path_challenge",
        meta={"phase": "path_challenge", "challenge_index": 0},
        progress={
            "path": {
                "path_id": "p1",
                "subject_id": "math",
                "challenges": [{"subject_id": "math"}],
            },
            "helps": {},
        },
        eligible_retry=False,
    )

    assert len(offers) == 2
    math = next(o for o in offers if o["item_row_id"] == "row-math")
    lang = next(o for o in offers if o["item_row_id"] == "row-lang")
    assert math["can_use"] is True
    assert lang["can_use"] is False
    assert "Lengua" in str(lang["use_blocked_reason"])
