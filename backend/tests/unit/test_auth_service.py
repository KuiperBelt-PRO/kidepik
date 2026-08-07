from __future__ import annotations

import httpx
import pytest
import respx

from app.config import Settings
from app.services.auth import AuthError, SupabaseAuthService


@pytest.mark.unit
@respx.mock
@pytest.mark.asyncio
async def test_validate_bearer_rejects_401() -> None:
    respx.get("http://test/auth/v1/user").mock(return_value=httpx.Response(401))
    svc = SupabaseAuthService(
        settings=Settings(supabase_url="http://test", supabase_anon_key="anon-key"),
    )
    with pytest.raises(AuthError, match="rejected"):
        await svc.validate_bearer("Bearer bad-token")
    await svc.aclose()


@pytest.mark.unit
@respx.mock
@pytest.mark.asyncio
async def test_validate_bearer_returns_claims() -> None:
    respx.get("http://test/auth/v1/user").mock(
        return_value=httpx.Response(
            200,
            json={
                "id": "00000000-0000-4000-8000-000000000099",
                "email": "tutor@example.com",
                "user_metadata": {"full_name": "Tutor Test"},
            },
        )
    )
    svc = SupabaseAuthService(
        settings=Settings(supabase_url="http://test", supabase_anon_key="anon-key"),
    )
    claims = await svc.validate_bearer("Bearer ok-token")
    assert claims["sub"] == "00000000-0000-4000-8000-000000000099"
    assert claims["email"] == "tutor@example.com"
    assert claims["display_name"] == "Tutor Test"
    await svc.aclose()
