from __future__ import annotations

import os

import httpx
import pytest


@pytest.mark.integration
@pytest.mark.asyncio
async def test_live_health_endpoint() -> None:
    if os.getenv("KIDEPIK_INTEGRATION_TESTS", "").lower() not in {"1", "true", "yes"}:
        pytest.skip("Set KIDEPIK_INTEGRATION_TESTS=1 to run live stack checks")
    base_url = os.getenv("KIDEPIK_TEST_BASE_URL", "http://localhost:8082")
    async with httpx.AsyncClient(base_url=base_url, timeout=10.0) as client:
        response = await client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
