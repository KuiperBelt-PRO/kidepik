from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.helpers.http import assert_status


@pytest.mark.contract
@pytest.mark.asyncio
async def test_client_logs_disabled_by_default(client: AsyncClient, monkeypatch) -> None:
    monkeypatch.setenv("LOG_CLIENT_INGEST", "false")
    from app.config import get_settings

    get_settings.cache_clear()
    body = assert_status(
        await client.post("/api/v1/client/logs", json={"events": []}),
        404,
    )
    assert "disabled" in body["detail"].lower()
    get_settings.cache_clear()


@pytest.mark.contract
@pytest.mark.asyncio
async def test_client_logs_requires_events_array(client: AsyncClient, monkeypatch) -> None:
    monkeypatch.setenv("LOG_CLIENT_INGEST", "true")
    from app.config import get_settings

    get_settings.cache_clear()
    body = assert_status(
        await client.post("/api/v1/client/logs", json={"events": "nope"}),
        422,
    )
    assert body["detail"] == "events array required"
    get_settings.cache_clear()


@pytest.mark.contract
@pytest.mark.asyncio
async def test_client_logs_accepts_events(client: AsyncClient, monkeypatch, mock_auth, auth_headers) -> None:
    monkeypatch.setenv("LOG_CLIENT_INGEST", "true")
    from app.config import get_settings

    get_settings.cache_clear()
    body = assert_status(
        await client.post(
            "/api/v1/client/logs",
            json={"events": [{"level": "info", "message": "click", "context": {"x": 1}}]},
            headers=auth_headers,
        ),
        200,
    )
    assert body["accepted"] == 1
    assert body["rejected"] == 0
    get_settings.cache_clear()


@pytest.mark.contract
@pytest.mark.asyncio
async def test_client_logs_rejects_invalid_events(
    client: AsyncClient, monkeypatch, mock_auth, auth_headers
) -> None:
    monkeypatch.setenv("LOG_CLIENT_INGEST", "true")
    from app.config import get_settings

    get_settings.cache_clear()
    body = assert_status(
        await client.post(
            "/api/v1/client/logs",
            json={
                "events": [
                    "bad",
                    {"level": "nope", "message": "x"},
                    {"level": "info", "message": ""},
                    {"level": "info", "message": "ok", "context": {"k": 1}},
                ]
            },
            headers=auth_headers,
        ),
        200,
    )
    assert body["accepted"] == 1
    assert body["rejected"] == 3
    get_settings.cache_clear()


@pytest.mark.contract
@pytest.mark.asyncio
async def test_client_logs_too_many_events(client: AsyncClient, monkeypatch) -> None:
    monkeypatch.setenv("LOG_CLIENT_INGEST", "true")
    from app.config import get_settings

    get_settings.cache_clear()
    body = assert_status(
        await client.post(
            "/api/v1/client/logs",
            json={"events": [{"level": "info", "message": "x"}] * 51},
        ),
        422,
    )
    assert body["detail"] == "too many events"
    get_settings.cache_clear()
