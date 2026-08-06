from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query

from app.ai.errors import AiProductError
from app.db import session_scope
from app.services.auth import AuthError, SupabaseAuthService
from app.services.dialogue import DialogueService
from app.services.journey_memory import JourneyMemoryService
from app.services.journey_timeline import JourneyTimelineService
from app.services.parents import ParentAccountService

router = APIRouter(tags=["play"])


async def _claims(authorization: str | None) -> dict[str, Any]:
    try:
        claims = await SupabaseAuthService().validate_bearer(authorization)
    except AuthError as exc:
        raise HTTPException(401, exc.message) from exc
    if not claims.get("email"):
        raise HTTPException(422, "Email required")
    try:
        await ParentAccountService().get_or_bootstrap(
            claims["sub"],
            claims["email"],
            claims.get("display_name"),
            claims.get("avatar_url"),
        )
    except RuntimeError as exc:
        if str(exc) in {"DATABASE_URL not configured", "Database unavailable"}:
            raise HTTPException(503, str(exc)) from exc
        raise HTTPException(500, "Internal error") from exc
    return claims


def _translate(exc: Exception) -> HTTPException:
    if str(exc) in {"Crew member not found", "Dialogue session not found or closed"}:
        return HTTPException(404, str(exc))
    if isinstance(exc, ValueError):
        return HTTPException(422, str(exc))
    return HTTPException(500, "Internal error")


@router.post("/api/v1/play/{child_id}/dialogue/session")
async def open_session(
    child_id: str,
    payload: dict[str, Any] | None = None,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    claims = await _claims(authorization)
    try:
        async with session_scope() as session:
            return await DialogueService(session).open_session(
                claims["sub"],
                child_id,
                str((payload or {}).get("flow_id") or "first_run"),
            )
    except AiProductError:
        raise
    except Exception as exc:
        raise _translate(exc) from exc


@router.post("/api/v1/play/{child_id}/dialogue/turn")
async def submit_turn(
    child_id: str,
    payload: dict[str, Any],
    authorization: str | None = Header(default=None),
    x_kidepik_debug_ai: str | None = Header(default=None),
) -> dict[str, Any]:
    session_id, reply = payload.get("session_id"), payload.get("reply")
    if not isinstance(session_id, str) or not isinstance(reply, dict):
        raise HTTPException(422, "session_id and reply required")
    claims = await _claims(authorization)
    try:
        async with session_scope() as session:
            return await DialogueService(session).submit_turn(
                claims["sub"],
                child_id,
                session_id,
                reply,
                x_kidepik_debug_ai == "1",
            )
    except AiProductError:
        raise
    except Exception as exc:
        raise _translate(exc) from exc


@router.get("/api/v1/play/{child_id}/dialogue/history")
async def history(
    child_id: str,
    session_id: str = Query(),
    before_turn_id: str = Query(),
    limit: int | None = Query(default=None),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    claims = await _claims(authorization)
    try:
        async with session_scope() as session:
            return await DialogueService(session).load_history(
                claims["sub"], child_id, session_id, before_turn_id, limit
            )
    except AiProductError:
        raise
    except Exception as exc:
        raise _translate(exc) from exc


@router.get("/api/v1/play/{child_id}/journey/summary")
async def summary(
    child_id: str,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    claims = await _claims(authorization)
    try:
        async with session_scope() as session:
            await DialogueService(session)._child(claims["sub"], child_id)
            return {
                "child_id": child_id,
                "summary": await JourneyMemoryService(session).latest_summary_text(
                    child_id
                ),
                "kind": "condensed_full",
            }
    except AiProductError:
        raise
    except Exception as exc:
        raise _translate(exc) from exc


@router.get("/api/v1/play/{child_id}/journey/timeline")
async def timeline(
    child_id: str,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=30),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    claims = await _claims(authorization)
    try:
        async with session_scope() as session:
            await DialogueService(session)._child(claims["sub"], child_id)
            return {
                "child_id": child_id,
                **await JourneyTimelineService(session).page(child_id, cursor, limit),
            }
    except AiProductError:
        raise
    except Exception as exc:
        raise _translate(exc) from exc
