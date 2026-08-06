"""Contexto de turno para el orquestador central."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from app.ai.agents.deps import RunDeps
from app.ai.gemini_gateway import GeminiGateway
from app.ai.journey.ledger import JourneyLedger
from app.config import Settings


@dataclass
class TurnContext:
    child: dict[str, Any]
    session_id: str
    flow_id: str
    sequence: int
    phase: str
    purpose: str
    explorer_reply: str | None = None
    extra_prompt: str | None = None
    force_options: list[dict[str, Any]] | None = None
    force_input_mode: str | None = None
    deps: RunDeps | None = None
    settings: Settings | None = None
    gateway: GeminiGateway | None = None
    ledger: JourneyLedger | None = None
    meta: dict[str, Any] = field(default_factory=dict)

    @property
    def child_id(self) -> UUID:
        return UUID(str(self.child["id"]))

    @property
    def parent_id(self) -> UUID | None:
        pid = self.child.get("parent_id")
        return UUID(str(pid)) if pid else None

    @property
    def world_theme(self) -> str | None:
        return self.child.get("active_world_theme") or self.child.get("world_theme")
