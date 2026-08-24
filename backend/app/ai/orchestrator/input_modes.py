"""Resolución normativa de input_mode por fase (SPEC_APP_ADVENTURE_DIALOGUE §1.1)."""
from __future__ import annotations

from typing import Literal

from app.ai.agents.envelopes import DialogueEnvelope, DialogueOption

InputMode = Literal[
    "options_only",
    "text_only",
    "options_or_text",
    "continue",
    "blocked",
]

# Contrato servidor: la fase manda sobre el default del LLM.
PHASE_INPUT_MODE: dict[str, InputMode] = {
    "choose_world": "options_only",
    "choose_name": "text_only",
    "choose_age": "options_or_text",
    "choose_gender": "options_only",
    "choose_character_species": "options_or_text",
    "choose_character": "options_or_text",
    "handoff_placement": "continue",
    "placement_item": "options_only",
    "placement_feedback": "continue",
    "choose_path": "options_or_text",
    "path_intro": "options_or_text",
}


def resolve_input_mode(
    phase: str | None,
    envelope_mode: str,
    force: str | None = None,
) -> InputMode:
    if force in {
        "options_only",
        "text_only",
        "options_or_text",
        "continue",
        "blocked",
    }:
        return force  # type: ignore[return-value]
    if phase and phase in PHASE_INPUT_MODE:
        return PHASE_INPUT_MODE[phase]
    if envelope_mode in {
        "options_only",
        "text_only",
        "options_or_text",
        "continue",
        "blocked",
    }:
        return envelope_mode  # type: ignore[return-value]
    return "continue"


def normalize_dialogue_envelope(
    phase: str | None,
    envelope: DialogueEnvelope,
    *,
    force_input_mode: str | None = None,
    force_options: list[dict[str, str]] | None = None,
) -> DialogueEnvelope:
    """Alinea envelope con fase y limpia opciones incoherentes."""
    mode = resolve_input_mode(phase, envelope.input_mode, force_input_mode)
    options: list[DialogueOption] = []
    if force_options:
        options = [
            DialogueOption(
                id=str(o["id"]),
                label=str(o.get("label") or o["id"]),
                description=o.get("description"),
            )
            for o in force_options
        ]
    elif mode != "text_only":
        options = list(envelope.options)
        options = [
            o
            for o in options
            if str(o.id).lower() != "continue"
            and str(o.label or "").strip().lower() != "continuar"
        ]

    if mode == "text_only":
        options = []
    elif mode == "continue" and not options:
        options = []

    return envelope.model_copy(update={"input_mode": mode, "options": options})
