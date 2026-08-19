"""Tests for age-band floor + subject-level challenge calibration."""

from __future__ import annotations

import pytest

from app.catalogs.age_band import AgeBand
from app.services.challenge_difficulty import ChallengeDifficultyService


@pytest.mark.parametrize(
    ("age_band", "level_id", "rolling", "modifier", "expected_floor", "expected_target"),
    [
        (AgeBand.EARLY, "L1", 0.10, 0.0, 1, 1),
        (AgeBand.CHILD, "L1", 0.10, 0.0, 1, 1),
        (AgeBand.TWEEN, "L1", 0.10, 0.0, 2, 2),
        (AgeBand.TEEN, "L1", 0.10, 0.0, 2, 2),
        (AgeBand.TEEN, "L3", 0.10, 0.0, 2, 3),
        (AgeBand.TEEN, "L4", 0.10, 0.0, 2, 4),
        (AgeBand.TEEN, "L5", 1.0, 0.0, 2, 4),
        (AgeBand.ADULT, "L1", 0.10, 0.0, 3, 3),
        (AgeBand.SENIOR, "L1", 0.10, 0.0, 2, 2),
    ],
)
def test_target_stays_inside_band_floor(
    age_band: str,
    level_id: str,
    rolling: float,
    modifier: float,
    expected_floor: int,
    expected_target: int,
) -> None:
    resolved = ChallengeDifficultyService.resolve(
        age_band=age_band,
        level_id=level_id,
        accuracy_rolling=rolling,
        difficulty_modifier=modifier,
        subject_id="math",
    )
    assert resolved.floor == expected_floor
    assert resolved.target == expected_target
    assert resolved.floor <= resolved.target <= resolved.ceiling


def test_negative_modifier_cannot_drop_below_teen_floor() -> None:
    resolved = ChallengeDifficultyService.resolve(
        age_band=AgeBand.TEEN,
        level_id="L1",
        accuracy_rolling=0.10,
        difficulty_modifier=-3.0,
        subject_id="math",
    )
    assert resolved.target == 2
    assert resolved.target >= resolved.floor


def test_placement_uses_midpoint_of_band() -> None:
    teen = ChallengeDifficultyService.placement(AgeBand.TEEN, subject_id="math")
    assert teen.floor == 2
    assert teen.ceiling == 4
    assert teen.target == 3
    assert teen.level_id is None


def test_teen_math_hint_forbids_primary_addition() -> None:
    hint = ChallengeDifficultyService.curriculum_hint("math", AgeBand.TEEN)
    assert "porcentaje" in hint.lower() or "ecuacion" in hint.lower() or "ecuación" in hint.lower()
    assert "10+5" in hint
    assert "prohibido" in hint.lower()


def test_early_math_hint_allows_simple_ops() -> None:
    hint = ChallengeDifficultyService.curriculum_hint("math", AgeBand.EARLY)
    assert "una sola operación" in hint.lower() or "sumas" in hint.lower()
    assert "10+5" not in hint
