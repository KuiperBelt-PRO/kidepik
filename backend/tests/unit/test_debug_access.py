from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.services.account_authorization import AccountAuthorizationService
from app.services.debug_access import (
    assert_debug_diagnostics_patch_allowed,
    debug_capabilities_for_crew,
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
async def test_has_bootstrap_email_permission(mocker) -> None:
    session = mocker.AsyncMock()
    session.execute = mocker.AsyncMock(return_value=mocker.Mock(scalar_one_or_none=mocker.Mock(return_value=1)))
    mocker.patch(
        "app.services.account_authorization.session_scope",
        return_value=mocker.AsyncMock(
            __aenter__=mocker.AsyncMock(return_value=session),
            __aexit__=mocker.AsyncMock(return_value=None),
        ),
    )
    assert await AccountAuthorizationService().has_bootstrap_email_permission(
        "eduardosernaalonso@gmail.com",
        "debug_ai",
    ) is True


@pytest.mark.unit
@pytest.mark.asyncio
async def test_debug_capabilities_crew_bootstrap_email(settings, monkeypatch, mocker) -> None:
    monkeypatch.setenv("APP_DEBUG_AI", "true")
    from app.config import get_settings

    get_settings.cache_clear()
    auth = mocker.AsyncMock(spec=AccountAuthorizationService)
    auth.has_bootstrap_email_permission = mocker.AsyncMock(return_value=True)
    mocker.patch(
        "app.services.debug_access._child_settings",
        mocker.AsyncMock(return_value={"diagnostics": {"debug_ai_enabled": True}}),
    )
    mocker.patch(
        "app.services.debug_access._child_invite_email",
        mocker.AsyncMock(return_value=None),
    )
    caps = await debug_capabilities_for_crew(
        "eduardosernaalonso@gmail.com",
        "child-1",
        auth=auth,
    )
    assert caps["operator_eligible"] is True
    assert caps["debug_allowed"] is True
    get_settings.cache_clear()


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
