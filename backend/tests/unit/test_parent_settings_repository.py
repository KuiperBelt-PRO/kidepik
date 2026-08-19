from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.settings import ParentSettingsRepository, ParentSettingsService
from tests.helpers.db_session import FakeExecuteResult, ScriptedSession
from tests.helpers.factories import AUTH_USER_ID, PARENT_ID
from tests.helpers.session_scope import patch_session_scope


@pytest.fixture
def settings_repo(mocker):
    session = ScriptedSession([])
    patch_session_scope(mocker, session)
    parents = MagicMock()
    parents.get_or_bootstrap = AsyncMock(
        return_value={
            "parent_id": PARENT_ID,
            "auth_user_id": AUTH_USER_ID,
            "email": "tutor@example.com",
        }
    )
    authorization = MagicMock()
    authorization.has_permission = AsyncMock(return_value=False)
    authorization.list_groups = AsyncMock(return_value=[])
    authorization.list_permissions = AsyncMock(return_value=[])
    authorization.authorization_summary = AsyncMock(return_value={"groups": [], "permissions": []})
    return ParentSettingsRepository(parents=parents, authorization=authorization), session


@pytest.mark.unit
def test_merge_with_defaults() -> None:
    merged = ParentSettingsService.merge_with_defaults({"ui_theme": "sci-fi"})
    assert merged["ui_theme"] == "sci-fi"
    assert merged["schema_version"] == 1


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_merged_settings_for_parent(settings_repo) -> None:
    repo, session = settings_repo
    session._results = [FakeExecuteResult(scalar={"ui_theme": "sci-fi"})]
    settings = await repo.get_merged_settings_for_parent_id(PARENT_ID)
    assert settings["ui_theme"] == "sci-fi"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_for_auth_user(settings_repo) -> None:
    repo, session = settings_repo
    session._results = [FakeExecuteResult(scalar=None), FakeExecuteResult(scalar=2)]
    body = await repo.get_for_auth_user(AUTH_USER_ID, "tutor@example.com")
    assert body["crew_summary"]["member_count"] == 2
    assert body["settings"]["ui_theme"] == "fantasy"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_patch_for_auth_user(settings_repo) -> None:
    repo, session = settings_repo
    session._results = [
        FakeExecuteResult(scalar=None),
        FakeExecuteResult(rowcount=1),
        FakeExecuteResult(scalar=1),
    ]
    body = await repo.patch_for_auth_user(
        AUTH_USER_ID,
        "tutor@example.com",
        {"ui_theme": "sci-fi"},
    )
    assert body["settings"]["ui_theme"] == "sci-fi"
