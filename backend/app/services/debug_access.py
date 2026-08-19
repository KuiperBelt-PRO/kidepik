"""Acceso al modo debug IA por cuenta (permisos DB + setting persistente)."""
from __future__ import annotations

from typing import Any

from app.config import Settings, get_settings
from app.services.account_authorization import AccountAuthorizationService


async def debug_capabilities_for_parent(
    parent_id: str,
    parent_settings: dict[str, Any] | None = None,
    *,
    settings: Settings | None = None,
    auth: AccountAuthorizationService | None = None,
) -> dict[str, bool]:
    """Calcula elegibilidad de operador y si el debug está activo para la cuenta."""
    cfg = settings or get_settings()
    authorization = auth or AccountAuthorizationService()
    operator_eligible = cfg.ai_debug_enabled() and await authorization.has_permission(
        parent_id,
        "debug_ai",
    )
    debug_enabled = False
    if operator_eligible and isinstance(parent_settings, dict):
        diagnostics = parent_settings.get("diagnostics")
        if isinstance(diagnostics, dict):
            debug_enabled = diagnostics.get("debug_ai_enabled") is True
    return {
        "operator_eligible": operator_eligible,
        "debug_enabled": debug_enabled,
        "debug_allowed": operator_eligible and debug_enabled,
    }


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


async def debug_capabilities_for_auth_user(claims: dict[str, Any]) -> dict[str, bool]:
    """Carga settings del tutor y devuelve capacidades de debug."""
    from app.services.parents import ParentAccountService
    from app.services.settings import ParentSettingsRepository

    email = str(claims.get("email") or "")
    repo = ParentSettingsRepository(parents=ParentAccountService())
    account = await repo.parents.get_or_bootstrap(
        str(claims["sub"]),
        email,
        claims.get("display_name"),
        claims.get("avatar_url"),
    )
    parent_settings = await repo.get_merged_settings_for_parent_id(account["parent_id"])
    return await debug_capabilities_for_parent(account["parent_id"], parent_settings)


async def debug_attach_allowed_for_auth_user(
    claims: dict[str, Any],
    *,
    header_debug: bool,
) -> bool:
    if not header_debug:
        return False
    capabilities = await debug_capabilities_for_auth_user(claims)
    return capabilities["debug_allowed"]
