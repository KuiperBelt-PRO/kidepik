"""Deps tipadas para runs de agentes."""
from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.ai.journey.ledger import JourneyLedger


class AudienceContext(BaseModel):
    age_band: str | None = None
    age_years: int | None = None
    locale: str = "es-ES"


class RunDeps(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    child_id: UUID
    session_id: str
    purpose: str
    parent_id: UUID | None = None
    player_state: dict[str, Any] = Field(default_factory=dict)
    mentor: dict[str, Any] | None = None
    world_theme: Literal["fantasy", "sci-fi"] | None = None
    age_band: str | None = None
    audience: AudienceContext = Field(default_factory=AudienceContext)
    ledger: JourneyLedger | None = None
    catalogs: dict[str, Any] = Field(default_factory=dict)
