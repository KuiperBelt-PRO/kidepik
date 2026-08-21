from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from pytest_mock import MockerFixture

from tests.helpers.factories import (
    sample_bootstrap_result,
    sample_crew_list,
    sample_crew_member,
    sample_parent_account,
    sample_settings_payload,
)

_PARENT_PATHS = (
    "app.routers.parents.ParentAccountService",
    "app.routers.crew.ParentAccountService",
    "app.routers.play.ParentAccountService",
    "app.routers.settings.ParentAccountService",
    "app.routers.session.ParentAccountService",
    "app.routers.member.ParentAccountService",
)


def _configure_parent_service(service: Any) -> Any:
    service.get_or_bootstrap = AsyncMock(return_value=sample_parent_account())
    service.bootstrap = AsyncMock(return_value=sample_bootstrap_result(created=True))
    service.update_display_name = AsyncMock(
        return_value={**sample_parent_account(), "display_name": "Nuevo nombre"}
    )
    service.delete_account = AsyncMock(return_value=None)
    service.find_by_auth_user_id = AsyncMock(return_value=sample_parent_account())
    return service


@pytest.fixture
def mock_parent_service(mocker: MockerFixture) -> Any:
    shared = _configure_parent_service(MagicMock())
    for path in _PARENT_PATHS:
        mocker.patch(path, return_value=shared)
    return shared


@pytest.fixture
def mock_crew_service(mocker: MockerFixture) -> Any:
    ensure_tutor = AsyncMock(return_value=None)
    crew = MagicMock()
    crew.ensure_tutor_profile_for_auth_user = ensure_tutor
    crew.list_for_auth_user = AsyncMock(return_value=sample_crew_list())
    crew.create_for_auth_user = AsyncMock(return_value=sample_crew_member())
    crew.get_for_auth_user = AsyncMock(return_value=sample_crew_member())
    crew.update_profile_for_auth_user = AsyncMock(return_value=sample_crew_member())
    crew.update_permissions_for_auth_user = AsyncMock(
        return_value={**sample_crew_member(), "permissions": {"require_exit_pin": True}}
    )
    crew.soft_delete_for_auth_user = AsyncMock(return_value={"deleted": True})
    crew.verify_exit_pin_for_auth_user = AsyncMock(return_value={"ok": True})
    crew.get_for_linked_crew = AsyncMock(return_value=sample_crew_member())
    crew.get_accessible_for_auth_user = AsyncMock(return_value=sample_crew_member())
    crew.update_self_profile = AsyncMock(return_value=sample_crew_member())
    crew.unlink_keep_invite = AsyncMock(return_value=True)
    crew.to_self_view = lambda detail: {**detail, "viewer": "self"}
    crew._ensure_tutor = ensure_tutor
    for path in (
        "app.routers.crew.CrewService",
        "app.routers.parents.CrewService",
        "app.routers.play.CrewService",
        "app.routers.session.CrewService",
        "app.routers.member.CrewService",
    ):
        mocker.patch(path, return_value=crew)
    return crew


@pytest.fixture
def mock_settings_repo(mocker: MockerFixture, mock_parent_service) -> Any:
    repo = mocker.patch("app.routers.settings.ParentSettingsRepository").return_value
    repo.get_for_auth_user = AsyncMock(return_value=sample_settings_payload())
    repo.patch_for_auth_user = AsyncMock(return_value=sample_settings_payload())
    return repo


@pytest.fixture
def mock_session_scope(mocker: MockerFixture) -> AsyncMock:
    session = mocker.AsyncMock()

    @asynccontextmanager
    async def _scope():
        yield session

    for path in (
        "app.routers.play.session_scope",
        "app.routers.debug_ai.session_scope",
        "app.routers.debug_journey.session_scope",
    ):
        mocker.patch(path, _scope)
    return session
