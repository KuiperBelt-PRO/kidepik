"""Catálogo de sexo del explorador (SPEC_APP_EXPLORER_GENDER)."""
from __future__ import annotations

from typing import Literal

from app.catalogs.age_band import AgeBand

ExplorerGender = Literal["male", "female"]
VALID_EXPLORER_GENDERS = frozenset({"male", "female"})


def resolve_explorer_gender(raw: str | None) -> ExplorerGender:
    """Legacy null → male (POC)."""
    if raw == "female":
        return "female"
    return "male"


def assert_explorer_gender(value: str) -> ExplorerGender:
    if value not in VALID_EXPLORER_GENDERS:
        raise ValueError("explorer_gender invalid")
    return value  # type: ignore[return-value]


def _resolve_band(age_band: str | None, age_years: int | None) -> str:
    if age_band:
        return age_band
    if age_years is not None:
        return AgeBand.from_age_years(age_years)
    return AgeBand.CHILD


def gender_chip_options(
    age_band: str | None, age_years: int | None
) -> list[dict[str, str]]:
    band = _resolve_band(age_band, age_years)
    if band in {AgeBand.ADULT, AgeBand.SENIOR}:
        return [
            {"id": "male", "label": "Hombre"},
            {"id": "female", "label": "Mujer"},
        ]
    return [
        {"id": "male", "label": "Chico"},
        {"id": "female", "label": "Chica"},
    ]


def canonical_gender_question(age_band: str | None, age_years: int | None) -> str:
    band = _resolve_band(age_band, age_years)
    if band == AgeBand.EARLY:
        return "En la aventura, ¿chico o chica?"
    if band == AgeBand.CHILD:
        return "En la aventura, ¿eres chico o chica?"
    if band == AgeBand.TWEEN:
        return "Para contarte la aventura como toca, ¿eres chico o chica?"
    if band == AgeBand.TEEN:
        return "¿Prefieres que te trate de chico o de chica?"
    return "¿Prefieres que te trate de hombre o de mujer?"


def display_label_for_gender(
    raw: str | None, age_years: int | None
) -> str:
    """Etiqueta tutor; legacy null se muestra como Chico."""
    resolved = resolve_explorer_gender(raw)
    adult = age_years is not None and age_years >= 18
    if adult:
        return "Hombre" if resolved == "male" else "Mujer"
    return "Chico" if resolved == "male" else "Chica"


def gender_grammar_prompt_block(
    resolved: ExplorerGender, display_name: str | None
) -> str:
    name = display_name or "el explorador"
    if resolved == "female":
        return (
            "explorer_gender: female\n"
            f"Reglas ES: segunda persona femenina (exploradora, lista, bienvenida); "
            f"tercera persona femenina si hablas de {name}. "
            "No uses formas masculinas por defecto."
        )
    return (
        "explorer_gender: male\n"
        f"Reglas ES: segunda persona masculina (explorador, listo, bienvenido); "
        f"tercera persona masculina si hablas de {name}. "
        "No uses formas femeninas por defecto."
    )
