"""Catálogo y resolución de capítulos del viaje (SPEC_APP_JOURNEY_CHAPTERS)."""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from app.config import get_settings

ChapterSource = Literal["system", "llm"]

_TITLE_MIN = 4
_TITLE_MAX = 48
_NEWLINE_RE = re.compile(r"[\r\n]+")

_DEFAULT_CATALOG: dict[str, Any] = {
    "umbral": {
        "neutral": "El umbral",
        "fantasy": "El umbral",
        "sci-fi": "La puerta estelar",
    },
    "rito": {
        "fantasy": "La prueba del saber",
        "sci-fi": "La prueba de acceso",
    },
    "adventure_fallback": {
        "fantasy": "La senda continúa",
        "sci-fi": "Rumbo desconocido",
    },
}

RITO_PHASES = frozenset(
    {
        "placement_item",
        "placement_feedback",
    }
)
ADVENTURE_PHASES = frozenset(
    {
        "choose_path",
        "path_intro",
        "path_challenge",
        "adventure_ready",
        "compose_failed",
    }
)


def _chapters_dir(explicit: Path | None = None) -> Path:
    if explicit is not None:
        return explicit
    return Path(get_settings().chapters_data_dir)


@lru_cache(maxsize=4)
def _load_catalog(root_str: str) -> dict[str, Any]:
    path = Path(root_str) / "system_titles.es.json"
    if not path.is_file():
        return _DEFAULT_CATALOG
    try:
        with path.open(encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return _DEFAULT_CATALOG
    if not isinstance(data, dict):
        return _DEFAULT_CATALOG
    return data


def clear_chapter_catalog_cache() -> None:
    _load_catalog.cache_clear()


def validate_chapter_title(raw: str | None) -> str | None:
    """Valida título LLM: 4–48 chars, sin saltos de línea."""
    if raw is None:
        return None
    text = _NEWLINE_RE.sub(" ", str(raw)).strip()
    if len(text) < _TITLE_MIN or len(text) > _TITLE_MAX:
        return None
    return text


def system_title(chapter_key: str, world_theme: str | None) -> str:
    catalog = _load_catalog(str(_chapters_dir()))
    theme = world_theme if world_theme in {"fantasy", "sci-fi"} else "neutral"
    if chapter_key == "adventure":
        fallbacks = catalog.get("adventure_fallback") or _DEFAULT_CATALOG["adventure_fallback"]
        if theme == "neutral":
            theme = "fantasy"
        return str(fallbacks.get(theme) or fallbacks.get("fantasy") or "La senda continúa")
    row = catalog.get(chapter_key) or _DEFAULT_CATALOG.get(chapter_key, {})
    if chapter_key == "umbral":
        return str(row.get(theme) or row.get("neutral") or "El umbral")
    if theme == "neutral":
        theme = "fantasy"
    return str(row.get(theme) or row.get("fantasy") or "")


def macro_chapter_key(
    child: dict[str, Any],
    *,
    last_phase: str | None = None,
) -> str:
    step = str(child.get("onboarding_step") or "pending_entry")
    placement = str(child.get("placement_status") or "not_started")
    phase = str(last_phase or "")

    if step == "complete" or phase in ADVENTURE_PHASES:
        return "adventure"
    if phase in RITO_PHASES or (step == "placement" and placement == "in_progress"):
        return "rito"
    return "umbral"


def adventure_chapter_from_progress(
    progress: dict[str, Any] | None,
    world_theme: str | None,
) -> dict[str, Any] | None:
    if not progress:
        return None
    path = progress.get("path") if isinstance(progress.get("path"), dict) else {}
    path_id = str(progress.get("path_id") or path.get("path_id") or "").strip()
    if not path_id:
        return None
    raw_title = path.get("title") or progress.get("title")
    title = validate_chapter_title(str(raw_title) if raw_title else None)
    source: ChapterSource = "llm"
    if not title:
        title = system_title("adventure", world_theme)
        source = "system"
    idx = int(progress.get("challenge_index") or 0)
    return {
        "id": f"adventure:{path_id}:{idx}",
        "title": title,
        "source": source,
        "world_theme": world_theme,
        "path_id": path_id,
    }


def resolve_chapter(
    child: dict[str, Any],
    *,
    world_theme: str | None,
    last_phase: str | None = None,
    persisted: dict[str, Any] | None = None,
    path_progress: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Devuelve payload ``chapter`` para la API play."""
    macro = macro_chapter_key(child, last_phase=last_phase)
    if macro == "adventure":
        from_progress = adventure_chapter_from_progress(path_progress, world_theme)
        if from_progress:
            return from_progress
        if persisted and str(persisted.get("chapter_id", "")).startswith("adventure:"):
            return {
                "id": str(persisted["chapter_id"]),
                "title": str(persisted.get("title") or system_title("adventure", world_theme)),
                "source": persisted.get("source") or "llm",
                "world_theme": world_theme,
                "path_id": persisted.get("path_id"),
            }
        return {
            "id": "adventure",
            "title": system_title("adventure", world_theme),
            "source": "system",
            "world_theme": world_theme,
        }

    chapter_id = macro
    return {
        "id": chapter_id,
        "title": system_title(chapter_id, world_theme),
        "source": "system",
        "world_theme": world_theme,
    }


def read_latest_chapter_opened(events: list[dict[str, Any]]) -> dict[str, Any] | None:
    latest: dict[str, Any] | None = None
    for row in events:
        if row.get("kind") != "chapter_opened":
            continue
        payload = row.get("payload")
        if isinstance(payload, dict):
            latest = payload
    return latest
