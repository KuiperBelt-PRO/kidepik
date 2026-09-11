"""Agregado de debilidades de dictado (SPEC_APP_DICTATION §5.1)."""
from __future__ import annotations

from typing import Any


def apply_attempt_to_weak_points(
    points: list[dict[str, Any]] | None,
    *,
    errors: list[dict[str, Any]],
    correct_tags: list[str] | None = None,
    now: str,
) -> list[dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    for row in points or []:
        key = str(row.get("id") or row.get("tag") or "")
        if key:
            by_id[key] = dict(row)
    for err in errors:
        tag = str(err.get("tag") or _tag_for_class(str(err.get("error_class") or "")))
        key = tag
        row = by_id.get(key) or {
            "id": key,
            "tag": tag,
            "label": str(err.get("expected") or tag),
            "examples": [],
            "count": 0,
            "last_seen_at": now,
        }
        examples = list(row.get("examples") or [])
        got = str(err.get("got") or "").strip()
        if got and got not in examples:
            examples.append(got)
        row["examples"] = examples[-8:]
        row["count"] = int(row.get("count") or 0) + 1
        row["last_seen_at"] = now
        by_id[key] = row
    for tag in correct_tags or []:
        if tag in by_id:
            by_id[tag]["count"] = max(0, int(by_id[tag].get("count") or 0) - 2)
    return list(by_id.values())


def _tag_for_class(error_class: str) -> str:
    mapping = {
        "accent": "accentuation",
        "grapheme": "palabras_dificiles",
        "capitalization": "mayusculas",
        "punctuation": "puntuacion",
    }
    return mapping.get(error_class, "custom")
