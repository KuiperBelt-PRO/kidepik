from __future__ import annotations

import pytest

from app.catalogs.age_band import AgeBand
from app.services.subject_progress_config import (
    CHALLENGES_PER_PATH_NORM,
    DELTA_PER_CORRECT,
    challenges_per_path_from_pack,
    clamp_challenges_per_path,
    default_challenges_per_path,
    delta_per_correct,
    effective_challenges_per_path,
    normalize_challenges_per_path_patch,
    required_corrects,
)


@pytest.mark.unit
@pytest.mark.parametrize(
    "band,expected",
    [
        (AgeBand.EARLY, 3),
        (AgeBand.CHILD, 3),
        (AgeBand.SENIOR, 3),
        (AgeBand.TWEEN, 5),
        (AgeBand.TEEN, 5),
        (AgeBand.ADULT, 5),
        (None, 3),
        ("bogus", 3),
    ],
)
def test_default_challenges_per_path_by_band(band: str | None, expected: int) -> None:
    assert default_challenges_per_path(band) == expected


@pytest.mark.unit
@pytest.mark.parametrize(
    "age,expected",
    [
        (6, 3),
        (9, 3),
        (12, 5),
        (15, 5),
        (30, 5),
        (70, 3),
    ],
)
def test_default_challenges_per_path_from_age_years(age: int, expected: int) -> None:
    assert default_challenges_per_path(None, age) == expected


@pytest.mark.unit
def test_effective_uses_persisted_over_band() -> None:
    assert effective_challenges_per_path(7, AgeBand.CHILD) == 7
    assert effective_challenges_per_path(None, AgeBand.TEEN) == 5
    assert effective_challenges_per_path(True, AgeBand.TEEN) == 5
    assert effective_challenges_per_path(2, AgeBand.TEEN) == 5
    assert effective_challenges_per_path(11, AgeBand.CHILD) == 3


@pytest.mark.unit
@pytest.mark.parametrize("raw", [0, 1, 2, 11, 3.5, True, "5", None, []])
def test_normalize_patch_rejects_invalid(raw: object) -> None:
    with pytest.raises(ValueError, match="learning.challenges_per_path invalid"):
        normalize_challenges_per_path_patch(raw)


@pytest.mark.unit
def test_normalize_patch_accepts_bounds() -> None:
    assert normalize_challenges_per_path_patch(3) == 3
    assert normalize_challenges_per_path_patch(10) == 10


@pytest.mark.unit
def test_delta_matches_linear_b_for_three() -> None:
    assert delta_per_correct(3) == DELTA_PER_CORRECT
    assert delta_per_correct(None) == DELTA_PER_CORRECT
    assert delta_per_correct(5) == pytest.approx(0.045)
    assert delta_per_correct(10) == pytest.approx(0.0225)
    assert required_corrects(5) == 20
    assert clamp_challenges_per_path(1) == 3
    assert clamp_challenges_per_path(99) == 10


@pytest.mark.unit
def test_challenges_per_path_from_pack_prefers_payload_then_len() -> None:
    assert (
        challenges_per_path_from_pack(
            {"challenges": [{}, {}, {}, {}, {}]},
            {"challenges_per_path": 5},
        )
        == 5
    )
    assert challenges_per_path_from_pack({"challenges": [{}, {}, {}, {}, {}]}) == 5
    assert challenges_per_path_from_pack({}, fallback=CHALLENGES_PER_PATH_NORM) == 3
