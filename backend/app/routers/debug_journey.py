from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.db import session_scope
from app.services.auth import AuthError, SupabaseAuthService
from app.services.debug_access import debug_capabilities_for_claims
from app.services.journey_rewind import JourneyRewindService

router = APIRouter(tags=["debug-journey"])


class RewindBody(BaseModel):
    child_id: str
    session_id: str
    turn_id: str = Field(min_length=1)


async def _auth(authorization: str | None) -> str:
    if not get_settings().ai_debug_enabled():
        raise HTTPException(404, "Not Found")
    try:
        claims = await SupabaseAuthService().validate_bearer(authorization)
    except AuthError as exc:
        raise HTTPException(401, exc.message) from exc
    if not claims.get("email"):
        raise HTTPException(422, "Email required")
    capabilities = await debug_capabilities_for_claims(claims)
    if not capabilities["debug_allowed"]:
        raise HTTPException(404, "Not Found")
    return str(claims["sub"])


@router.post("/api/v1/debug/journey/rewind")
async def rewind(
    payload: RewindBody,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    auth_user_id = await _auth(authorization)
    async with session_scope() as session:
        body, _report = await JourneyRewindService(session).rewind_to_turn(
            auth_user_id=auth_user_id,
            child_id=payload.child_id,
            session_id=payload.session_id,
            turn_id=payload.turn_id,
        )
        return body


@router.post("/api/v1/debug/journey/rewind/dry-run")
async def rewind_dry_run(
    payload: RewindBody,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    auth_user_id = await _auth(authorization)
    async with session_scope() as session:
        _body, report = await JourneyRewindService(session).rewind_to_turn(
            auth_user_id=auth_user_id,
            child_id=payload.child_id,
            session_id=payload.session_id,
            turn_id=payload.turn_id,
            dry_run=True,
        )
        return {"rewind": report.to_dict()}
