from __future__ import annotations

import pytest

from app.services.settings import ParentSettingsService


@pytest.mark.unit
def test_parent_settings_defaults_have_schema_version() -> None:
    defaults = ParentSettingsService.defaults()
    assert defaults["schema_version"] == 1
    assert defaults["ui_theme"] == "fantasy"


@pytest.mark.unit
def test_parent_settings_apply_patch_ui_theme() -> None:
    current = ParentSettingsService.defaults()
    merged = ParentSettingsService.apply_patch(current, {"ui_theme": "sci-fi"})
    assert merged["ui_theme"] == "sci-fi"


@pytest.mark.unit
def test_parent_settings_apply_patch_diagnostics() -> None:
    current = ParentSettingsService.defaults()
    merged = ParentSettingsService.apply_patch(
        current,
        {"diagnostics": {"debug_ai_enabled": True}},
    )
    assert merged["diagnostics"]["debug_ai_enabled"] is True


@pytest.mark.unit
@pytest.mark.parametrize(
    "patch,message",
    [
        ({"ui_theme": "invalid"}, "ui_theme invalid"),
        ({"crew_defaults": {"session_limit_per_day": 0}}, "session_limit_per_day invalid"),
    ],
    ids=["ui-theme", "session-limit"],
)
def test_parent_settings_validation_errors(patch: dict, message: str) -> None:
    current = ParentSettingsService.defaults()
    with pytest.raises(ValueError, match=message):
        ParentSettingsService.apply_patch(current, patch)
