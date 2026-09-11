from __future__ import annotations

import pytest

from app.services.dictation_pedagogy import (
    build_tutor_context_block,
    word_count_range,
    world_frame,
)
from app.services.dictation_orthography import (
    advance_orthography,
    effective_orthography,
)
from app.services.dictation_photo import validate_dictation_photo_url


@pytest.mark.unit
def test_word_count_range_by_band() -> None:
    early_l1 = word_count_range("band_early", "L1")
    early_l6 = word_count_range("band_early", "L6")
    adult_l1 = word_count_range("band_adult", "L1")
    adult_l6 = word_count_range("band_adult", "L6")
    assert early_l1[0] >= 8
    assert early_l6[1] <= 15
    assert early_l1[0] <= early_l6[0]
    assert adult_l1[0] >= 60
    assert adult_l6[1] <= 100
    assert adult_l6[0] > adult_l1[0]


@pytest.mark.unit
def test_orthography_starts_at_l1_and_advances() -> None:
    state = effective_orthography(None)
    assert state["orthography_level_id"] == "L1"
    bumped = advance_orthography(state, challenges_per_path=3)
    assert bumped["orthography_rolling"] > state["orthography_rolling"]
    assert bumped["orthography_level_id"] == "L1"


@pytest.mark.unit
def test_tutor_context_includes_focus_and_language_note() -> None:
    block = build_tutor_context_block(
        {
            "dictation": {
                "focus_tags": ["accentuation"],
                "focus_note": "esdrújulas",
            },
            "general_note": "le cuesta escribir",
            "subject_notes": [{"subject_id": "language", "note": "b/v"}, {"subject_id": "math", "note": "sumas"}],
        },
        weak_points=[{"id": "w1", "label": "tilde en esdrújulas", "count": 3}],
    )
    assert "accentuation" in block
    assert "esdrújulas" in block
    assert "b/v" in block
    assert "le cuesta escribir" in block
    assert "sumas" not in block
    assert "tilde en esdrújulas" in block


@pytest.mark.unit
def test_world_frame_differs() -> None:
    sci = world_frame("sci-fi", rotate_key="k")
    fan = world_frame("fantasy", rotate_key="k")
    assert sci["marco"] != fan["marco"]
    assert "tts" in sci and "tts" in fan


@pytest.mark.unit
def test_photo_url_must_match_user_and_category() -> None:
    ok = validate_dictation_photo_url(
        "/media/dictations/user-1/ab12cd.jpg",
        user_id="user-1",
    )
    assert ok.endswith(".jpg")
    with pytest.raises(ValueError, match="dictation_photo_invalid"):
        validate_dictation_photo_url("/media/avatars/user-1/x.jpg", user_id="user-1")
    with pytest.raises(ValueError, match="dictation_photo_invalid"):
        validate_dictation_photo_url(
            "/media/dictations/other/x.jpg",
            user_id="user-1",
        )
    with pytest.raises(ValueError, match="dictation_photo_invalid"):
        validate_dictation_photo_url(
            "/media/dictations/user-1/../secret.jpg",
            user_id="user-1",
        )
