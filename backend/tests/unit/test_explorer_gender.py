"""Tests catálogo explorer_gender (SPEC_APP_EXPLORER_GENDER)."""
from __future__ import annotations

import pytest

from app.catalogs.age_band import AgeBand
from app.catalogs.explorer_gender import (
    assert_explorer_gender,
    canonical_gender_question,
    display_label_for_gender,
    gender_chip_options,
    resolve_explorer_gender,
)


@pytest.mark.unit
@pytest.mark.parametrize(
    "raw,expected",
    [
        (None, "male"),
        ("male", "male"),
        ("female", "female"),
    ],
)
def test_resolve_explorer_gender(raw: str | None, expected: str) -> None:
    assert resolve_explorer_gender(raw) == expected


@pytest.mark.unit
def test_assert_explorer_gender_invalid() -> None:
    with pytest.raises(ValueError, match="explorer_gender invalid"):
        assert_explorer_gender("other")


@pytest.mark.unit
@pytest.mark.parametrize(
    "band,question",
    [
        (AgeBand.EARLY, "En la aventura, ¿chico o chica?"),
        (AgeBand.CHILD, "En la aventura, ¿eres chico o chica?"),
        (AgeBand.TWEEN, "Para contarte la aventura como toca"),
        (AgeBand.TEEN, "Prefieres que te trate de chico"),
        (AgeBand.ADULT, "Prefieres que te trate de hombre"),
        (AgeBand.SENIOR, "Prefieres que te trate de hombre"),
    ],
)
def test_canonical_gender_question(band: str, question: str) -> None:
    assert question in canonical_gender_question(band, None)


@pytest.mark.unit
def test_gender_chip_options_child_vs_adult() -> None:
    child_opts = gender_chip_options(AgeBand.CHILD, 8)
    adult_opts = gender_chip_options(AgeBand.ADULT, 30)
    assert child_opts[0]["label"] == "Chico"
    assert adult_opts[0]["label"] == "Hombre"


@pytest.mark.unit
def test_display_label_legacy_null() -> None:
    assert display_label_for_gender(None, 8) == "Chico"
    assert display_label_for_gender(None, 30) == "Hombre"
