from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException, status

from app.routers.parents import _claims, _email, _error
from app.services.crew import CrewService
from app.services.parents import ParentAccountService

router = APIRouter(prefix="/api/v1", tags=["crew"])

async def _parent(authorization: str | None) -> str:
    claims = await _claims(authorization)
    try:
        await ParentAccountService().get_or_bootstrap(claims["sub"], _email(claims), claims.get("display_name"), claims.get("avatar_url"))
        return str(claims["sub"])
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
