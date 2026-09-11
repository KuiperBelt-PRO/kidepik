"""Pedagogía del compose de dictado (banda × ficha × mundo)."""
from __future__ import annotations

from typing import Any

from app.services.dictation_settings import FOCUS_TAGS

_WORD_RANGES: dict[str, tuple[int, int]] = {
    "band_early": (8, 15),
    "band_child": (15, 30),
    "band_tween": (30, 50),
    "band_teen": (50, 80),
    "band_adult": (60, 100),
    "band_senior": (30, 50),
}

_FRAMES: dict[str, tuple[tuple[str, str], ...]] = {
    "sci-fi": (
        (
            "parte de radio del puente",
            "Claro, pausado, como un parte oficial; sin vocoder.",
        ),
        (
            "bitácora de la baliza",
            "Ritmo de dictado escolar, pausas entre oraciones.",
        ),
    ),
    "fantasy": (
        (
            "recado de la hermandad",
            "Voz del Guía, lenta, con pausas entre frases.",
        ),
        (
            "aviso en pergamino",
            "Dictado claro, sin teatralidad.",
        ),
    ),
}

_WRITING_HINTS = (
    "escrib",
    "ortograf",
    "tilde",
    "acent",
    "letra",
    "dictad",
    "graf",
)


def word_count_range(band: str | None, orthography_level: str | None = "L1") -> tuple[int, int]:
    lo, hi = _WORD_RANGES.get(str(band or ""), (15, 30))
    raw = str(orthography_level or "L1").strip().upper()
    idx = 1
    if raw.startswith("L") and raw[1:].isdigit():
        idx = max(1, min(6, int(raw[1:])))
    frac = (idx - 1) / 5.0
    span = hi - lo
    window = max(3, int(round(span * 0.4)))
    center = lo + frac * span
    inner_lo = int(round(center - window / 2))
    inner_hi = int(round(center + window / 2))
    inner_lo = max(lo, min(inner_lo, hi - 2))
    inner_hi = min(hi, max(inner_hi, inner_lo + 2))
    return inner_lo, inner_hi


def world_frame(world: str, *, rotate_key: str = "") -> dict[str, str]:
    theme = "sci-fi" if world == "sci-fi" else "fantasy"
    catalog = _FRAMES[theme]
    idx = abs(hash(f"{theme}|{rotate_key}")) % len(catalog)
    marco, tts = catalog[idx]
    return {"marco": marco, "tts": tts}


def build_tutor_context_block(
    learning: dict[str, Any] | None,
    weak_points: list[dict[str, Any]] | None = None,
) -> str:
    blob = learning if isinstance(learning, dict) else {}
    dictation = blob.get("dictation") if isinstance(blob.get("dictation"), dict) else {}
    lines = ["## Contexto del tutor"]
    tags = dictation.get("focus_tags") if isinstance(dictation.get("focus_tags"), list) else []
    valid_tags = [str(t) for t in tags if str(t) in FOCUS_TAGS]
    if valid_tags:
        lines.append("Chips de dictado: " + ", ".join(valid_tags))
    note = str(dictation.get("focus_note") or "").strip()
    if note:
        lines.append(f"Nota de dictado: {note}")
    notes = blob.get("subject_notes") if isinstance(blob.get("subject_notes"), list) else []
    for row in notes:
        if not isinstance(row, dict):
            continue
        if str(row.get("subject_id") or "") != "language":
            continue
        lang_note = str(row.get("note") or "").strip()
        if lang_note:
            lines.append(f"Nota de lengua: {lang_note}")
    general = str(blob.get("general_note") or "").strip()
    if general and any(hint in general.lower() for hint in _WRITING_HINTS):
        lines.append(f"Nota general: {general}")
    for point in (weak_points or [])[:5]:
        label = str(point.get("label") or point.get("tag") or "").strip()
        if label:
            lines.append(f"Debilidad: {label}")
    return "\n".join(lines)
