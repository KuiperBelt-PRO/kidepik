from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Header, HTTPException

from app.services.auth import AuthError, SupabaseAuthService
from app.services.crew import CrewService
from app.services.parents import ParentAccountService
from app.services.session_accounts import CrewRoleError, SessionAccountService, SessionConflictError

router = APIRouter(tags=["parents"])


def _map_runtime(exc: RuntimeError) -> HTTPException:
    message = str(exc)
    if message in {"DATABASE_URL not configured", "Database unavailable"}:
        return HTTPException(status_code=503, detail=message)
    if message == "Parent account not found":
        return HTTPException(status_code=404, detail=message)
    return HTTPException(status_code=500, detail="Internal error")


def _error(exc: Exception) -> HTTPException:
    if isinstance(exc, RuntimeError):
        return _map_runtime(exc)
    return HTTPException(status_code=500, detail="Internal error")


def _email(claims: dict[str, Any]) -> str:
    email = claims.get("email") or ""
    if not email:
        raise HTTPException(status_code=422, detail="Email required")
    return str(email)


async def _claims(authorization: str | None) -> dict[str, Any]:
    auth = SupabaseAuthService()
    try:
        return await auth.validate_bearer(authorization)
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=exc.message) from exc
    finally:
        await auth.aclose()


@router.post("/api/v1/parents/bootstrap")
async def bootstrap(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    claims = await _claims(authorization)
    email = claims.get("email") or ""
    if not email:
        raise HTTPException(status_code=422, detail="Email required")
    try:
        result = await SessionAccountService(parents=ParentAccountService()).bootstrap(
            claims["sub"],
            email,
            claims.get("display_name"),
            claims.get("avatar_url"),
        )
        if result.get("role") == "tutor":
            await CrewService().ensure_tutor_profile_for_auth_user(claims["sub"])
    except CrewRoleError as exc:
        raise HTTPException(status_code=403, detail=exc.detail) from exc
    except SessionConflictError as exc:
        raise HTTPException(status_code=409, detail=exc.detail) from exc
    except RuntimeError as exc:
        raise _map_runtime(exc) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal error") from exc
    return result


@router.get("/api/v1/parents/me")
async def me(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    claims = await _claims(authorization)
    email = claims.get("email") or ""
    if not email:
        raise HTTPException(status_code=422, detail="Email required")
    try:
        await SessionAccountService(parents=ParentAccountService()).require_tutor(
            claims["sub"],
            email,
            claims.get("display_name"),
            claims.get("avatar_url"),
        )
        return await ParentAccountService().get_or_bootstrap(
            claims["sub"],
            email,
            claims.get("display_name"),
            claims.get("avatar_url"),
        )
    except CrewRoleError as exc:
        raise HTTPException(status_code=403, detail=exc.detail) from exc
    except RuntimeError as exc:
        raise _map_runtime(exc) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal error") from exc


@router.patch("/api/v1/parents/me")
async def update_me(
    body: dict[str, Any] = Body(default_factory=dict),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    claims = await _claims(authorization)
    if "display_name" not in body:
        raise HTTPException(status_code=422, detail="display_name required")
    email = claims.get("email") or ""
    if not email:
        raise HTTPException(status_code=422, detail="Email required")
    try:
        service = ParentAccountService()
        await SessionAccountService(parents=service).require_tutor(
            claims["sub"],
            email,
            claims.get("display_name"),
            claims.get("avatar_url"),
        )
        await service.get_or_bootstrap(
            claims["sub"],
            email,
            claims.get("display_name"),
            claims.get("avatar_url"),
        )
        return await service.update_display_name(claims["sub"], body["display_name"])
    except CrewRoleError as exc:
        raise HTTPException(status_code=403, detail=exc.detail) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise _map_runtime(exc) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal error") from exc


@router.delete("/api/v1/parents/me")
async def delete_me(authorization: str | None = Header(default=None)) -> dict[str, bool]:
    claims = await _claims(authorization)
    email = claims.get("email") or ""
    if not email:
        raise HTTPException(status_code=422, detail="Email required")
    try:
        await SessionAccountService(parents=ParentAccountService()).require_tutor(
            claims["sub"],
            email,
            claims.get("display_name"),
            claims.get("avatar_url"),
        )
        await ParentAccountService().delete_account(claims["sub"])
    except CrewRoleError as exc:
        raise HTTPException(status_code=403, detail=exc.detail) from exc
    except RuntimeError as exc:
        raise _map_runtime(exc) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal error") from exc
    return {"deleted": True}
