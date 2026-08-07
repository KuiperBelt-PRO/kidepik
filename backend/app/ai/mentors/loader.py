"""Carga fichas literales de mentor desde backend/agents/mentors/*.es.md."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

_MENTORS_DIR = Path(__file__).resolve().parents[3] / "agents" / "mentors"


def mentors_dir() -> Path:
    return _MENTORS_DIR


@lru_cache(maxsize=32)
def load_mentor_body(mentor_id: str) -> str:
    path = mentors_dir() / f"{mentor_id}.es.md"
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8").strip()


def clear_mentor_cache() -> None:
    load_mentor_body.cache_clear()
