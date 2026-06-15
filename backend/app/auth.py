"""Supabase JWT validation."""

from typing import Any

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

_bearer = HTTPBearer(auto_error=False)


def _claims_from_hs256(token: str) -> dict[str, Any]:
    """Fallback for unit tests when Supabase Auth is unreachable."""
    payload = jwt.decode(
        token,
        settings.supabase_jwt_secret,
        algorithms=["HS256"],
        options={"verify_aud": False},
    )
    if payload.get("role") != "authenticated":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token must belong to an authenticated user",
        )
    return payload


def _claims_from_supabase_auth(token: str) -> dict[str, Any]:
    """Validate access token via Supabase Auth (works with ES256/HS256 signing)."""
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/user"
    headers = {
        "Authorization": f"Bearer {token}",
        "apikey": settings.supabase_anon_key,
    }
    with httpx.Client(timeout=5.0) as client:
        response = client.get(url, headers=headers)

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: Supabase auth rejected",
        )

    user = response.json()
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing user id",
        )

    return {"sub": str(user_id), "role": "authenticated", "email": user.get("email")}


def verify_supabase_jwt(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict[str, Any]:
    """Validate Bearer JWT issued by Supabase Auth."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer token",
        )

    token = credentials.credentials
    try:
        return _claims_from_supabase_auth(token)
    except httpx.HTTPError:
        # Offline pytest without Supabase running.
        try:
            return _claims_from_hs256(token)
        except jwt.PyJWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {exc}",
            ) from exc
