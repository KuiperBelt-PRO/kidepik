from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.helpers.http import assert_auth_error, assert_status


@pytest.mark.contract
@pytest.mark.asyncio
async def test_settings_show_requires_auth(client: AsyncClient) -> None:
    assert_auth_error(await client.get("/api/v1/parents/me/settings"))


@pytest.mark.contract
@pytest.mark.asyncio
async def test_settings_show_ok(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_settings_repo,
) -> None:
    body = assert_status(
        await client.get("/api/v1/parents/me/settings", headers=auth_headers),
        200,
    )
    assert body["settings"]["ui_theme"] == "fantasy"
    assert "crew_summary" in body


@pytest.mark.contract
@pytest.mark.asyncio
async def test_settings_patch_ok(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_settings_repo,
) -> None:
    body = assert_status(
        await client.patch(
            "/api/v1/parents/me/settings",
            json={"ui_theme": "sci-fi"},
            headers=auth_headers,
        ),
        200,
    )
    assert body["settings"]["ui_theme"] == "fantasy"
    mock_settings_repo.patch_for_auth_user.assert_awaited_once()


@pytest.mark.contract
@pytest.mark.asyncio
async def test_settings_patch_validation_error(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_settings_repo,
    mocker,
) -> None:
    mock_settings_repo.patch_for_auth_user = mocker.AsyncMock(
        side_effect=ValueError("ui_theme invalid")
    )
    body = assert_status(
        await client.patch(
            "/api/v1/parents/me/settings",
            json={"ui_theme": "invalid"},
            headers=auth_headers,
        ),
        422,
    )
    assert "ui_theme invalid" in body["detail"]


@pytest.mark.contract
@pytest.mark.asyncio
async def test_settings_show_requires_email(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mocker,
) -> None:
    mocker.patch(
        "app.services.auth.SupabaseAuthService.validate_bearer",
        new=mocker.AsyncMock(
            return_value={
                "sub": "00000000-0000-4000-8000-000000000099",
                "role": "authenticated",
                "email": None,
            }
        ),
    )
    body = assert_status(
        await client.get("/api/v1/parents/me/settings", headers=auth_headers),
        422,
    )
    assert body["detail"] == "Email required"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_settings_show_database_unavailable(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_settings_repo,
) -> None:
    mock_settings_repo.get_for_auth_user.side_effect = RuntimeError("Database unavailable")
    body = assert_status(
        await client.get("/api/v1/parents/me/settings", headers=auth_headers),
        503,
    )
    assert body["detail"] == "Database unavailable"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_settings_patch_parent_not_found(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_settings_repo,
) -> None:
    mock_settings_repo.patch_for_auth_user.side_effect = RuntimeError("Parent account not found")
    body = assert_status(
        await client.patch(
            "/api/v1/parents/me/settings",
            json={"ui_theme": "fantasy"},
            headers=auth_headers,
        ),
        404,
    )
    assert body["detail"] == "Parent account not found"
