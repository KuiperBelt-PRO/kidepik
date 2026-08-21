from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException

from app.routers.parents import _claims, _email, _map_runtime
from app.services.crew import CrewService
from app.services.debug_access import debug_capabilities_for_claims
from app.services.parents import ParentAccountService
from app.services.session_accounts import CrewRoleError, SessionAccountService, SessionConflictError

router = APIRouter(tags=["session"])


@router.post("/api/v1/session/bootstrap")
async def bootstrap(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    return await _bootstrap(authorization)


@router.get("/api/v1/session/me")
async def me(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    return await _bootstrap(authorization)


async def _bootstrap(authorization: str | None) -> dict[str, Any]:
    claims = await _claims(authorization)
    email = _email(claims)
    try:
        result = await SessionAccountService(parents=ParentAccountService()).bootstrap(
            claims["sub"],
            email,
            claims.get("display_name"),
            claims.get("avatar_url"),
        )
        if result.get("role") == "tutor":
            await CrewService().ensure_tutor_profile_for_auth_user(claims["sub"])
        result["debug_capabilities"] = await debug_capabilities_for_claims(claims)
        return result
    except CrewRoleError as exc:
        raise HTTPException(status_code=403, detail=exc.detail) from exc
    except SessionConflictError as exc:
        raise HTTPException(status_code=409, detail=exc.detail) from exc
    except RuntimeError as exc:
        raise _map_runtime(exc) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal error") from exc
