from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.helpers.http import assert_auth_error, assert_status


@pytest.mark.contract
@pytest.mark.asyncio
async def test_health_ok(client: AsyncClient) -> None:
    body = assert_status(await client.get("/api/v1/health"), 200)
    assert body["status"] == "ok"
    assert "service" in body


@pytest.mark.contract
@pytest.mark.asyncio
async def test_crew_list_requires_auth(client: AsyncClient) -> None:
    assert_auth_error(await client.get("/api/v1/crew"))
