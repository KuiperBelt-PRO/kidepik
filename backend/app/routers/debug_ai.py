from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query

from app.config import get_settings
from app.db import session_scope
from app.services.auth import AuthError, SupabaseAuthService
from app.services.debug_access import debug_capabilities_for_auth_user
from app.services.debug_ai import DEFAULT_PURPOSE, DebugAiService
from app.services.parents import ParentAccountService
from app.services.settings import ParentSettingsRepository

router = APIRouter(tags=["debug-ai"])


async def _auth(authorization: str | None, *, require_active: bool = False) -> dict[str, Any]:
    if not get_settings().ai_debug_enabled():
        raise HTTPException(404, "Not Found")
    try:
        claims = await SupabaseAuthService().validate_bearer(authorization)
    except AuthError as exc:
        raise HTTPException(401, exc.message) from exc
    email = claims.get("email")
    if not email:
        raise HTTPException(422, "Email required")
    await ParentAccountService().get_or_bootstrap(
        claims["sub"],
        email,
        claims.get("display_name"),
        claims.get("avatar_url"),
    )
    capabilities = await debug_capabilities_for_auth_user(claims)
    if not capabilities["operator_eligible"]:
        raise HTTPException(404, "Not Found")
    if require_active and not capabilities["debug_allowed"]:
        raise HTTPException(404, "Not Found")
    return claims


@router.get("/api/v1/debug/ai/status")
async def status(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    claims = await _auth(authorization)
    settings_repo = ParentSettingsRepository()
    account = await settings_repo.parents.get_or_bootstrap(
        claims["sub"],
        str(claims["email"]),
        claims.get("display_name"),
        claims.get("avatar_url"),
    )
    parent_settings = await settings_repo.get_merged_settings_for_parent_id(account["parent_id"])
    async with session_scope() as s:
        return await DebugAiService(s).status(account["parent_id"], parent_settings)


@router.get("/api/v1/debug/ai/queues")
async def queues(
    purpose: str | None = Query(default=None),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    await _auth(authorization, require_active=True)
    async with session_scope() as s:
        return {"rows": await DebugAiService(s).queues(purpose), "provider": "gemini"}


@router.get("/api/v1/debug/ai/resolve")
async def resolve(
    purpose: str = Query(default=DEFAULT_PURPOSE),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    await _auth(authorization, require_active=True)
    async with session_scope() as s:
        return await DebugAiService(s).resolve(purpose)


@router.get("/api/v1/debug/ai/attempts")
async def attempts(
    limit: int = Query(default=20),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    await _auth(authorization, require_active=True)
    async with session_scope() as s:
        return {"attempts": await DebugAiService(s).attempts(limit), "provider": "gemini"}


@router.post("/api/v1/debug/ai/ping")
async def ping(
    payload: dict[str, Any] | None = None,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    await _auth(authorization, require_active=True)
    async with session_scope() as s:
        return await DebugAiService(s).ping((payload or {}).get("child_id"))
