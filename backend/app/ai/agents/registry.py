"""Registry purpose → Agent Pydantic AI."""
from __future__ import annotations

from typing import Any

from pydantic_ai import Agent

from app.ai.agents.envelopes import (
    ChallengeEnvelope,
    ChallengeResultEnvelope,
    DialogueEnvelope,
    DictationComposeEnvelope,
    DictationGradeEnvelope,
    PathPackEnvelope,
    PlacementQueueEnvelope,
    ScoreEnvelope,
    SessionSummaryEnvelope,
    TravelerProfileEnvelope,
    WaitingCopyBundle,
    ZonePitchBundle,
)
from app.ai.skills.loader import PURPOSE_SKILL_IDS, load_skills_for_purpose
from app.config import Settings, get_settings

BASE_SYSTEM = (
    "Eres un agente de KidepiK. Responde siempre en castellano de España. "
    "Cumple el schema de salida. No inventes datos del tutor. "
    "Si age_years es 5–7 (band_early) o 8–10 (band_child), usa lenguaje de primaria "
    "(skill audience-language). "
    "Adapta el tono al world_theme (fantasy vs sci-fi) y a la fase del viaje."
)

_OUTPUT_BY_PURPOSE: dict[str, type] = {
    "onboarding_host": DialogueEnvelope,
    "mentor_guide": DialogueEnvelope,
    "character_coach": TravelerProfileEnvelope,
    "zone_scene_writer": DialogueEnvelope,
    "adventure_narrator": DialogueEnvelope,
    "placement_item_writer": PlacementQueueEnvelope,
    "placement_text_scorer": ScoreEnvelope,
    "zone_pitch_writer": ZonePitchBundle,
    "path_composer": PathPackEnvelope,
    "challenge_writer": ChallengeEnvelope,
    "challenge_result_writer": ChallengeResultEnvelope,
    "waiting_copy_writer": WaitingCopyBundle,
    "journey_summarizer": SessionSummaryEnvelope,
    "safety_rewriter": DialogueEnvelope,
    "dictation_composer": DictationComposeEnvelope,
    "dictation_grader": DictationGradeEnvelope,
}


def known_purposes() -> list[str]:
    return sorted(PURPOSE_SKILL_IDS.keys())


def resolve_output_type(purpose: str) -> type:
    return _OUTPUT_BY_PURPOSE.get(purpose, DialogueEnvelope)


def build_agent(
    purpose: str,
    *,
    model: str,
    settings: Settings | None = None,
    load_skills: bool = True,
) -> Agent[Any, Any]:
    _ = settings or get_settings()
    if purpose not in PURPOSE_SKILL_IDS:
        raise KeyError(f"unknown purpose: {purpose}")
    capabilities = load_skills_for_purpose(purpose) if load_skills else []
    from app.ai.agents.md_loader import get_agent_spec

    spec = get_agent_spec(purpose)
    extra = f"\n\n{spec.instructions}" if spec and spec.instructions else ""
    return Agent(
        model,
        output_type=resolve_output_type(purpose),
        instructions=f"{BASE_SYSTEM}\nPurpose: {purpose}.{extra}",
        capabilities=capabilities,
    )
