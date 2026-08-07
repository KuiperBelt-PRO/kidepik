"""Perfiles canónicos de mentor (SPEC_APP_MENTOR)."""
from __future__ import annotations

from typing import Any, Literal

MentorKey = Literal["host", "guardian", "architect"]

_PROFILES: dict[str, dict[str, str]] = {
    "host": {
        "id": "host",
        "mentor_id": "mentor_neutral_host",
        "display_name": "El Guía",
        "short_description": "Anfitrión neutro de KidepiK antes de elegir mundo",
    },
    "guardian": {
        "id": "guardian",
        "mentor_id": "mentor_fantasy_guardian",
        "display_name": "El Guardián del Conocimiento",
        "short_description": "Sabio que guía al aprendiz por los reinos",
    },
    "architect": {
        "id": "architect",
        "mentor_id": "mentor_scifi_architect",
        "display_name": "El Arquitecto del Saber",
        "short_description": "Cartógrafo del conocimiento frente al Vacío",
    },
}


def resolve_mentor_key(child: dict[str, Any] | None) -> MentorKey:
    """Devuelve la clave de mentor según world_theme del viajero."""
    if not child or not child.get("world_theme"):
        return "host"
    if child.get("world_theme") == "sci-fi":
        return "architect"
    return "guardian"


def mentor_profile(key: str) -> dict[str, str]:
    """Perfil canónico por clave interna (host | guardian | architect)."""
    return dict(_PROFILES.get(key) or _PROFILES["host"])


def mentor_for_child(child: dict[str, Any] | None) -> dict[str, str]:
    """Perfil de mentor para un viajero (API / deps)."""
    return mentor_profile(resolve_mentor_key(child))
