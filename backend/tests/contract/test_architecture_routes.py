from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from tests.helpers.http import assert_status


@pytest.mark.contract
@pytest.mark.asyncio
async def test_architecture_config_ok(client: AsyncClient) -> None:
    body = assert_status(await client.get("/api/v1/architecture/config"), 200)
    assert "api_url" in body
    assert "supabase_url" in body


@pytest.mark.contract
@pytest.mark.asyncio
async def test_architecture_status_ok(client: AsyncClient, mocker) -> None:
    mocker.patch(
        "app.routers.architecture.MigrationRunner.from_env"
    ).return_value.status = AsyncMock(
        return_value={"ok": True, "pending": [], "applied": ["001"]}
    )
    mocker.patch("app.routers.architecture.create_storage_driver").return_value.status.return_value = {
        "ok": True,
        "driver": "local",
    }
    mocker.patch("app.routers.architecture.get_engine", return_value=None)
    body = assert_status(await client.get("/api/v1/architecture/status"), 200)
    assert body["api"]["ok"] is True
    assert body["migrations"]["ok"] is True


@pytest.mark.contract
@pytest.mark.asyncio
async def test_migrations_status_ok(client: AsyncClient, mocker) -> None:
    mocker.patch(
        "app.routers.architecture.MigrationRunner.from_env"
    ).return_value.status = AsyncMock(return_value={"ok": True, "pending": [], "applied": []})
    body = assert_status(await client.get("/api/v1/migrations/status"), 200)
    assert body["ok"] is True
