from __future__ import annotations

import pytest

from app.catalogs.age_band import AgeBand


@pytest.mark.unit
@pytest.mark.parametrize(
    "age,expected",
    [
        (5, AgeBand.EARLY),
        (7, AgeBand.EARLY),
        (8, AgeBand.CHILD),
        (11, AgeBand.TWEEN),
        (15, AgeBand.TEEN),
        (30, AgeBand.ADULT),
        (70, AgeBand.SENIOR),
    ],
    ids=["early-min", "early-max", "child", "tween", "teen", "adult", "senior"],
)
def test_from_age_years(age: int, expected: str) -> None:
    assert AgeBand.from_age_years(age) == expected


@pytest.mark.unit
@pytest.mark.parametrize(
    "age",
    [4, 100],
    ids=["too-young", "too-old"],
)
def test_assert_age_years_invalid(age: int) -> None:
    with pytest.raises(ValueError, match="age_years invalid"):
        AgeBand.assert_age_years(age)


@pytest.mark.unit
def test_from_legacy_mappings() -> None:
    assert AgeBand.from_legacy("age_7", 6) == AgeBand.EARLY
    assert AgeBand.from_legacy("age_9", 12) == AgeBand.TWEEN
    assert AgeBand.from_legacy(AgeBand.CHILD) == AgeBand.CHILD
