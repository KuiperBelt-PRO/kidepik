from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.services.account_authorization import AccountAuthorizationService
from app.services.debug_access import (
    assert_debug_diagnostics_patch_allowed,
    debug_capabilities_for_parent,
    sanitize_debug_diagnostics,
)
from app.services.settings import ParentSettingsService


@pytest.mark.unit
@pytest.mark.asyncio
async def test_debug_capabilities_requires_permission_and_setting(settings, monkeypatch) -> None:
    monkeypatch.setenv("APP_DEBUG_AI", "true")
    from app.config import get_settings

    get_settings.cache_clear()
    auth = AsyncMock(spec=AccountAuthorizationService)
    auth.has_permission = AsyncMock(return_value=True)

    parent_settings = ParentSettingsService.defaults()
    caps = await debug_capabilities_for_parent("parent-1", parent_settings, auth=auth)
    assert caps == {
        "operator_eligible": True,
        "debug_enabled": False,
        "debug_allowed": False,
    }

    parent_settings["diagnostics"]["debug_ai_enabled"] = True
    caps = await debug_capabilities_for_parent("parent-1", parent_settings, auth=auth)
    assert caps["debug_allowed"] is True

    auth.has_permission = AsyncMock(return_value=False)
    caps = await debug_capabilities_for_parent("parent-1", parent_settings, auth=auth)
    assert caps["operator_eligible"] is False
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_sanitize_debug_diagnostics_strips_without_permission() -> None:
    auth = AsyncMock(spec=AccountAuthorizationService)
    auth.has_permission = AsyncMock(return_value=False)
    settings_dict = ParentSettingsService.defaults()
    settings_dict["diagnostics"]["debug_ai_enabled"] = True
    sanitized = await sanitize_debug_diagnostics("parent-1", settings_dict, auth=auth)
    assert sanitized["diagnostics"]["debug_ai_enabled"] is False


@pytest.mark.unit
@pytest.mark.asyncio
async def test_assert_debug_diagnostics_patch_rejects_without_permission() -> None:
    auth = AsyncMock(spec=AccountAuthorizationService)
    auth.has_permission = AsyncMock(return_value=False)
    with pytest.raises(ValueError, match="not allowed"):
        await assert_debug_diagnostics_patch_allowed(
            "parent-1",
            {"diagnostics": {"debug_ai_enabled": True}},
            auth=auth,
        )
