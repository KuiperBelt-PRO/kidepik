"""Canonicalización y validación de Gmail para invitaciones de tripulante."""

from __future__ import annotations

GMAIL_DOMAINS = frozenset({"gmail.com", "googlemail.com"})
CANONICAL_DOMAIN = "gmail.com"


class InviteEmailError(ValueError):
    """Error de validación de Gmail invitado (`detail` estable para la API)."""

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


def canonicalize_gmail(raw: object) -> str | None:
    """Normaliza un Gmail para match de login.

    Vacío / None → None. Dominio no Gmail → InviteEmailError.
    Quita puntos del local-part, sufijo +alias, y unifica googlemail.com → gmail.com.
    """
    if raw is None:
        return None
    if not isinstance(raw, str):
        raise InviteEmailError("invite_email_not_gmail")
    trimmed = raw.strip().lower()
    if not trimmed:
        return None
    if "@" not in trimmed:
        raise InviteEmailError("invite_email_not_gmail")
    local, domain = trimmed.rsplit("@", 1)
    if domain not in GMAIL_DOMAINS or not local:
        raise InviteEmailError("invite_email_not_gmail")
    local = local.split("+", 1)[0].replace(".", "")
    if not local:
        raise InviteEmailError("invite_email_not_gmail")
    return f"{local}@{CANONICAL_DOMAIN}"


def display_invite_email(raw: object) -> str | None:
    """Texto recortado para UI tutor; None si vacío."""
    if raw is None:
        return None
    if not isinstance(raw, str):
        raise InviteEmailError("invite_email_not_gmail")
    trimmed = raw.strip()
    return trimmed or None
