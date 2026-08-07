from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.services.parents import ParentAccountService
from tests.helpers.db_session import FakeExecuteResult, ScriptedSession
from tests.helpers.factories import AUTH_USER_ID, PARENT_ID
from tests.helpers.session_scope import patch_session_scope


@pytest.fixture
def parents_svc(mocker):
    session = ScriptedSession([])
    patch_session_scope(mocker, session)
    return ParentAccountService(), session


@pytest.mark.unit
@pytest.mark.parametrize(
    "value,expected",
    [
        (None, None),
        ("  Ana  ", "Ana"),
        ("", None),
    ],
    ids=["none", "trim", "empty"],
)
def test_normalize_display_name_ok(value: object, expected: str | None) -> None:
    assert ParentAccountService.normalize_display_name(value) == expected


@pytest.mark.unit
@pytest.mark.parametrize(
    "value,message",
    [
        (123, "display_name must be a string"),
        ("x" * 41, "display_name too long"),
        ("bad@name", "display_name invalid characters"),
    ],
)
def test_normalize_display_name_errors(value: object, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        ParentAccountService.normalize_display_name(value)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_find_by_auth_user_id_found(parents_svc) -> None:
    service, session = parents_svc
    session._results = [
        FakeExecuteResult(
            rows={
                "id": PARENT_ID,
                "auth_user_id": AUTH_USER_ID,
                "email": "tutor@example.com",
                "display_name": "Tutor",
                "avatar_url": None,
            }
        )
    ]
    account = await service.find_by_auth_user_id(AUTH_USER_ID)
    assert account["parent_id"] == PARENT_ID
    assert account["provider"] == "google"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_find_by_auth_user_id_missing(parents_svc) -> None:
    service, session = parents_svc
    session._results = [FakeExecuteResult(rows=None)]
    assert await service.find_by_auth_user_id(AUTH_USER_ID) is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_bootstrap_returns_existing(parents_svc, mocker) -> None:
    service, _session = parents_svc
    mocker.patch.object(
        service,
        "find_by_auth_user_id",
        new=AsyncMock(
            return_value={
                "parent_id": PARENT_ID,
                "auth_user_id": AUTH_USER_ID,
                "email": "tutor@example.com",
            }
        ),
    )
    result = await service.bootstrap(AUTH_USER_ID, "tutor@example.com")
    assert result["created"] is False
    assert result["parent_id"] == PARENT_ID


@pytest.mark.unit
@pytest.mark.asyncio
async def test_bootstrap_inserts_new(parents_svc, mocker) -> None:
    service, session = parents_svc
    mocker.patch.object(service, "find_by_auth_user_id", new=AsyncMock(side_effect=[None, None]))
    session._results = [FakeExecuteResult(rows={"id": PARENT_ID})]
    result = await service.bootstrap(AUTH_USER_ID, "tutor@example.com", display_name="Tutor")
    assert result["created"] is True
    assert result["parent_id"] == PARENT_ID


@pytest.mark.unit
@pytest.mark.asyncio
async def test_bootstrap_conflict_falls_back(parents_svc, mocker) -> None:
    service, session = parents_svc
    existing = {
        "parent_id": PARENT_ID,
        "auth_user_id": AUTH_USER_ID,
        "email": "tutor@example.com",
    }
    mocker.patch.object(service, "find_by_auth_user_id", new=AsyncMock(side_effect=[None, existing]))
    session._results = [FakeExecuteResult(rows=None)]
    result = await service.bootstrap(AUTH_USER_ID, "tutor@example.com")
    assert result["created"] is False


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_or_bootstrap(parents_svc, mocker) -> None:
    service, _session = parents_svc
    account = {
        "parent_id": PARENT_ID,
        "auth_user_id": AUTH_USER_ID,
        "email": "tutor@example.com",
        "display_name": "Tutor",
    }
    mocker.patch.object(service, "bootstrap", new=AsyncMock(return_value={"created": True}))
    mocker.patch.object(service, "find_by_auth_user_id", new=AsyncMock(return_value=account))
    loaded = await service.get_or_bootstrap(AUTH_USER_ID, "tutor@example.com")
    assert loaded["parent_id"] == PARENT_ID


@pytest.mark.unit
@pytest.mark.asyncio
async def test_update_display_name(parents_svc, mocker) -> None:
    service, session = parents_svc
    session._results = [FakeExecuteResult(rowcount=1)]
    mocker.patch.object(
        service,
        "find_by_auth_user_id",
        new=AsyncMock(
            return_value={
                "parent_id": PARENT_ID,
                "auth_user_id": AUTH_USER_ID,
                "email": "tutor@example.com",
                "display_name": "Nuevo",
            }
        ),
    )
    account = await service.update_display_name(AUTH_USER_ID, "Nuevo")
    assert account["display_name"] == "Nuevo"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_update_display_name_not_found(parents_svc) -> None:
    service, session = parents_svc
    session._results = [FakeExecuteResult(rowcount=0)]
    with pytest.raises(RuntimeError, match="Parent account not found"):
        await service.update_display_name(AUTH_USER_ID, "Nuevo")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_bootstrap_raises_when_unavailable(parents_svc, mocker) -> None:
    service, session = parents_svc
    mocker.patch.object(service, "find_by_auth_user_id", new=AsyncMock(side_effect=[None, None]))
    session._results = [FakeExecuteResult(rows=None)]
    with pytest.raises(RuntimeError, match="Failed to bootstrap parent account"):
        await service.bootstrap(AUTH_USER_ID, "tutor@example.com")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_delete_account(parents_svc) -> None:
    service, session = parents_svc
    session._results = [FakeExecuteResult(), FakeExecuteResult()]
    assert await service.delete_account(AUTH_USER_ID) is True
    assert len(session.executed) == 2
