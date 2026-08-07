from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from tests.helpers.http import assert_auth_error, assert_status


@dataclass
class FakePlan:
    upload_url: str = "/api/v1/storage/upload"
    method: str = "POST"
    fields: dict = None
    public_url: str = "/media/poc/u/file.png"
    token: str = "a" * 32
    expires_in: int = 900

    def __post_init__(self) -> None:
        if self.fields is None:
            self.fields = {"token": self.token}

    def to_dict(self) -> dict:
        return {
            "upload": {"url": self.upload_url, "method": self.method, "fields": self.fields},
            "public_url": self.public_url,
            "expires_in": self.expires_in,
            "token": self.token,
        }


@pytest.mark.contract
@pytest.mark.asyncio
async def test_storage_prepare_requires_auth(client: AsyncClient) -> None:
    assert_auth_error(
        await client.post("/api/v1/storage/prepare-upload", json={"filename": "x.png"})
    )


@pytest.mark.contract
@pytest.mark.asyncio
async def test_storage_prepare_requires_filename(
    client: AsyncClient,
    mock_auth,
    auth_headers,
) -> None:
    body = assert_status(
        await client.post("/api/v1/storage/prepare-upload", json={}, headers=auth_headers),
        422,
    )
    assert body["detail"] == "filename is required"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_storage_prepare_ok(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mocker,
) -> None:
    driver = mocker.patch("app.routers.storage.create_storage_driver").return_value
    driver.prepare_upload.return_value = FakePlan()
    body = assert_status(
        await client.post(
            "/api/v1/storage/prepare-upload",
            json={"filename": "avatar.png", "category": "avatars"},
            headers=auth_headers,
        ),
        200,
    )
    assert body["token"]
    assert body["public_url"].startswith("/media/")


@pytest.mark.contract
@pytest.mark.asyncio
async def test_storage_upload_requires_token(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/storage/upload",
        files={"file": ("x.png", b"x", "image/png")},
    )
    assert response.status_code == 422


@pytest.mark.contract
@pytest.mark.asyncio
async def test_storage_prepare_value_error(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mocker,
) -> None:
    driver = mocker.patch("app.routers.storage.create_storage_driver").return_value
    driver.prepare_upload.side_effect = ValueError("invalid extension")
    body = assert_status(
        await client.post(
            "/api/v1/storage/prepare-upload",
            json={"filename": "bad.exe"},
            headers=auth_headers,
        ),
        422,
    )
    assert "invalid extension" in body["detail"]


@pytest.mark.contract
@pytest.mark.asyncio
async def test_storage_prepare_internal_error(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mocker,
) -> None:
    driver = mocker.patch("app.routers.storage.create_storage_driver").return_value
    driver.prepare_upload.side_effect = RuntimeError("disk full")
    body = assert_status(
        await client.post(
            "/api/v1/storage/prepare-upload",
            json={"filename": "x.png"},
            headers=auth_headers,
        ),
        500,
    )
    assert "disk full" in body["detail"]


@pytest.mark.contract
@pytest.mark.asyncio
async def test_storage_upload_ok(client: AsyncClient, mocker) -> None:
    driver = mocker.patch("app.routers.storage.create_storage_driver").return_value
    driver.complete_upload.return_value = "/media/poc/u/file.png"
    body = assert_status(
        await client.post(
            "/api/v1/storage/upload",
            data={"token": "tok"},
            files={"file": ("avatar.png", b"png-bytes", "image/png")},
        ),
        200,
    )
    assert body["public_url"] == "/media/poc/u/file.png"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_storage_upload_value_error(client: AsyncClient, mocker) -> None:
    driver = mocker.patch("app.routers.storage.create_storage_driver").return_value
    driver.complete_upload.side_effect = ValueError("token expired")
    body = assert_status(
        await client.post(
            "/api/v1/storage/upload",
            data={"token": "bad"},
            files={"file": ("x.png", b"x", "image/png")},
        ),
        422,
    )
    assert "token expired" in body["detail"]
