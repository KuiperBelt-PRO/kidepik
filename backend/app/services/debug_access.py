"""Acceso al modo debug IA por cuenta (permisos DB + setting persistente)."""
from __future__ import annotations

from typing import Any

from sqlalchemy import text

from app.config import Settings, get_settings
from app.db import session_scope
from app.services.account_authorization import AccountAuthorizationService


async def _child_settings(child_id: str) -> dict[str, Any]:
    async with session_scope() as session:
        row = (
            await session.execute(
                text(
                    """
                    select settings
                    from public.children
                    where id = :child_id and status <> 'deleted'
                    limit 1
                    """
                ),
                {"child_id": child_id},
            )
        ).mappings().first()
    if not row or not isinstance(row.get("settings"), dict):
        return {}
    return dict(row["settings"])


def _debug_enabled_from_settings(settings: dict[str, Any] | None) -> bool:
    if not isinstance(settings, dict):
        return False
    diagnostics = settings.get("diagnostics")
    if not isinstance(diagnostics, dict):
        return False
    return diagnostics.get("debug_ai_enabled") is True


async def debug_capabilities_for_parent(
    parent_id: str,
    parent_settings: dict[str, Any] | None = None,
    *,
    settings: Settings | None = None,
    auth: AccountAuthorizationService | None = None,
) -> dict[str, bool]:
    """Calcula elegibilidad de operador y si el debug está activo para la cuenta tutor."""
    cfg = settings or get_settings()
    authorization = auth or AccountAuthorizationService()
    operator_eligible = cfg.ai_debug_enabled() and await authorization.has_permission(
        parent_id,
        "debug_ai",
    )
    debug_enabled = False
    if operator_eligible and isinstance(parent_settings, dict):
        debug_enabled = _debug_enabled_from_settings(parent_settings)
    return {
        "operator_eligible": operator_eligible,
        "debug_enabled": debug_enabled,
        "debug_allowed": operator_eligible and debug_enabled,
    }


async def debug_capabilities_for_crew(
    email: str,
    child_id: str,
    *,
    settings: Settings | None = None,
    auth: AccountAuthorizationService | None = None,
) -> dict[str, bool]:
    """Tripulante con email bootstrap (developers): debug en children.settings.diagnostics."""
    cfg = settings or get_settings()
    authorization = auth or AccountAuthorizationService()
    operator_eligible = False
    if cfg.ai_debug_enabled():
        candidates = [email]
        invite = await _child_invite_email(child_id)
        if invite and invite not in candidates:
            candidates.append(invite)
        for candidate in candidates:
            if candidate and await authorization.has_bootstrap_email_permission(candidate, "debug_ai"):
                operator_eligible = True
                break
    child_settings = await _child_settings(child_id)
    debug_enabled = operator_eligible and _debug_enabled_from_settings(child_settings)
    return {
        "operator_eligible": operator_eligible,
        "debug_enabled": debug_enabled,
        "debug_allowed": operator_eligible and debug_enabled,
    }


async def _child_invite_email(child_id: str) -> str | None:
    async with session_scope() as session:
        row = (
            await session.execute(
                text(
                    """
                    select invite_email
                    from public.children
                    where id = :child_id and status <> 'deleted'
                    limit 1
                    """
                ),
                {"child_id": child_id},
            )
        ).mappings().first()
    if not row or not isinstance(row.get("invite_email"), str):
        return None
    return row["invite_email"].strip() or None


async def debug_capabilities_for_claims(claims: dict[str, Any]) -> dict[str, bool]:
    """Resuelve capacidades según rol de sesión (tutor o tripulante)."""
    from app.services.parents import ParentAccountService
    from app.services.session_accounts import SessionAccountService

    email = str(claims.get("email") or "")
    session = await SessionAccountService(parents=ParentAccountService()).bootstrap(
        str(claims["sub"]),
        email,
        claims.get("display_name"),
        claims.get("avatar_url"),
    )
    if session.get("role") == "crew" and session.get("child_id"):
        return await debug_capabilities_for_crew(email, str(session["child_id"]))
    from app.services.settings import ParentSettingsRepository

    repo = ParentSettingsRepository(parents=ParentAccountService())
    account = await repo.parents.get_or_bootstrap(
        str(claims["sub"]),
        email,
        claims.get("display_name"),
        claims.get("avatar_url"),
    )
    parent_settings = await repo.get_merged_settings_for_parent_id(account["parent_id"])
    return await debug_capabilities_for_parent(account["parent_id"], parent_settings)


async def sanitize_debug_diagnostics(
    parent_id: str,
    settings: dict[str, Any],
    *,
    auth: AccountAuthorizationService | None = None,
) -> dict[str, Any]:
    """Fuerza diagnostics.debug_ai_enabled=false si el tutor no tiene permiso."""
    diagnostics = settings.get("diagnostics")
    if not isinstance(diagnostics, dict):
        diagnostics = {"debug_ai_enabled": False}
        settings["diagnostics"] = diagnostics
    if diagnostics.get("debug_ai_enabled") is not True:
        diagnostics["debug_ai_enabled"] = False
    elif not (await debug_capabilities_for_parent(parent_id, settings, auth=auth))[
        "operator_eligible"
    ]:
        diagnostics["debug_ai_enabled"] = False
    return settings


async def assert_debug_diagnostics_patch_allowed(
    parent_id: str,
    patch: dict[str, Any],
    *,
    auth: AccountAuthorizationService | None = None,
) -> None:
    """Rechaza activar debug en cuentas sin permiso debug_ai."""
    diagnostics = patch.get("diagnostics")
    if not isinstance(diagnostics, dict):
        return
    if diagnostics.get("debug_ai_enabled") is not True:
        return
    authorization = auth or AccountAuthorizationService()
    if not await authorization.has_permission(parent_id, "debug_ai"):
        raise ValueError("diagnostics.debug_ai_enabled not allowed")


async def assert_crew_debug_diagnostics_patch_allowed(
    email: str,
    child_id: str,
    patch: dict[str, Any],
    *,
    auth: AccountAuthorizationService | None = None,
) -> None:
    """Rechaza activar debug en tripulante sin email bootstrap."""
    diagnostics = patch.get("diagnostics")
    if not isinstance(diagnostics, dict):
        return
    if diagnostics.get("debug_ai_enabled") is not True:
        return
    caps = await debug_capabilities_for_crew(email, child_id, auth=auth)
    if not caps["operator_eligible"]:
        raise ValueError("diagnostics.debug_ai_enabled not allowed")


async def debug_capabilities_for_auth_user(claims: dict[str, Any]) -> dict[str, bool]:
    """Carga settings y devuelve capacidades de debug para el JWT actual."""
    return await debug_capabilities_for_claims(claims)


async def debug_attach_allowed_for_auth_user(
    claims: dict[str, Any],
    *,
    header_debug: bool,
) -> bool:
    if not header_debug:
        return False
    capabilities = await debug_capabilities_for_claims(claims)
    return capabilities["debug_allowed"]
