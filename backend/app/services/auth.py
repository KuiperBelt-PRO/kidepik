from __future__ import annotations

from typing import Any, TypedDict

import httpx

from app.config import Settings, get_settings


class AuthClaims(TypedDict):
    sub: str
    role: str
    email: str | None
    display_name: str | None
    avatar_url: str | None


class AuthError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class SupabaseAuthService:
    def __init__(
        self,
        settings: Settings | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self._client = client
        self._owns_client = client is None

    async def _http(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=5.0)
        return self._client

    async def aclose(self) -> None:
        if self._owns_client and self._client is not None:
            await self._client.aclose()
            self._client = None

    async def validate_bearer(self, authorization: str | None) -> AuthClaims:
        if authorization is None or not authorization.lower().startswith("bearer "):
            raise AuthError("Missing Bearer token")
        token = authorization[7:].strip()
        if not token:
            raise AuthError("Missing Bearer token")

        client = await self._http()
        try:
            response = await client.get(
                f"{self.settings.supabase_base}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": self.settings.supabase_anon_key,
                },
            )
        except httpx.HTTPError as exc:
            raise AuthError("Invalid token: Supabase auth unreachable") from exc

        if response.status_code in {401, 403}:
            raise AuthError("Invalid token: Supabase auth rejected")
        if response.status_code != 200:
            raise AuthError("Invalid token: Supabase auth unreachable")

        user: dict[str, Any] = response.json()
        user_id = user.get("id")
        if not isinstance(user_id, str) or not user_id:
            raise AuthError("Invalid token: missing user id")

        return {
            "sub": user_id,
            "role": "authenticated",
            "email": self._extract_email(user),
            "display_name": self._extract_display_name(user),
            "avatar_url": self._extract_avatar_url(user),
        }

    @staticmethod
    def _extract_email(user: dict[str, Any]) -> str | None:
        direct = user.get("email")
        if isinstance(direct, str) and direct.strip():
            return direct.strip()
        meta = user.get("user_metadata")
        if isinstance(meta, dict):
            for key in ("email", "email_address"):
                value = meta.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
        return None

    @staticmethod
    def _extract_display_name(user: dict[str, Any]) -> str | None:
        meta = user.get("user_metadata")
        if not isinstance(meta, dict):
            return None
        for key in ("full_name", "name"):
            value = meta.get(key)
            if isinstance(value, str) and value:
                return value
        return None

    @staticmethod
    def _extract_avatar_url(user: dict[str, Any]) -> str | None:
        meta = user.get("user_metadata")
        if not isinstance(meta, dict):
            return None
        for key in ("avatar_url", "picture"):
            value = meta.get(key)
            if isinstance(value, str) and value:
                return value
        return None
