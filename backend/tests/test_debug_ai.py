from __future__ import annotations

from app.services.debug_ai import PURPOSE_ALIASES, normalize_purpose


def test_normalize_purpose_aliases() -> None:
    assert normalize_purpose("placement_exam_composer") == "placement_item_writer"
    assert normalize_purpose("dialogue") == "mentor_guide"
    assert normalize_purpose("mentor_guide") == "mentor_guide"
    assert normalize_purpose(None) == "mentor_guide"
    assert "placement_exam_composer" in PURPOSE_ALIASES
