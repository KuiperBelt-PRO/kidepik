"""Arquetipos de viajero por mundo — fallback si el LLM no valida."""
from __future__ import annotations

from typing import Any

ARCHETYPE_OPTIONS_BY_WORLD: dict[str, list[dict[str, str]]] = {
    "fantasy": [
        {
            "id": "mago_noche_blanca",
            "label": "El mago de la noche blanca",
            "description": "Llevas un cuaderno de hechizos y buscas respuestas en la oscuridad.",
        },
        {
            "id": "elfo_bosque_milenario",
            "label": "El elfo explorador del bosque milenario",
            "description": "Conoces sendas secretas y lees las huellas del viento.",
        },
        {
            "id": "bibliotecaria_anderlogia",
            "label": "La bibliotecaria de Anderlogia",
            "description": "Guardas mapas viejos y recuerdas nombres olvidados.",
        },
    ],
    "sci-fi": [
        {
            "id": "cadete_humano",
            "label": "Cadete humano",
            "description": "Aprendes a pilotar y a trabajar con tu tripulación.",
        },
        {
            "id": "ingeniera_androide",
            "label": "Ingeniera androide",
            "description": "Reparas sistemas y encuentras fallos en las máquinas.",
        },
        {
            "id": "explorador_alienigena",
            "label": "Explorador alienígena",
            "description": "Conoces rutas extrañas y observas todo con curiosidad.",
        },
    ],
}


def species_options_for_world(world_theme: str | None) -> list[dict[str, str]]:
    """Compatibilidad: devuelve arquetipos de fallback para los chips."""
    theme = world_theme if world_theme in ARCHETYPE_OPTIONS_BY_WORLD else "fantasy"
    return [dict(row) for row in ARCHETYPE_OPTIONS_BY_WORLD[theme]]


def resolve_species_input(raw: str, world_theme: str | None) -> str:
    """Mapea el id de un arquetipo a una etiqueta legible."""
    text = raw.strip()
    if not text:
        return "explorador"
    for opt in species_options_for_world(world_theme):
        if opt["id"] == text or opt["label"].lower() == text.lower():
            return opt["label"]
    return text[:120]
