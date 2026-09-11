from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query

from app.ai.errors import AiProductError
from app.catalogs.subject_catalog import SubjectCatalog
from app.db import session_scope
from app.services.auth import AuthError, SupabaseAuthService
from app.services.crew import CrewService
from app.services.debug_access import debug_attach_allowed_for_auth_user
from app.services.dialogue import DialogueService
from app.services.inventory import InventoryService
from app.services.journey_memory import JourneyMemoryService
from app.services.journey_timeline import JourneyTimelineService
from app.services.parents import ParentAccountService
from app.services.play_progress_hud import progress_hud_for_child
from app.services.session_accounts import CrewRoleError, SessionAccountService
from app.services.reward_economy import RewardEconomyService

router = APIRouter(tags=["play"])


async def _claims(authorization: str | None) -> dict[str, Any]:
    try:
        claims = await SupabaseAuthService().validate_bearer(authorization)
    except AuthError as exc:
        raise HTTPException(401, exc.message) from exc
    if not claims.get("email"):
        raise HTTPException(422, "Email required")
    try:
        session = await SessionAccountService(parents=ParentAccountService()).bootstrap(
            claims["sub"],
            claims["email"],
            claims.get("display_name"),
            claims.get("avatar_url"),
        )
        claims["session_role"] = session.get("role")
        claims["session_child_id"] = session.get("child_id")
        if session.get("role") == "tutor":
            await CrewService().ensure_tutor_profile_for_auth_user(claims["sub"])
    except CrewRoleError as exc:
        raise HTTPException(403, exc.detail) from exc
    except RuntimeError as exc:
        if str(exc) in {"DATABASE_URL not configured", "Database unavailable"}:
            raise HTTPException(503, str(exc)) from exc
        raise HTTPException(500, "Internal error") from exc
    return claims


def _translate(exc: Exception) -> HTTPException:
    if str(exc) in {"Crew member not found", "Dialogue session not found or closed"}:
        return HTTPException(404, str(exc))
    if str(exc) == "child_paused":
        return HTTPException(403, "child_paused")
    if isinstance(exc, ValueError):
        return HTTPException(422, str(exc))
    return HTTPException(500, "Internal error")


async def _child_member(auth_user_id: str, child_id: str, claims: dict[str, Any] | None = None) -> dict[str, Any]:
    if claims and claims.get("session_role") == "crew":
        if str(claims.get("session_child_id") or "") != str(child_id):
            raise HTTPException(403, "crew_child_mismatch")
    return await CrewService().get_accessible_for_auth_user(auth_user_id, child_id)


@router.post("/api/v1/play/{child_id}/dialogue/session")
async def open_session(
    child_id: str,
    payload: dict[str, Any] | None = None,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    claims = await _claims(authorization)
    try:
        async with session_scope() as session:
            result = await DialogueService(session).open_session(
                claims["sub"],
                child_id,
                str((payload or {}).get("flow_id") or "first_run"),
            )
        member = await _child_member(claims["sub"], child_id, claims)
        try:
            result["progress_hud"] = await progress_hud_for_child(member)
        except Exception:
            pass
        return result
    except AiProductError:
        raise
    except HTTPException:
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
    attach_debug = await debug_attach_allowed_for_auth_user(
        claims,
        header_debug=x_kidepik_debug_ai == "1",
    )
    try:
        async with session_scope() as session:
            result = await DialogueService(session).submit_turn(
                claims["sub"],
                child_id,
                session_id,
                reply,
                attach_debug,
                session_role=str(claims.get("session_role") or ""),
            )
        # Refresh HUD when placement/levels may have changed
        try:
            member = await _child_member(claims["sub"], child_id, claims)
            result["progress_hud"] = await progress_hud_for_child(member)
        except Exception:
            pass
        return result
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


@router.get("/api/v1/play/{child_id}/baggage")
async def play_baggage(
    child_id: str,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    claims = await _claims(authorization)
    try:
        member = await _child_member(claims["sub"], child_id, claims)
        theme = member.get("world_theme") or member.get("active_world_theme") or "fantasy"
        settings = member.get("settings") if isinstance(member.get("settings"), dict) else {}
        learning = settings.get("learning") if isinstance(settings.get("learning"), dict) else {}
        return await InventoryService().get_baggage(
            child_id,
            str(theme),
            active_subjects=SubjectCatalog.resolve_active_subjects(member),
            age_band=member.get("age_band") if isinstance(member.get("age_band"), str) else None,
            show_levels_to_child=bool(learning.get("show_levels_to_child")),
            audience="child",
        )
    except Exception as exc:
        raise _translate(exc) from exc


@router.get("/api/v1/play/{child_id}/progress")
async def play_progress(
    child_id: str,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    claims = await _claims(authorization)
    try:
        member = await _child_member(claims["sub"], child_id, claims)
        return await progress_hud_for_child(member)
    except Exception as exc:
        raise _translate(exc) from exc


@router.get("/api/v1/play/{child_id}/economy")
async def play_economy(
    child_id: str,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    claims = await _claims(authorization)
    try:
        member = await _child_member(claims["sub"], child_id, claims)
        theme = member.get("world_theme") or "fantasy"
        wallet = await RewardEconomyService().get_wallet(child_id, str(theme))
        return {
            "world_theme": wallet["world_theme"],
            "wallet": wallet,
            "pending_offer": None,
        }
    except Exception as exc:
        raise _translate(exc) from exc


@router.get("/api/v1/play/{child_id}/baggage/offers")
async def play_baggage_offers(
    child_id: str,
    session_id: str,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    claims = await _claims(authorization)
    if not session_id.strip():
        raise HTTPException(422, "session_id required")
    try:
        async with session_scope() as session:
            return await DialogueService(session).baggage_offers_for_session(
                claims["sub"],
                child_id,
                session_id.strip(),
            )
    except Exception as exc:
        raise _translate(exc) from exc


@router.post("/api/v1/play/{child_id}/baggage/{item_row_id}/use")
async def play_baggage_use(
    child_id: str,
    item_row_id: str,
    payload: dict[str, Any],
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    claims = await _claims(authorization)
    effect_id = str((payload or {}).get("effect_id") or "").strip()
    session_id = str((payload or {}).get("session_id") or "").strip()
    if not effect_id or not session_id:
        raise HTTPException(422, "effect_id and session_id required")
    try:
        async with session_scope() as session:
            return await DialogueService(session).use_baggage_item(
                claims["sub"],
                child_id,
                item_row_id,
                effect_id,
                session_id,
            )
    except Exception as exc:
        from app.services.baggage_use import UseItemError

        if isinstance(exc, UseItemError):
            raise HTTPException(exc.status, {"code": exc.code}) from exc
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
