from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient

from tests.helpers.factories import CHILD_ID, sample_crew_member
from tests.helpers.http import assert_auth_error, assert_status

DEBUG_CAPS_OFF = {
    "operator_eligible": False,
    "debug_enabled": False,
    "debug_allowed": False,
}


@pytest.fixture(autouse=True)
def mock_debug_capabilities_for_session_member(mocker) -> None:
    mocker.patch(
        "app.routers.session.debug_capabilities_for_claims",
        new=AsyncMock(return_value=dict(DEBUG_CAPS_OFF)),
    )
    mocker.patch(
        "app.routers.member.debug_capabilities_for_claims",
        new=AsyncMock(return_value=dict(DEBUG_CAPS_OFF)),
    )


@pytest.fixture
def mock_session_service(mocker) -> AsyncMock:
    crew_dto = {
        "role": "crew",
        "auth_user_id": "00000000-0000-4000-8000-000000000099",
        "email": "nina@gmail.com",
        "child_id": CHILD_ID,
        "parent_id": "11111111-1111-4111-8111-111111111111",
        "display_name": "Ada",
        "avatar_url": None,
        "provider": "google",
        "link_status": "linked",
        "created_link": False,
        "status": "active",
    }
    tutor_dto = {
        "role": "tutor",
        "parent_id": "11111111-1111-4111-8111-111111111111",
        "auth_user_id": "00000000-0000-4000-8000-000000000099",
        "email": "tutor@example.com",
        "display_name": "Tutor Test",
        "avatar_url": None,
        "provider": "google",
        "created": False,
    }

    def _install(path: str, role: str) -> AsyncMock:
        svc = mocker.patch(path).return_value
        dto = crew_dto if role == "crew" else tutor_dto
        svc.bootstrap = AsyncMock(return_value=dto)
        svc.me = AsyncMock(return_value=dto)
        svc.require_crew = AsyncMock(return_value=dict(crew_dto))
        svc.require_tutor = AsyncMock(return_value=dict(tutor_dto))
        return svc

    return _install


@pytest.mark.contract
@pytest.mark.asyncio
async def test_session_bootstrap_requires_auth(client: AsyncClient) -> None:
    assert_auth_error(await client.post("/api/v1/session/bootstrap"))


@pytest.mark.contract
@pytest.mark.asyncio
async def test_session_bootstrap_tutor(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
    mock_crew_service,
) -> None:
    body = assert_status(
        await client.post("/api/v1/session/bootstrap", headers=auth_headers),
        200,
    )
    assert body["role"] == "tutor"
    assert body["parent_id"]
    mock_parent_service.bootstrap.assert_awaited()


@pytest.mark.contract
@pytest.mark.asyncio
async def test_member_requires_auth(client: AsyncClient) -> None:
    assert_auth_error(await client.get("/api/v1/member"))


@pytest.mark.contract
@pytest.mark.asyncio
async def test_member_forbidden_for_tutor(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
) -> None:
    body = assert_status(await client.get("/api/v1/member", headers=auth_headers), 403)
    assert body["detail"] == "tutor_role"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_member_ok_for_crew(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
    mock_crew_service,
    mocker,
) -> None:
    mocker.patch(
        "app.routers.member.SessionAccountService"
    ).return_value.require_crew = AsyncMock(
        return_value={
            "role": "crew",
            "auth_user_id": "00000000-0000-4000-8000-000000000099",
            "child_id": CHILD_ID,
            "email": "nina@gmail.com",
        }
    )
    body = assert_status(await client.get("/api/v1/member", headers=auth_headers), 200)
    assert body["viewer"] == "self"
    assert body["id"] == CHILD_ID


@pytest.mark.contract
@pytest.mark.asyncio
async def test_member_patch_forbidden_field(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
    mock_crew_service,
    mocker,
) -> None:
    mocker.patch(
        "app.routers.member.SessionAccountService"
    ).return_value.require_crew = AsyncMock(
        return_value={
            "role": "crew",
            "auth_user_id": "00000000-0000-4000-8000-000000000099",
            "child_id": CHILD_ID,
            "email": "nina@gmail.com",
        }
    )
    mock_crew_service.update_self_profile = AsyncMock(side_effect=ValueError("field_forbidden"))
    body = assert_status(
        await client.patch(
            "/api/v1/member",
            json={"world_theme": "sci-fi"},
            headers=auth_headers,
        ),
        422,
    )
    assert body["detail"] == "field_forbidden"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_member_patch_ui_settings(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
    mock_crew_service,
    mocker,
) -> None:
    mocker.patch(
        "app.routers.member.SessionAccountService"
    ).return_value.require_crew = AsyncMock(
        return_value={
            "role": "crew",
            "auth_user_id": "00000000-0000-4000-8000-000000000099",
            "child_id": CHILD_ID,
            "email": "nina@gmail.com",
        }
    )
    updated = {
        **sample_crew_member(),
        "font_scale_play": "lg",
        "ui_preferences": {"ui_theme": "sci-fi", "reduce_motion": "always"},
        "viewer": "self",
    }
    mock_crew_service.update_self_profile = AsyncMock(return_value=sample_crew_member())
    mock_crew_service.to_self_view = MagicMock(return_value=updated)
    body = assert_status(
        await client.patch(
            "/api/v1/member",
            json={
                "font_scale_play": "lg",
                "ui_preferences": {"reduce_motion": "always"},
            },
            headers=auth_headers,
        ),
        200,
    )
    assert body["font_scale_play"] == "lg"
    assert body["ui_preferences"]["reduce_motion"] == "always"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_member_unlink_keeps_plaza(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
    mock_crew_service,
    mocker,
) -> None:
    mocker.patch(
        "app.routers.member.SessionAccountService"
    ).return_value.require_crew = AsyncMock(
        return_value={
            "role": "crew",
            "auth_user_id": "00000000-0000-4000-8000-000000000099",
            "child_id": CHILD_ID,
            "email": "nina@gmail.com",
        }
    )
    body = assert_status(
        await client.post("/api/v1/member/unlink", headers=auth_headers),
        200,
    )
    assert body["unlinked"] is True
    mock_crew_service.unlink_keep_invite.assert_awaited_once()


@pytest.mark.contract
@pytest.mark.asyncio
async def test_crew_list_forbidden_for_crew(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mocker,
) -> None:
    from app.services.session_accounts import CrewRoleError

    mocker.patch(
        "app.routers.crew.SessionAccountService"
    ).return_value.require_tutor = AsyncMock(side_effect=CrewRoleError())
    body = assert_status(await client.get("/api/v1/crew", headers=auth_headers), 403)
    assert body["detail"] == "crew_role"
