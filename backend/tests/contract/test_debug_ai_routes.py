from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from tests.helpers.http import assert_auth_error, assert_status


@pytest.fixture
def debug_ai_enabled(settings, monkeypatch):
    monkeypatch.setenv("APP_ENV", "local")
    monkeypatch.setenv("APP_DEBUG_AI", "true")
    from app.config import get_settings

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def mock_debug_ai_service(mocker, mock_session_scope):
    service = mocker.patch("app.routers.debug_ai.DebugAiService").return_value
    service.status = AsyncMock(return_value={"enabled": False, "provider": "gemini"})
    service.queues = AsyncMock(return_value=[{"purpose": "mentor_guide", "model": "gemini"}])
    service.resolve = AsyncMock(return_value={"purpose": "mentor_guide", "models": ["gemini"]})
    service.attempts = AsyncMock(return_value=[])
    service.ping = AsyncMock(return_value={"ok": True})
    mocker.patch(
        "app.routers.debug_ai.ParentAccountService"
    ).return_value.get_or_bootstrap = AsyncMock(return_value={"parent_id": "p1"})
    return service


@pytest.mark.contract
@pytest.mark.asyncio
async def test_debug_ai_hidden_when_disabled(client: AsyncClient) -> None:
    body = assert_status(await client.get("/api/v1/debug/ai/status"), 404)
    assert body["detail"] == "Not Found"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_debug_ai_status_requires_auth(client: AsyncClient, debug_ai_enabled) -> None:
    assert_auth_error(await client.get("/api/v1/debug/ai/status"))


@pytest.mark.contract
@pytest.mark.asyncio
async def test_debug_ai_status_ok(
    client: AsyncClient,
    debug_ai_enabled,
    mock_auth,
    auth_headers,
    mock_debug_ai_service,
) -> None:
    body = assert_status(
        await client.get("/api/v1/debug/ai/status", headers=auth_headers),
        200,
    )
    assert body["provider"] == "gemini"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_debug_ai_resolve_ok(
    client: AsyncClient,
    debug_ai_enabled,
    mock_auth,
    auth_headers,
    mock_debug_ai_service,
) -> None:
    body = assert_status(
        await client.get(
            "/api/v1/debug/ai/resolve",
            params={"purpose": "dialogue"},
            headers=auth_headers,
        ),
        200,
    )
    assert body["purpose"] == "mentor_guide"
