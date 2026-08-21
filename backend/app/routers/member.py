from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException

from app.catalogs.subject_catalog import SubjectCatalog
from app.routers.parents import _claims, _email, _error, _map_runtime
from app.services.crew import CrewService
from app.services.inventory import InventoryService
from app.services.parents import ParentAccountService
from app.services.debug_access import debug_capabilities_for_claims
from app.services.session_accounts import CrewRoleError, SessionAccountService

router = APIRouter(prefix="/api/v1", tags=["member"])


async def _crew_session(authorization: str | None) -> dict[str, Any]:
    claims = await _claims(authorization)
    try:
        session = await SessionAccountService(parents=ParentAccountService()).require_crew(claims["sub"], _email(claims))
        session["auth_user_id"] = claims["sub"]
        return session
    except CrewRoleError as exc:
        raise HTTPException(status_code=403, detail=exc.detail) from exc
    except RuntimeError as exc:
        raise _map_runtime(exc) from exc
    except Exception as exc:
        raise _error(exc) from exc


@router.get("/member")
async def show(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    claims = await _claims(authorization)
    session = await _crew_session(authorization)
    try:
        crew = CrewService()
        detail = await crew.get_for_linked_crew(session["auth_user_id"], session["child_id"])
        view = crew.to_self_view(detail)
        view["debug_capabilities"] = await debug_capabilities_for_claims(claims)
        return view
    except RuntimeError as exc:
        if str(exc) == "Crew member not found":
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        raise _map_runtime(exc) from exc
    except Exception as exc:
        raise _error(exc) from exc


@router.patch("/member")
async def update(
    payload: dict[str, Any] | None = None,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    session = await _crew_session(authorization)
    claims = await _claims(authorization)
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="Body required")
    try:
        crew = CrewService()
        detail = await crew.update_self_profile(
            session["auth_user_id"],
            session["child_id"],
            payload,
            email=_email(claims),
        )
        view = crew.to_self_view(detail)
        view["debug_capabilities"] = await debug_capabilities_for_claims(claims)
        return view
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        if str(exc) == "Crew member not found":
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        raise _map_runtime(exc) from exc
    except Exception as exc:
        raise _error(exc) from exc


@router.post("/member/unlink")
async def unlink(authorization: str | None = Header(default=None)) -> dict[str, bool]:
    session = await _crew_session(authorization)
    try:
        await CrewService().unlink_keep_invite(session["auth_user_id"])
        return {"unlinked": True}
    except Exception as exc:
        raise _error(exc) from exc


@router.get("/member/baggage")
async def baggage(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    session = await _crew_session(authorization)
    try:
        crew = CrewService()
        member = await crew.get_for_linked_crew(session["auth_user_id"], session["child_id"])
        theme = member.get("world_theme") or "fantasy"
        settings = member.get("settings") if isinstance(member.get("settings"), dict) else {}
        learning = settings.get("learning") if isinstance(settings.get("learning"), dict) else {}
        return await InventoryService().get_baggage(
            session["child_id"],
            str(theme),
            active_subjects=SubjectCatalog.resolve_active_subjects(member),
            age_band=member.get("age_band") if isinstance(member.get("age_band"), str) else None,
            show_levels_to_child=bool(learning.get("show_levels_to_child")),
            audience="child",
        )
    except Exception as exc:
        raise _error(exc) from exc
