"""Loader de skills de producto → Capability nativa Pydantic AI."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

# Skills que deben ir siempre en contexto (no defer) — reglas de producto críticas.
_EAGER_SKILL_IDS = frozenset({"audience-language", "mentor-prose-clarity"})

# Skills críticos por purpose (siempre en contexto para ese agente).
_PURPOSE_EAGER_SKILL_IDS: dict[str, frozenset[str]] = {
    "placement_item_writer": frozenset({"placement-exam", "subject-pedagogy"}),
}

PURPOSE_SKILL_IDS: dict[str, list[str]] = {
    "onboarding_host": ["onboarding-flow", "audience-language", "mentor-prose-clarity", "original-ip"],
    "mentor_guide": [
        "mentor-voice",
        "audience-language",
        "world-canon",
        "mentor-prose-clarity",
        "original-ip",
    ],
    "character_coach": [
        "character-traits",
        "mentor-voice",
        "audience-language",
        "mentor-prose-clarity",
        "original-ip",
    ],
    "placement_item_writer": [
        "placement-exam",
        "subject-pedagogy",
        "audience-language",
        "mentor-prose-clarity",
        "original-ip",
    ],
    "placement_text_scorer": ["evaluation-rubric"],
    "zone_pitch_writer": ["world-canon", "zone-pitches", "audience-language", "original-ip"],
    "path_composer": [
        "challenge-design",
        "subject-pedagogy",
        "world-canon",
        "zone-pitches",
        "audience-language",
        "original-ip",
    ],
    "zone_scene_writer": [
        "world-canon",
        "zone-bible",
        "npc-scenes",
        "mentor-voice",
        "audience-language",
        "original-ip",
    ],
    "adventure_narrator": [
        "world-canon",
        "zone-bible",
        "npc-scenes",
        "mentor-voice",
        "audience-language",
        "original-ip",
    ],
    "challenge_writer": [
        "challenge-design",
        "subject-pedagogy",
        "audience-language",
        "original-ip",
    ],
    "challenge_result_writer": [
        "challenge-design",
        "mentor-voice",
        "audience-language",
    ],
    "waiting_copy_writer": ["waiting-copy", "audience-language"],
    "journey_summarizer": ["journey-summary"],
    "safety_rewriter": ["safety-tone", "audience-language"],
}


def default_skills_root() -> Path:
    return Path(__file__).resolve().parents[3] / "skills"


def parse_skill_md(path: Path) -> dict[str, Any]:
    raw = path.read_text(encoding="utf-8-sig")
    if not raw.lstrip().startswith("---"):
        raise ValueError(f"skill missing frontmatter: {path}")
    raw = raw.lstrip()
    parts = raw.split("---", 2)
    if len(parts) < 3:
        raise ValueError(f"skill frontmatter invalid: {path}")
    meta = yaml.safe_load(parts[1]) or {}
    if not isinstance(meta, dict):
        raise ValueError(f"skill frontmatter not a mapping: {path}")
    body = parts[2].strip()
    skill_id = str(meta.get("id") or path.parent.name)
    description = str(meta.get("description") or skill_id)
    return {
        "id": skill_id,
        "description": description,
        "instructions": body,
        "meta": meta,
        "path": path,
    }


def load_skill_capability(path: Path, *, purpose: str | None = None) -> Any:
    from pydantic_ai.capabilities import Capability

    parsed = parse_skill_md(path)
    skill_id = parsed["id"]
    eager = skill_id in _EAGER_SKILL_IDS
    if purpose:
        eager = eager or skill_id in _PURPOSE_EAGER_SKILL_IDS.get(purpose, frozenset())
    return Capability(
        id=skill_id,
        description=parsed["description"],
        instructions=parsed["instructions"],
        defer_loading=not eager,
    )


def skill_ids_for(purpose: str) -> list[str]:
    return list(PURPOSE_SKILL_IDS.get(purpose, []))


def load_skills_for_purpose(
    purpose: str,
    *,
    root: Path | None = None,
) -> list[Any]:
    base = root or default_skills_root()
    caps: list[Any] = []
    for skill_id in skill_ids_for(purpose):
        path = base / skill_id / "SKILL.md"
        if not path.is_file():
            raise FileNotFoundError(f"missing skill: {path}")
        caps.append(load_skill_capability(path, purpose=purpose))
    return caps


def list_skill_directories(root: Path | None = None) -> list[str]:
    base = root or default_skills_root()
    if not base.is_dir():
        return []
    return sorted(
        p.name for p in base.iterdir() if p.is_dir() and (p / "SKILL.md").is_file()
    )
