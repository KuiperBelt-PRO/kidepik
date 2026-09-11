from __future__ import annotations

import pytest

from app.services.dictation_settings import (
    DEFAULT_EVERY_N,
    effective_dictation_settings,
    normalize_dictation_patch,
)


@pytest.mark.unit
def test_effective_settings_missing_is_off() -> None:
    out = effective_dictation_settings(None)
    assert out["enabled"] is False
    assert out["trigger"] == "every_n_paths"
    assert out["every_n"] == DEFAULT_EVERY_N
    assert out["max_attempts"] == 3
    assert out["focus_tags"] == []


@pytest.mark.unit
def test_effective_settings_defaults_on_enable_fields() -> None:
    out = effective_dictation_settings({"enabled": True})
    assert out["enabled"] is True
    assert out["trigger"] == "every_n_paths"
    assert out["every_n"] == 3
    assert out["random_p"] == 0.4


@pytest.mark.unit
def test_normalize_enable_writes_defaults_and_floor() -> None:
    out = normalize_dictation_patch(
        {"enabled": True},
        existing=None,
        completed_path_count=10,
    )
    assert out["enabled"] is True
    assert out["trigger"] == "every_n_paths"
    assert out["every_n"] == 3
    assert out["enabled_at_path_count"] == 10
    assert out["last_gate_path_count"] == 10
    assert out["offer_skips"] == 0


@pytest.mark.unit
def test_normalize_reenable_resets_floor() -> None:
    existing = {
        "enabled": False,
        "trigger": "every_n_paths",
        "every_n": 5,
        "last_gate_path_count": 2,
        "enabled_at_path_count": 2,
    }
    out = normalize_dictation_patch(
        {"enabled": True},
        existing=existing,
        completed_path_count=8,
    )
    assert out["every_n"] == 5
    assert out["enabled_at_path_count"] == 8
    assert out["last_gate_path_count"] == 8


@pytest.mark.unit
def test_normalize_keeps_subjects_untouched_shape() -> None:
    out = normalize_dictation_patch(
        {"enabled": False, "focus_note": "tildes"},
        existing={"enabled": True, "trigger": "random", "random_p": 0.5},
    )
    assert out["enabled"] is False
    assert out["trigger"] == "random"
    assert out["focus_note"] == "tildes"


@pytest.mark.unit
@pytest.mark.parametrize(
    "raw",
    [2, 11, 3.5, True, "3", 0, None],
)
def test_normalize_rejects_invalid_every_n(raw: object) -> None:
    with pytest.raises(ValueError, match="learning.dictation.every_n invalid"):
        normalize_dictation_patch({"every_n": raw}, existing={"enabled": True})


@pytest.mark.unit
def test_normalize_accepts_every_n_bounds() -> None:
    assert normalize_dictation_patch({"every_n": 3}, existing={"enabled": True})["every_n"] == 3
    assert normalize_dictation_patch({"every_n": 10}, existing={"enabled": True})["every_n"] == 10


@pytest.mark.unit
def test_normalize_rejects_unknown_trigger() -> None:
    with pytest.raises(ValueError, match="learning.dictation.trigger invalid"):
        normalize_dictation_patch({"trigger": "every_path"})


@pytest.mark.unit
def test_normalize_strips_runtime_keys_from_patch() -> None:
    out = normalize_dictation_patch(
        {
            "enabled": True,
            "last_gate_path_count": 99,
            "enabled_at_path_count": 99,
        },
        completed_path_count=4,
    )
    assert out["last_gate_path_count"] == 4
    assert out["enabled_at_path_count"] == 4


@pytest.mark.unit
def test_normalize_focus_tags_and_note() -> None:
    out = normalize_dictation_patch(
        {
            "focus_tags": ["accentuation", "b_v", "nope", "accentuation"],
            "focus_note": "  trabaja las esdrújulas  ",
        }
    )
    assert out["focus_tags"] == ["accentuation", "b_v"]
    assert out["focus_note"] == "trabaja las esdrújulas"


@pytest.mark.unit
def test_normalize_rejects_focus_note_too_long() -> None:
    with pytest.raises(ValueError, match="learning.dictation.focus_note invalid"):
        normalize_dictation_patch({"focus_note": "x" * 401})


@pytest.mark.unit
def test_normalize_max_attempts() -> None:
    assert normalize_dictation_patch({"max_attempts": 2})["max_attempts"] == 2
    with pytest.raises(ValueError, match="learning.dictation.max_attempts invalid"):
        normalize_dictation_patch({"max_attempts": 1})


@pytest.mark.unit
def test_normalize_random_p() -> None:
    out = normalize_dictation_patch({"trigger": "random", "random_p": 0.25})
    assert out["random_p"] == 0.25
    with pytest.raises(ValueError, match="learning.dictation.random_p invalid"):
        normalize_dictation_patch({"random_p": 0.1})


@pytest.mark.unit
def test_offer_skips_reset_on_enable_preserved_otherwise() -> None:
    from app.services.dictation_settings import is_offer_mandatory

    existing = {
        "enabled": True,
        "every_n": 3,
        "offer_skips": 2,
        "orthography_level_id": "L2",
        "orthography_rolling": 0.4,
    }
    kept = normalize_dictation_patch({"focus_note": "tildes"}, existing=existing)
    assert kept["offer_skips"] == 2
    assert kept["orthography_level_id"] == "L2"
    assert is_offer_mandatory(kept) is False
    forced = {**kept, "offer_skips": 3}
    assert is_offer_mandatory(forced) is True
    reon = normalize_dictation_patch(
        {"enabled": True},
        existing={"enabled": False, "offer_skips": 9, "every_n": 3},
        completed_path_count=4,
    )
    assert reon["offer_skips"] == 0
