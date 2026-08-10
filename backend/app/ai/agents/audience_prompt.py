"""Bloque de instrucciones de audiencia inyectado en cada turno (band_early / band_child)."""
from __future__ import annotations

from app.catalogs.age_band import AgeBand
from app.services.mentor_prose import resolve_audience_band

# Refuerzo explícito solo en las dos bandas infantiles del producto.
_REINFORCED_BANDS = frozenset({AgeBand.EARLY, AgeBand.CHILD})


def needs_child_simple_language(
    age_years: int | None,
    age_band: str | None = None,
) -> bool:
    """True para band_early (5–7) y band_child (8–10)."""
    band = resolve_audience_band(age_band, age_years)
    return band in _REINFORCED_BANDS


def audience_instruction_block(
    age_years: int | None,
    age_band: str | None = None,
) -> str:
    """Reglas explícitas por banda (no dependen de defer de skills)."""
    band = resolve_audience_band(age_band, age_years)
    age_label = f"{age_years} años" if age_years is not None else "esta edad"

    shared_rules = (
        "- Repite con sencillez lo que dijo el explorador; no inventes apodos literarios.\n"
        "- Prohibido: onírico, penumbra, vigía onírico, sentinela onírico, remanso, valía.\n"
        "- Bien: «Eres el protector de los sueños olvidados. ¿Empezamos la prueba?»\n"
        "- Mal: «Eres un Vigía Onírico, guardián de estrellas en la penumbra.»"
    )

    if band == AgeBand.EARLY:
        return (
            f"AUDIENCIA OBLIGATORIA — explorador de {age_label} (band_early, 5–7 años):\n"
            "- Frases muy cortas (máx. ~12 palabras); palabras cotidianas.\n"
            "- Sin metáforas largas; fantasía concreta sí, poesía adulta no.\n"
            f"{shared_rules}"
        )

    if band == AgeBand.CHILD:
        return (
            f"AUDIENCIA OBLIGATORIA — explorador de {age_label} (band_child, 8–10 años):\n"
            "- Frases cortas (máx. ~18 palabras); vocabulario de primaria, claro y directo.\n"
            "- Fantasía sí; palabras de diccionario difícil no.\n"
            f"{shared_rules}"
        )

    return (
        f"AUDIENCIA: explorador de {age_label} ({band}). "
        "Adapta vocabulario y longitud (skill audience-language)."
    )


def prepend_audience_block(
    user_prompt: str,
    *,
    age_years: int | None,
    age_band: str | None = None,
) -> str:
    block = audience_instruction_block(age_years, age_band)
    if not block:
        return user_prompt
    return f"{block}\n\n{user_prompt}"
