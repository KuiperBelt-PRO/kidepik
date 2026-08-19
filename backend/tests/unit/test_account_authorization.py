from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.services.account_authorization import AccountAuthorizationService


@pytest.mark.unit
@pytest.mark.asyncio
async def test_has_permission_true(mocker) -> None:
    session = AsyncMock()
    session.execute = AsyncMock(return_value=mocker.Mock(scalar_one_or_none=mocker.Mock(return_value=1)))
    mocker.patch(
        "app.services.account_authorization.session_scope",
        return_value=mocker.AsyncMock(
            __aenter__=AsyncMock(return_value=session),
            __aexit__=AsyncMock(return_value=False),
        ),
    )
    assert await AccountAuthorizationService().has_permission("parent-1", "debug_ai") is True


@pytest.mark.unit
@pytest.mark.asyncio
async def test_apply_bootstrap_grants_executes_insert(mocker) -> None:
    session = AsyncMock()
    session.execute = AsyncMock()
    mocker.patch(
        "app.services.account_authorization.session_scope",
        return_value=mocker.AsyncMock(
            __aenter__=AsyncMock(return_value=session),
            __aexit__=AsyncMock(return_value=False),
        ),
    )
    await AccountAuthorizationService().apply_bootstrap_grants("parent-1", "edusernalonso@gmail.com")
    session.execute.assert_awaited_once()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_grant_group_by_email_false_when_missing(mocker) -> None:
    session = AsyncMock()
    session.execute = AsyncMock(return_value=mocker.Mock(scalar_one_or_none=mocker.Mock(return_value=None)))
    mocker.patch(
        "app.services.account_authorization.session_scope",
        return_value=mocker.AsyncMock(
            __aenter__=AsyncMock(return_value=session),
            __aexit__=AsyncMock(return_value=False),
        ),
    )
    assert await AccountAuthorizationService().grant_group_by_email("missing@example.com", "developers") is False
