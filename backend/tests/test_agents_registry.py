from __future__ import annotations

from app.ai.agents.registry import build_agent, known_purposes, resolve_output_type
from app.ai.agents.envelopes import DialogueEnvelope


def test_known_purposes_include_mentor() -> None:
    purposes = known_purposes()
    assert "mentor_guide" in purposes
    assert "onboarding_host" in purposes


def test_build_agent_with_test_model_no_skills_network() -> None:
    agent = build_agent("mentor_guide", model="test", load_skills=False)
    assert resolve_output_type("mentor_guide") is DialogueEnvelope
    result = agent.run_sync("Di hola en una frase corta.")
    # TestModel returns a structured-ish payload; ensure run completes.
    assert result.output is not None
