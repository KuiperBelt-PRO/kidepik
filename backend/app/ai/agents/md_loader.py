"""Carga definiciones de agentes desde backend/agents/*.md (frontmatter YAML)."""
from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

_AGENTS_DIR = Path(__file__).resolve().parents[3] / "agents"


@dataclass(frozen=True)
class AgentSpec:
    id: str
    role: str
    purpose: str
    model_tier: str = "quality"
    skills: tuple[str, ...] = ()
    output: str = "DialogueEnvelope"
    tools: tuple[str, ...] = ()
    instructions: str = ""
    raw: dict[str, Any] = field(default_factory=dict, compare=False)


def agents_dir() -> Path:
    return _AGENTS_DIR


def _parse_md(path: Path) -> AgentSpec:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        raise ValueError(f"agent md missing frontmatter: {path.name}")
    parts = text.split("---", 2)
    if len(parts) < 3:
        raise ValueError(f"agent md frontmatter invalid: {path.name}")
    meta = yaml.safe_load(parts[1]) or {}
    if not isinstance(meta, dict):
        raise ValueError(f"agent md frontmatter not mapping: {path.name}")
    agent_id = str(meta.get("id") or path.stem)
    purpose = str(meta.get("purpose") or agent_id)
    skills = meta.get("skills") or []
    tools = meta.get("tools") or []
    return AgentSpec(
        id=agent_id,
        role=str(meta.get("role") or "agent"),
        purpose=purpose,
        model_tier=str(meta.get("model_tier") or "quality"),
        skills=tuple(str(s) for s in skills),
        output=str(meta.get("output") or "DialogueEnvelope"),
        tools=tuple(str(t) for t in tools),
        instructions=parts[2].strip(),
        raw=meta,
    )


@lru_cache(maxsize=1)
def load_all_agent_specs() -> dict[str, AgentSpec]:
    root = agents_dir()
    if not root.is_dir():
        return {}
    out: dict[str, AgentSpec] = {}
    for path in sorted(root.glob("*.md")):
        spec = _parse_md(path)
        out[spec.purpose] = spec
        out[spec.id] = spec
    return out


def get_agent_spec(purpose: str) -> AgentSpec | None:
    return load_all_agent_specs().get(purpose)


def clear_agent_spec_cache() -> None:
    load_all_agent_specs.cache_clear()
