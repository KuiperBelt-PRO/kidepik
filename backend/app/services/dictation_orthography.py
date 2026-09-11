"""Nivel de ortografía independiente (no es la materia `language`)."""
from __future__ import annotations

from typing import Any

from app.services.subject_progress_config import (
    SEED_ROLLING,
    THRESHOLD_UP,
    CHALLENGES_PER_PATH_NORM,
    delta_per_correct,
)

DEFAULT_LEVEL = "L1"
MIN_LEVEL = 1
MAX_LEVEL = 6


def _level_index(level_id: str | None) -> int:
    raw = str(level_id or DEFAULT_LEVEL).strip().upper()
    if raw.startswith("L") and raw[1:].isdigit():
        idx = int(raw[1:])
        return max(MIN_LEVEL, min(MAX_LEVEL, idx))
    return MIN_LEVEL


def effective_orthography(raw: object) -> dict[str, Any]:
    blob = raw if isinstance(raw, dict) else {}
    level = str(blob.get("orthography_level_id") or DEFAULT_LEVEL).strip() or DEFAULT_LEVEL
    idx = _level_index(level)
    rolling = blob.get("orthography_rolling")
    if isinstance(rolling, (int, float)) and not isinstance(rolling, bool):
        value = float(rolling)
        if value < 0:
            value = 0.0
        if value > THRESHOLD_UP:
            value = THRESHOLD_UP
    else:
        value = SEED_ROLLING
    return {
        "orthography_level_id": f"L{idx}",
        "orthography_rolling": round(value, 4),
    }


def advance_orthography(
    state: dict[str, Any] | None,
    *,
    challenges_per_path: int = CHALLENGES_PER_PATH_NORM,
    delta_scale: float = 0.5,
) -> dict[str, Any]:
    """½ Δ de un acierto de camino; no cuenta como camino."""
    current = effective_orthography(state)
    idx = _level_index(current["orthography_level_id"])
    rolling = float(current["orthography_rolling"])
    rolling = min(THRESHOLD_UP, rolling + delta_per_correct(challenges_per_path) * float(delta_scale))
    rolling = round(rolling, 4)
    if rolling >= THRESHOLD_UP and idx < MAX_LEVEL:
        idx += 1
        rolling = SEED_ROLLING
    return {
        "orthography_level_id": f"L{idx}",
        "orthography_rolling": rolling,
    }
