from __future__ import annotations

import pytest

from app.services.dictation_weak_points import apply_attempt_to_weak_points


@pytest.mark.unit
def test_fail_increments_and_pass_decays() -> None:
    points = apply_attempt_to_weak_points(
        [],
        errors=[{"error_class": "accent", "expected": "árbol", "got": "arbol", "tag": "accentuation"}],
        now="2026-09-06T10:00:00Z",
    )
    assert len(points) == 1
    assert points[0]["count"] == 1
    assert points[0]["tag"] == "accentuation"
    assert "arbol" in points[0]["examples"]

    decayed = apply_attempt_to_weak_points(
        points,
        errors=[],
        correct_tags=["accentuation"],
        now="2026-09-06T11:00:00Z",
    )
    assert decayed[0]["count"] == 0
