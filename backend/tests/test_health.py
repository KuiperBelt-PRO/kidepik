"""Tests for KidepiK API POC."""

import jwt
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app


def _make_token(sub: str = "test-user-123") -> str:
    return jwt.encode(
        {
            "sub": sub,
            "aud": settings.supabase_jwt_audience,
            "role": "authenticated",
        },
        settings.supabase_jwt_secret,
        algorithm="HS256",
    )


async def test_health_returns_ok():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_architecture_config():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/architecture/config")

    assert response.status_code == 200
    body = response.json()
    assert "api_url" in body
    assert "supabase_url" in body


async def test_presign_requires_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/storage/presign-upload",
            json={"filename": "test.txt"},
        )

    assert response.status_code == 401
