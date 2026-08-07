from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any
from unittest.mock import AsyncMock

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
    "app.routers.debug_ai.ParentAccountService",
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
    services = []
    for path in _PARENT_PATHS:
        services.append(_configure_parent_service(mocker.patch(path).return_value))
    return services[0]


@pytest.fixture
def mock_crew_service(mocker: MockerFixture) -> Any:
    ensure_tutor = AsyncMock(return_value=None)
    services = []
    for path in ("app.routers.crew.CrewService", "app.routers.parents.CrewService"):
        service = mocker.patch(path).return_value
        service.ensure_tutor_profile_for_auth_user = ensure_tutor
        services.append(service)
    crew = services[0]
    crew.list_for_auth_user = AsyncMock(return_value=sample_crew_list())
    crew.create_for_auth_user = AsyncMock(return_value=sample_crew_member())
    crew.get_for_auth_user = AsyncMock(return_value=sample_crew_member())
    crew.update_profile_for_auth_user = AsyncMock(return_value=sample_crew_member())
    crew.update_permissions_for_auth_user = AsyncMock(
        return_value={**sample_crew_member(), "permissions": {"require_exit_pin": True}}
    )
    crew.soft_delete_for_auth_user = AsyncMock(return_value={"deleted": True})
    crew.verify_exit_pin_for_auth_user = AsyncMock(return_value={"ok": True})
    crew._ensure_tutor = ensure_tutor
    return crew


@pytest.fixture
def mock_settings_repo(mocker: MockerFixture) -> Any:
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
    ):
        mocker.patch(path, _scope)
    return session
