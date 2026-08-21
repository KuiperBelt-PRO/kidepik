from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query, status

from app.catalogs.subject_catalog import SubjectCatalog
from app.routers.parents import _claims, _email, _error
from app.services.crew import CrewService
from app.services.inventory import InventoryService
from app.services.parents import ParentAccountService
from app.services.reward_economy import RewardEconomyService
from app.services.session_accounts import CrewRoleError, SessionAccountService

router = APIRouter(prefix="/api/v1", tags=["crew"])

async def _parent(authorization: str | None) -> str:
    claims = await _claims(authorization)
    try:
        parents = ParentAccountService()
        await SessionAccountService(parents=parents).require_tutor(
            claims["sub"], _email(claims), claims.get("display_name"), claims.get("avatar_url")
        )
        return str(claims["sub"])
    except CrewRoleError as exc:
        raise HTTPException(403, exc.detail) from exc
    except HTTPException: raise
    except Exception as exc: raise _error(exc) from exc
def _crew_error(exc: Exception) -> HTTPException:
    if str(exc) == "Crew member not found": return HTTPException(404, str(exc))
    return _error(exc)

@router.get("/crew")
async def index(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    auth_id = await _parent(authorization)
    try: return await CrewService().list_for_auth_user(auth_id)
    except Exception as exc: raise _crew_error(exc) from exc

@router.post("/crew", status_code=status.HTTP_201_CREATED)
async def create(payload: dict[str, Any] | None = None, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    auth_id = await _parent(authorization)
    if payload is not None and not isinstance(payload, dict): raise HTTPException(422, "Invalid JSON")
    try: return await CrewService().create_for_auth_user(auth_id, payload or {})
    except ValueError as exc: raise HTTPException(422, str(exc)) from exc
    except Exception as exc: raise _crew_error(exc) from exc

@router.get("/crew/{child_id}")
async def show(child_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    auth_id = await _parent(authorization)
    try: return await CrewService().get_for_auth_user(auth_id, child_id)
    except Exception as exc: raise _crew_error(exc) from exc

@router.patch("/crew/{child_id}")
async def update(child_id: str, payload: dict[str, Any] | None = None, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    auth_id = await _parent(authorization)
    if not isinstance(payload, dict): raise HTTPException(422, "Body required")
    try: return await CrewService().update_profile_for_auth_user(auth_id, child_id, payload)
    except ValueError as exc: raise HTTPException(422, str(exc)) from exc
    except Exception as exc: raise _crew_error(exc) from exc

@router.patch("/crew/{child_id}/permissions")
async def update_permissions(child_id: str, payload: dict[str, Any] | None = None, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    auth_id = await _parent(authorization)
    if not isinstance(payload, dict): raise HTTPException(422, "Body required")
    try: return await CrewService().update_permissions_for_auth_user(auth_id, child_id, payload)
    except ValueError as exc: raise HTTPException(422, str(exc)) from exc
    except Exception as exc: raise _crew_error(exc) from exc

@router.delete("/crew/{child_id}")
async def destroy(child_id: str, payload: dict[str, Any] | None = None, authorization: str | None = Header(default=None)) -> dict[str, bool]:
    auth_id = await _parent(authorization)
    try: return await CrewService().soft_delete_for_auth_user(auth_id, child_id, bool(payload and payload.get("confirm") is True))
    except ValueError as exc: raise HTTPException(422, str(exc)) from exc
    except Exception as exc: raise _crew_error(exc) from exc

@router.post("/crew/{child_id}/verify-exit-pin")
async def verify_exit_pin(child_id: str, payload: dict[str, Any] | None = None, authorization: str | None = Header(default=None)) -> dict[str, bool]:
    auth_id = await _parent(authorization)
    if not isinstance(payload, dict): raise HTTPException(422, "Body required")
    pin = payload.get("pin")
    try:
        result = await CrewService().verify_exit_pin_for_auth_user(auth_id, child_id, str(pin) if pin is not None else "")
        if not result.get("ok"):
            raise HTTPException(403, "PIN incorrecto")
        return result
    except ValueError as exc: raise HTTPException(422, str(exc)) from exc
    except HTTPException: raise
    except Exception as exc: raise _crew_error(exc) from exc

@router.get("/crew/{child_id}/baggage")
async def baggage(
    child_id: str,
    world_theme: str | None = Query(default=None),
    include_usage: bool = Query(default=False),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    auth_id = await _parent(authorization)
    try:
        member = await CrewService().get_for_auth_user(auth_id, child_id)
        theme = world_theme or member.get("world_theme") or member.get("active_world_theme") or "fantasy"
        settings = member.get("settings") if isinstance(member.get("settings"), dict) else {}
        learning = settings.get("learning") if isinstance(settings.get("learning"), dict) else {}
        body = await InventoryService().get_baggage(
            child_id,
            str(theme),
            active_subjects=SubjectCatalog.resolve_active_subjects(member),
            age_band=member.get("age_band") if isinstance(member.get("age_band"), str) else None,
            show_levels_to_child=bool(learning.get("show_levels_to_child")),
            audience="tutor",
        )
        if include_usage:
            body["usage_log"] = InventoryService().get_usage_log(
                auth_id,
                child_id,
                str(theme),
            )
        return body
    except Exception as exc:
        raise _crew_error(exc) from exc


@router.get("/crew/{child_id}/wallet")
async def wallet(
    child_id: str,
    world_theme: str | None = Query(default=None),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    auth_id = await _parent(authorization)
    try:
        member = await CrewService().get_for_auth_user(auth_id, child_id)
        theme = world_theme or member.get("world_theme") or "fantasy"
        return await RewardEconomyService().get_wallet(child_id, str(theme))
    except Exception as exc:
        raise _crew_error(exc) from exc


@router.post("/crew/{child_id}/tutor-report")
async def tutor_report(child_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    auth_id = await _parent(authorization)
    try:
        member = await CrewService().get_for_auth_user(auth_id, child_id)
        if member.get("is_tutor_profile"):
            raise HTTPException(422, "No hay informe para el perfil de tutor")
        from app.services.parents import ParentAccountService
        from app.services.tutor_reports import TutorReportService

        parent = await ParentAccountService().find_by_auth_user_id(auth_id)
        if not parent:
            raise HTTPException(404, "Parent not found")
        learning = (member.get("settings") or {}).get("learning") or {}
        report = TutorReportService().write_evaluation_report(
            parent_id=str(parent["parent_id"]),
            child_id=child_id,
            world_theme=member.get("world_theme"),
            display_name=member.get("display_name"),
            progress=member.get("progress"),
            subject_notes=CrewService.effective_subject_notes(learning),
            general_note=CrewService.effective_general_note(learning),
            reason="tutor_request",
        )
        return {"ok": True, "filename": report["filename"], "body": report["body"]}
    except HTTPException:
        raise
    except Exception as exc:
        raise _crew_error(exc) from exc
