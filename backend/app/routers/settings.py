from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Header, HTTPException

from app.services.auth import AuthError, SupabaseAuthService
from app.services.settings import ParentSettingsRepository

router = APIRouter(tags=["settings"])


async def _claims(authorization: str | None) -> dict[str, Any]:
    auth = SupabaseAuthService()
    try:
        return await auth.validate_bearer(authorization)
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=exc.message) from exc
    finally:
        await auth.aclose()


def _map_runtime(exc: RuntimeError) -> HTTPException:
    message = str(exc)
    if message in {"DATABASE_URL not configured", "Database unavailable"}:
        return HTTPException(status_code=503, detail=message)
    if message == "Parent account not found":
        return HTTPException(status_code=404, detail=message)
    return HTTPException(status_code=500, detail="Internal error")


@router.get("/api/v1/parents/me/settings")
async def show_settings(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    claims = await _claims(authorization)
    email = claims.get("email") or ""
    if not email:
        raise HTTPException(status_code=422, detail="Email required")
    try:
        return await ParentSettingsRepository().get_for_auth_user(
            claims["sub"],
            email,
            claims.get("display_name"),
            claims.get("avatar_url"),
        )
    except RuntimeError as exc:
        raise _map_runtime(exc) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal error") from exc


@router.patch("/api/v1/parents/me/settings")
async def patch_settings(
    body: dict[str, Any] = Body(default_factory=dict),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    claims = await _claims(authorization)
    email = claims.get("email") or ""
    if not email:
        raise HTTPException(status_code=422, detail="Email required")
    try:
        return await ParentSettingsRepository().patch_for_auth_user(
            claims["sub"],
            email,
            body,
            claims.get("display_name"),
            claims.get("avatar_url"),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise _map_runtime(exc) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal error") from exc
