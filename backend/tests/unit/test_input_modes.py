"""Tests input_modes resolver."""
from __future__ import annotations

from app.ai.agents.envelopes import DialogueEnvelope, DialogueOption
from app.ai.orchestrator.input_modes import normalize_dialogue_envelope, resolve_input_mode


def test_resolve_input_mode_by_phase_overrides_llm() -> None:
    assert resolve_input_mode("choose_name", "continue") == "text_only"
    assert resolve_input_mode("choose_character_species", "continue") == "options_or_text"
    assert resolve_input_mode("handoff_placement", "text_only") == "continue"


def test_normalize_strips_continue_for_species_chips() -> None:
    forced = [
        {"id": "spark", "label": "Chispa de niebla"},
        {"id": "drake", "label": "Dragón pequeño"},
        {"id": "guardian", "label": "Guardián del claro"},
    ]
    envelope = DialogueEnvelope(
        agent_text="Elige una forma o descríbela.",
        input_mode="continue",
        options=[DialogueOption(id="continue", label="Continuar")],
    )
    out = normalize_dialogue_envelope(
        "choose_character_species",
        envelope,
        force_options=forced,
    )
    assert out.input_mode == "options_or_text"
    assert len(out.options) == 3
    assert all(o.id != "continue" for o in out.options)


def test_normalize_keeps_age_options() -> None:
    forced = [{"id": "8", "label": "8"}, {"id": "10", "label": "10"}]
    envelope = DialogueEnvelope(agent_text="¿Cuántos años tienes?", input_mode="continue")
    out = normalize_dialogue_envelope(
        "choose_age",
        envelope,
        force_input_mode="options_or_text",
        force_options=forced,
    )
    assert out.input_mode == "options_or_text"
    assert len(out.options) == 2
