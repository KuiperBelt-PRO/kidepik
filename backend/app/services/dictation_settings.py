"""Ajustes tutor de dictado (`children.settings.learning.dictation`).

SPEC_APP_DICTATION §2.
"""
from __future__ import annotations

from typing import Any

FOCUS_TAGS: tuple[str, ...] = (
    "accentuation",
    "b_v",
    "g_j",
    "h_muda",
    "c_z_s",
    "ll_y",
    "r_rr",
    "mayusculas",
    "puntuacion",
    "palabras_dificiles",
)
FOCUS_TAG_SET = frozenset(FOCUS_TAGS)
TRIGGERS = frozenset({"every_n_paths", "language_paths_only", "random"})
DEFAULT_EVERY_N = 3
MIN_EVERY_N = 3
MAX_EVERY_N = 10
DEFAULT_RANDOM_P = 0.4
MIN_RANDOM_P = 0.25
MAX_RANDOM_P = 0.75
DEFAULT_MAX_ATTEMPTS = 3
MIN_MAX_ATTEMPTS = 2
MAX_MAX_ATTEMPTS = 5
FOCUS_NOTE_MAX_LEN = 400
MAX_FOCUS_TAGS = 6
RUNTIME_KEYS = frozenset(
    {
        "last_gate_path_count",
        "enabled_at_path_count",
        "offer_skips",
        "orthography_level_id",
        "orthography_rolling",
    }
)


def effective_dictation_settings(raw: object) -> dict[str, Any]:
    """Objeto completo; ausente o inválido → enabled false y defaults."""
    base: dict[str, Any] = {
        "enabled": False,
        "trigger": "every_n_paths",
        "every_n": DEFAULT_EVERY_N,
        "random_p": DEFAULT_RANDOM_P,
        "focus_note": "",
        "focus_tags": [],
        "max_attempts": DEFAULT_MAX_ATTEMPTS,
        "last_gate_path_count": None,
        "enabled_at_path_count": None,
        "offer_skips": 0,
        "orthography_level_id": "L1",
        "orthography_rolling": 0.1,
    }
    if not isinstance(raw, dict):
        return base
    enabled = raw.get("enabled") is True
    trigger = str(raw.get("trigger") or "").strip()
    if trigger not in TRIGGERS:
        trigger = "every_n_paths"
    every_n = raw.get("every_n")
    if type(every_n) is int and MIN_EVERY_N <= every_n <= MAX_EVERY_N:
        n = every_n
    else:
        n = DEFAULT_EVERY_N
    random_p = raw.get("random_p")
    if isinstance(random_p, (int, float)) and not isinstance(random_p, bool):
        p = float(random_p)
        if MIN_RANDOM_P <= p <= MAX_RANDOM_P:
            pass
        else:
            p = DEFAULT_RANDOM_P
    else:
        p = DEFAULT_RANDOM_P
    max_attempts = raw.get("max_attempts")
    if type(max_attempts) is int and MIN_MAX_ATTEMPTS <= max_attempts <= MAX_MAX_ATTEMPTS:
        attempts = max_attempts
    else:
        attempts = DEFAULT_MAX_ATTEMPTS
    tags: list[str] = []
    seen: set[str] = set()
    raw_tags = raw.get("focus_tags")
    if isinstance(raw_tags, list):
        for item in raw_tags:
            tag = str(item).strip()
            if tag in FOCUS_TAG_SET and tag not in seen and len(tags) < MAX_FOCUS_TAGS:
                tags.append(tag)
                seen.add(tag)
    note = str(raw.get("focus_note") or "").strip()[:FOCUS_NOTE_MAX_LEN]
    last_gate = raw.get("last_gate_path_count")
    enabled_at = raw.get("enabled_at_path_count")
    skips = raw.get("offer_skips")
    ortho_level = str(raw.get("orthography_level_id") or "L1").strip() or "L1"
    ortho_rolling = raw.get("orthography_rolling")
    if not (isinstance(ortho_rolling, (int, float)) and not isinstance(ortho_rolling, bool)):
        ortho_rolling = 0.1
    return {
        "enabled": enabled,
        "trigger": trigger,
        "every_n": n,
        "random_p": p,
        "focus_note": note,
        "focus_tags": tags,
        "max_attempts": attempts,
        "last_gate_path_count": last_gate if type(last_gate) is int else None,
        "enabled_at_path_count": enabled_at if type(enabled_at) is int else None,
        "offer_skips": skips if type(skips) is int and skips >= 0 else 0,
        "orthography_level_id": ortho_level,
        "orthography_rolling": float(ortho_rolling),
    }


def is_offer_mandatory(settings: dict[str, Any] | None) -> bool:
    blob = settings if isinstance(settings, dict) else {}
    if blob.get("enabled") is not True:
        return False
    every_n = blob.get("every_n")
    n = every_n if type(every_n) is int else DEFAULT_EVERY_N
    n = max(MIN_EVERY_N, min(MAX_EVERY_N, n))
    skips = blob.get("offer_skips")
    count = skips if type(skips) is int else 0
    return count >= n


def normalize_dictation_patch(
    incoming: object,
    existing: dict[str, Any] | None = None,
    *,
    completed_path_count: int | None = None,
) -> dict[str, Any]:
    """Fusiona el PATCH tutor. Rechaza valores fuera de contrato.

    Raises
    ------
    ValueError
        Clave o valor inválido.
    """
    if not isinstance(incoming, dict):
        raise ValueError("learning.dictation invalid")
    prev = effective_dictation_settings(existing)
    was_enabled = bool(existing and existing.get("enabled") is True)

    if "enabled" in incoming:
        if incoming["enabled"] is not True and incoming["enabled"] is not False:
            raise ValueError("learning.dictation.enabled invalid")
        prev["enabled"] = incoming["enabled"]

    if "trigger" in incoming:
        trigger = incoming["trigger"]
        if not isinstance(trigger, str) or trigger not in TRIGGERS:
            raise ValueError("learning.dictation.trigger invalid")
        prev["trigger"] = trigger

    if "every_n" in incoming:
        raw_n = incoming["every_n"]
        if isinstance(raw_n, bool) or type(raw_n) is not int:
            raise ValueError("learning.dictation.every_n invalid")
        if raw_n < MIN_EVERY_N or raw_n > MAX_EVERY_N:
            raise ValueError("learning.dictation.every_n invalid")
        prev["every_n"] = raw_n

    if "random_p" in incoming:
        raw_p = incoming["random_p"]
        if isinstance(raw_p, bool) or not isinstance(raw_p, (int, float)):
            raise ValueError("learning.dictation.random_p invalid")
        p = float(raw_p)
        if p < MIN_RANDOM_P or p > MAX_RANDOM_P:
            raise ValueError("learning.dictation.random_p invalid")
        prev["random_p"] = p

    if "max_attempts" in incoming:
        raw_a = incoming["max_attempts"]
        if isinstance(raw_a, bool) or type(raw_a) is not int:
            raise ValueError("learning.dictation.max_attempts invalid")
        if raw_a < MIN_MAX_ATTEMPTS or raw_a > MAX_MAX_ATTEMPTS:
            raise ValueError("learning.dictation.max_attempts invalid")
        prev["max_attempts"] = raw_a

    if "focus_note" in incoming:
        if incoming["focus_note"] is None:
            prev["focus_note"] = ""
        elif not isinstance(incoming["focus_note"], str):
            raise ValueError("learning.dictation.focus_note invalid")
        else:
            note = incoming["focus_note"].strip()
            if len(note) > FOCUS_NOTE_MAX_LEN:
                raise ValueError("learning.dictation.focus_note invalid")
            prev["focus_note"] = note

    if "focus_tags" in incoming:
        raw_tags = incoming["focus_tags"]
        if raw_tags is None:
            prev["focus_tags"] = []
        elif not isinstance(raw_tags, list):
            raise ValueError("learning.dictation.focus_tags invalid")
        else:
            tags: list[str] = []
            seen: set[str] = set()
            for item in raw_tags:
                tag = str(item).strip() if item is not None else ""
                if not tag or tag not in FOCUS_TAG_SET or tag in seen:
                    continue
                if len(tags) >= MAX_FOCUS_TAGS:
                    break
                tags.append(tag)
                seen.add(tag)
            prev["focus_tags"] = tags

    if prev["enabled"] and existing is None and "trigger" not in incoming:
        prev["trigger"] = "every_n_paths"
        if "every_n" not in incoming:
            prev["every_n"] = DEFAULT_EVERY_N

    turning_on = prev["enabled"] is True and not was_enabled
    floor = 0 if completed_path_count is None else max(0, int(completed_path_count))
    if turning_on:
        prev["enabled_at_path_count"] = floor
        prev["last_gate_path_count"] = floor
        prev["offer_skips"] = 0
    else:
        if existing and type(existing.get("last_gate_path_count")) is int:
            prev["last_gate_path_count"] = existing["last_gate_path_count"]
        if existing and type(existing.get("enabled_at_path_count")) is int:
            prev["enabled_at_path_count"] = existing["enabled_at_path_count"]
        if existing and type(existing.get("offer_skips")) is int:
            prev["offer_skips"] = max(0, existing["offer_skips"])
        if existing and existing.get("orthography_level_id"):
            prev["orthography_level_id"] = str(existing["orthography_level_id"])
        if existing and isinstance(existing.get("orthography_rolling"), (int, float)):
            prev["orthography_rolling"] = float(existing["orthography_rolling"])

    return prev
