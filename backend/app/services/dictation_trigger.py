"""Cuándo dispara el gate de dictado (D5 / D5b)."""
from __future__ import annotations

import hashlib
import json
from typing import Any

from app.ai.journey.ledger import JourneyLedger
from app.services.dictation_settings import MIN_EVERY_N, MAX_EVERY_N


def is_completed_path_progress(row: dict[str, Any]) -> bool:
    if row.get("kind") != "path_progress":
        return False
    payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
    path = payload.get("path") if isinstance(payload.get("path"), dict) else {}
    challenges = path.get("challenges") or []
    if not isinstance(challenges, list) or not challenges:
        return False
    if payload.get("last_ok") is not True:
        return False
    try:
        idx = int(payload.get("challenge_index") or 0)
    except (TypeError, ValueError):
        return False
    return idx >= len(challenges)


def count_path_completions(
    ledger: JourneyLedger,
    parent_id: str,
    child_id: str,
    world: str,
) -> int:
    total = 0
    for sessions_dir in ledger._sessions_dirs(
        parent_id, child_id, world_theme=world
    ):
        if not sessions_dir.is_dir():
            continue
        for session_path in sessions_dir.iterdir():
            events_file = session_path / "events.jsonl"
            if not events_file.is_file():
                continue
            with events_file.open(encoding="utf-8") as handle:
                for line in handle:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        row = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if is_completed_path_progress(row):
                        total += 1
    return total


def _stable_unit(child_id: str, world: str, path_id: str) -> float:
    digest = hashlib.sha256(
        f"{child_id}|{world}|{path_id}".encode("utf-8")
    ).digest()
    value = int.from_bytes(digest[:8], "big")
    return value / float(2**64)


def should_trigger_dictation(
    settings: dict[str, Any],
    *,
    completed_path_count: int,
    subject_id: str,
    child_id: str,
    world: str,
    path_id: str,
) -> bool:
    if not settings.get("enabled"):
        return False
    completed = max(0, int(completed_path_count))
    last_gate = settings.get("last_gate_path_count")
    if type(last_gate) is not int:
        last_gate = settings.get("enabled_at_path_count")
    if type(last_gate) is int:
        gap = completed - last_gate
    else:
        gap = completed
    if gap < MIN_EVERY_N:
        return False
    trigger = str(settings.get("trigger") or "every_n_paths")
    every_n = settings.get("every_n")
    n = every_n if type(every_n) is int else MIN_EVERY_N
    n = max(MIN_EVERY_N, min(MAX_EVERY_N, n))
    if trigger == "every_n_paths":
        return gap >= n
    if trigger == "language_paths_only":
        return str(subject_id or "") == "language"
    if trigger == "random":
        p = settings.get("random_p")
        try:
            threshold = float(p)
        except (TypeError, ValueError):
            threshold = 0.4
        return _stable_unit(child_id, world, path_id) < threshold
    return False
