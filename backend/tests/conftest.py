from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient
from pytest_mock import MockerFixture

from app.config import Settings, get_settings
from app.main import create_app
from app.services.auth import AuthClaims

pytest_plugins = ["tests.helpers.service_mocks"]


@pytest.fixture
def settings(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Settings:
    """Settings de test: sin migraciones, sin logs a disco, IA desactivada."""
    monkeypatch.setenv("RUN_MIGRATIONS_ON_STARTUP", "false")
    monkeypatch.setenv("LOG_TO_FILES", "false")
    monkeypatch.setenv("AI_ENABLED", "false")
    monkeypatch.setenv("APP_ENV", "local")
    monkeypatch.setenv("APP_DEBUG_AI", "false")
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path / "journey"))
    monkeypatch.setenv("GLOSSARY_DATA_DIR", str(tmp_path / "glossary"))
    monkeypatch.setenv("WAITING_DATA_DIR", str(tmp_path / "waiting"))
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path / "media"))
    get_settings.cache_clear()
    return get_settings()


@pytest.fixture
def app(settings: Settings):
    return create_app()


@pytest.fixture
async def client(app) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def auth_claims() -> AuthClaims:
    return {
        "sub": "00000000-0000-4000-8000-000000000099",
        "role": "authenticated",
        "email": "tutor@example.com",
        "display_name": "Tutor Test",
        "avatar_url": None,
    }


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test-token"}


@pytest.fixture
def mock_auth(mocker: MockerFixture, auth_claims: AuthClaims):
    return mocker.patch(
        "app.services.auth.SupabaseAuthService.validate_bearer",
        new_callable=AsyncMock,
        return_value=auth_claims,
    )
