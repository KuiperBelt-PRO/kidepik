"""Selección de frases de espera desde JSONL (SPEC_APP_WAITING_PHRASES)."""
from __future__ import annotations

import json
import random
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.config import get_settings

FALLBACK = {
    "fantasy": ["La historia toma aire antes de continuar."],
    "sci-fi": ["Procesando el siguiente salto de la misión."],
    "neutral": ["Un momento, por favor…"],
}


def _waiting_dir(explicit: Path | None = None) -> Path:
    if explicit is not None:
        return explicit
    return Path(get_settings().waiting_data_dir)


@lru_cache(maxsize=8)
def _load_theme_rows(theme: str, root_str: str) -> tuple[dict[str, Any], ...]:
    path = Path(root_str) / f"{theme}.jsonl"
    if not path.is_file():
        return ()
    rows: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(row, dict):
                rows.append(row)
    return tuple(rows)


def clear_waiting_cache() -> None:
    _load_theme_rows.cache_clear()


def pick_waiting_batch_sync(
    *,
    world_theme: str,
    age_band: str | None,
    phase: str,
    limit: int = 12,
    locale: str = "es",
    waiting_dir: Path | None = None,
) -> list[str]:
    theme = world_theme if world_theme in {"fantasy", "sci-fi", "neutral"} else "neutral"
    root = _waiting_dir(waiting_dir)
    root_str = str(root.resolve())
    candidates: list[dict[str, Any]] = []
    for key in dict.fromkeys((theme, "neutral")):
        candidates.extend(_load_theme_rows(key, root_str))

    def matches(row: dict[str, Any], *, allow_generic: bool) -> bool:
        if row.get("active") is False:
            return False
        if str(row.get("locale") or "es") != locale:
            return False
        row_phase = str(row.get("phase") or "generic")
        if row_phase != phase and not (allow_generic and row_phase == "generic"):
            return False
        band = row.get("age_band")
        if band is None:
            return True
        return age_band is not None and str(band) == str(age_band)

    matched = [row for row in candidates if matches(row, allow_generic=False)]
    if not matched:
        matched = [row for row in candidates if matches(row, allow_generic=True)]

    if not matched:
        return list(FALLBACK.get(theme) or FALLBACK["neutral"])

    pool: list[str] = []
    for row in matched:
        body = str(row.get("body") or "").strip()
        if not body:
            continue
        weight = max(1, int(row.get("weight") or 1))
        pool.extend([body] * weight)
    random.shuffle(pool)
    seen: set[str] = set()
    out: list[str] = []
    for phrase in pool:
        if phrase in seen:
            continue
        seen.add(phrase)
        out.append(phrase)
        if len(out) >= limit:
            break
    return out or list(FALLBACK.get(theme) or FALLBACK["neutral"])


async def pick_waiting_batch(
    session: Any = None,
    *,
    world_theme: str,
    age_band: str | None,
    phase: str,
    limit: int = 12,
    locale: str = "es",
    waiting_dir: Path | None = None,
) -> list[str]:
    """API estable: ``session`` se ignora (legado PG)."""
    _ = session
    return pick_waiting_batch_sync(
        world_theme=world_theme,
        age_band=age_band,
        phase=phase,
        limit=limit,
        locale=locale,
        waiting_dir=waiting_dir,
    )
