from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.helpers.factories import CHILD_ID
from tests.helpers.http import assert_auth_error, assert_status


@pytest.mark.contract
@pytest.mark.asyncio
async def test_parents_bootstrap_requires_auth(client: AsyncClient) -> None:
    assert_auth_error(await client.post("/api/v1/parents/bootstrap"))


@pytest.mark.contract
@pytest.mark.asyncio
async def test_parents_bootstrap_ok(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
    mock_crew_service,
) -> None:
    body = assert_status(
        await client.post("/api/v1/parents/bootstrap", headers=auth_headers),
        200,
    )
    assert body["parent_id"]
    assert body["created"] is True
    mock_parent_service.bootstrap.assert_awaited_once()
    mock_crew_service._ensure_tutor.assert_awaited_once()


@pytest.mark.contract
@pytest.mark.asyncio
async def test_parents_me_ok(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
) -> None:
    body = assert_status(await client.get("/api/v1/parents/me", headers=auth_headers), 200)
    assert body["email"] == "tutor@example.com"
    mock_parent_service.get_or_bootstrap.assert_awaited_once()


@pytest.mark.contract
@pytest.mark.asyncio
async def test_parents_me_requires_email(
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
                "display_name": None,
                "avatar_url": None,
            }
        ),
    )
    body = assert_status(await client.get("/api/v1/parents/me", headers=auth_headers), 422)
    assert body["detail"] == "Email required"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_parents_patch_me_requires_display_name(
    client: AsyncClient,
    mock_auth,
    auth_headers,
) -> None:
    body = assert_status(
        await client.patch("/api/v1/parents/me", json={}, headers=auth_headers),
        422,
    )
    assert body["detail"] == "display_name required"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_parents_patch_me_ok(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
) -> None:
    body = assert_status(
        await client.patch(
            "/api/v1/parents/me",
            json={"display_name": "Nuevo nombre"},
            headers=auth_headers,
        ),
        200,
    )
    assert body["display_name"] == "Nuevo nombre"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_parents_delete_me_ok(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
) -> None:
    body = assert_status(await client.delete("/api/v1/parents/me", headers=auth_headers), 200)
    assert body["deleted"] is True
    mock_parent_service.delete_account.assert_awaited_once()


@pytest.mark.contract
@pytest.mark.asyncio
async def test_parents_bootstrap_requires_email(
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
        await client.post("/api/v1/parents/bootstrap", headers=auth_headers),
        422,
    )
    assert body["detail"] == "Email required"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_parents_bootstrap_database_unavailable(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
) -> None:
    mock_parent_service.bootstrap.side_effect = RuntimeError("Database unavailable")
    body = assert_status(
        await client.post("/api/v1/parents/bootstrap", headers=auth_headers),
        503,
    )
    assert body["detail"] == "Database unavailable"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_parents_patch_validation_error(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
) -> None:
    mock_parent_service.update_display_name.side_effect = ValueError("display_name invalid")
    body = assert_status(
        await client.patch(
            "/api/v1/parents/me",
            json={"display_name": "x"},
            headers=auth_headers,
        ),
        422,
    )
    assert "display_name invalid" in body["detail"]


@pytest.mark.contract
@pytest.mark.asyncio
async def test_parents_delete_database_unavailable(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
) -> None:
    mock_parent_service.delete_account.side_effect = RuntimeError("Database unavailable")
    body = assert_status(
        await client.delete("/api/v1/parents/me", headers=auth_headers),
        503,
    )
    assert body["detail"] == "Database unavailable"
