"""Constantes de progreso lineal y recuento de retos por camino.

SPEC_APP_SUBJECT_PROGRESS_LINEAR_B + SPEC_APP_PATH_CHALLENGE_COUNT.
"""

from __future__ import annotations

from typing import Any

from app.catalogs.age_band import AgeBand

# Barra al 100% = rolling 1.0; subida de nivel en ese umbral.
THRESHOLD_UP = 1.0
SEED_ROLLING = 0.10  # 10% de barra inicial
PATHS_PER_LEVEL_UP = 4
MIN_CHALLENGES_PER_PATH = 3
MAX_CHALLENGES_PER_PATH = 10
CHALLENGES_PER_PATH_NORM = 3  # default early/child/senior y fallback
REQUIRED_CORRECT_CHALLENGES = PATHS_PER_LEVEL_UP * CHALLENGES_PER_PATH_NORM
DELTA_PER_CORRECT = (THRESHOLD_UP - SEED_ROLLING) / REQUIRED_CORRECT_CHALLENGES
ROLLING_MODEL = "linear_b"

_DEFAULT_BY_BAND: dict[str, int] = {
    AgeBand.EARLY: 3,
    AgeBand.CHILD: 3,
    AgeBand.TWEEN: 5,
    AgeBand.TEEN: 5,
    AgeBand.ADULT: 5,
    AgeBand.SENIOR: 3,
}


def default_challenges_per_path(
    age_band: str | None = None,
    age_years: int | None = None,
) -> int:
    """Default de retos por camino según banda cronológica.

    Parameters
    ----------
    age_band
        `children.age_band`. Si no es válido, se deriva de ``age_years``.
    age_years
        Edad en años si no hay banda.

    Returns
    -------
    int
        3 o 5. Sin datos: 3.
    """
    band = age_band if AgeBand.is_valid(age_band) else None
    if band is None and age_years is not None:
        try:
            band = AgeBand.from_age_years(int(age_years))
        except (TypeError, ValueError):
            band = None
    return _DEFAULT_BY_BAND.get(band or "", CHALLENGES_PER_PATH_NORM)


def clamp_challenges_per_path(n: int) -> int:
    """Acota N al rango tutor 3–10."""
    return max(MIN_CHALLENGES_PER_PATH, min(MAX_CHALLENGES_PER_PATH, int(n)))


def required_corrects(n: int) -> int:
    """Aciertos necesarios para subir L con caminos de ``n`` retos."""
    return PATHS_PER_LEVEL_UP * clamp_challenges_per_path(n)


def delta_per_correct(n: int | None = None) -> float:
    """Incremento de rolling por acierto para un camino de ``n`` retos.

    Parameters
    ----------
    n
        Retos del camino. ``None`` usa el default de producto (3).
    """
    count = CHALLENGES_PER_PATH_NORM if n is None else clamp_challenges_per_path(n)
    return (THRESHOLD_UP - SEED_ROLLING) / required_corrects(count)


def effective_challenges_per_path(
    raw: object = None,
    age_band: str | None = None,
    age_years: int | None = None,
) -> int:
    """N efectivo: entero persistido 3–10 o default de banda."""
    if type(raw) is int and MIN_CHALLENGES_PER_PATH <= raw <= MAX_CHALLENGES_PER_PATH:
        return raw
    return default_challenges_per_path(age_band, age_years)


def normalize_challenges_per_path_patch(raw: object) -> int:
    """Valida el PATCH tutor. Rechaza bool, float y fuera de rango.

    Raises
    ------
    ValueError
        Si el valor no es un entero 3–10.
    """
    if isinstance(raw, bool) or type(raw) is not int:
        raise ValueError("learning.challenges_per_path invalid")
    if raw < MIN_CHALLENGES_PER_PATH or raw > MAX_CHALLENGES_PER_PATH:
        raise ValueError("learning.challenges_per_path invalid")
    return raw


def challenges_per_path_from_pack(
    path: dict[str, Any] | None = None,
    payload: dict[str, Any] | None = None,
    *,
    fallback: int = CHALLENGES_PER_PATH_NORM,
) -> int:
    """N horneado en pack / evento ``path_progress``."""
    if isinstance(payload, dict):
        raw = payload.get("challenges_per_path")
        if type(raw) is int:
            return clamp_challenges_per_path(raw)
    blob = path if isinstance(path, dict) else {}
    raw = blob.get("challenges_per_path")
    if type(raw) is int:
        return clamp_challenges_per_path(raw)
    challenges = blob.get("challenges")
    if isinstance(challenges, list) and len(challenges) >= MIN_CHALLENGES_PER_PATH:
        return clamp_challenges_per_path(len(challenges))
    return clamp_challenges_per_path(fallback)
