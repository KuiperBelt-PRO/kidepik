from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.helpers.http import assert_status


@pytest.mark.contract
@pytest.mark.asyncio
async def test_legal_unknown_slug(client: AsyncClient) -> None:
    body = assert_status(await client.get("/api/v1/legal/unknown"), 404)
    assert body["detail"] == "Legal document not found"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_legal_alias_terms(client: AsyncClient, mocker) -> None:
    mocker.patch("app.routers.legal.get_engine", return_value=None)
    body = assert_status(await client.get("/api/v1/legal/terminos"), 503)
    assert body["detail"] == "Database unavailable"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_legal_document_ok(client: AsyncClient, mocker) -> None:
    class FakeResult:
        def mappings(self):
            return self

        def first(self):
            return {
                "slug": "terms",
                "version": 2,
                "title": "Términos",
                "body_markdown": "# Términos",
                "published_at": "2026-01-01T00:00:00Z",
            }

    class FakeConn:
        async def execute(self, *_args, **_kwargs):
            return FakeResult()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

    class FakeEngine:
        def connect(self):
            return FakeConn()

    mocker.patch("app.routers.legal.get_engine", return_value=FakeEngine())
    body = assert_status(await client.get("/api/v1/legal/privacy"), 200)
    assert body["slug"] == "terms"
    assert body["version"] == 2


@pytest.mark.contract
@pytest.mark.asyncio
async def test_legal_document_missing_row(client: AsyncClient, mocker) -> None:
    class FakeResult:
        def mappings(self):
            return self

        def first(self):
            return None

    class FakeConn:
        async def execute(self, *_args, **_kwargs):
            return FakeResult()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

    class FakeEngine:
        def connect(self):
            return FakeConn()

    mocker.patch("app.routers.legal.get_engine", return_value=FakeEngine())
    body = assert_status(await client.get("/api/v1/legal/terms"), 404)
    assert body["detail"] == "Legal document not found"
