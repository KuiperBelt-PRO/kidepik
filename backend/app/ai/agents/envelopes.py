"""Envelopes de salida tipados (SPEC_AI_PYDANTIC_AGENTS)."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class DialogueOption(BaseModel):
    id: str
    label: str
    description: str | None = None


class DialogueEnvelope(BaseModel):
    agent_text: str
    input_mode: Literal[
        "options_only",
        "text_only",
        "options_or_text",
        "continue",
        "blocked",
        "photo",
    ] = "continue"
    options: list[DialogueOption] = Field(default_factory=list)
    effects: list[dict[str, Any]] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)


class ScoreEnvelope(BaseModel):
    score: float = 0.0
    rationale: str = ""


class PlacementItemEnvelope(BaseModel):
    subject_id: str
    item_key: str
    item_type: Literal["mcq", "short_text", "true_false"] = "mcq"
    prompt_text: str
    presentation_text: str | None = None
    options: list[DialogueOption] = Field(default_factory=list)
    correct_option_id: str | None = None
    expected_answer: str | None = None
    success_feedback: str | None = None
    explanation: str | None = None

    @model_validator(mode="after")
    def validate_answer_fields(self) -> PlacementItemEnvelope:
        if self.item_type == "mcq":
            if len(self.options) < 2:
                raise ValueError("mcq_needs_options")
            if not str(self.correct_option_id or "").strip():
                raise ValueError("mcq_missing_correct_option_id")
        elif self.item_type == "short_text":
            if not str(self.expected_answer or "").strip():
                raise ValueError("short_text_missing_expected")
        return self


class PlacementQueueEnvelope(BaseModel):
    items: list[PlacementItemEnvelope] = Field(default_factory=list)


class ZonePitch(BaseModel):
    zone_id: str
    title: str
    pitch: str


class ZonePitchBundle(BaseModel):
    pitches: list[ZonePitch] = Field(default_factory=list)
    agent_text: str = ""


class PathNpc(BaseModel):
    """NPC del camino: guía que enseña o guardián que pone el reto."""

    npc_id: str
    name: str
    role: Literal["guide", "gatekeeper"] = "guide"
    one_line_voice: str = ""


class PathOption(BaseModel):
    path_id: str
    subject_id: str
    title: str
    intro: str
    learning_blurb: str = ""
    path_narrative: str = ""
    # Lección narrativa (teoría) mostrada al elegir el camino, antes de cualquier reto.
    lesson_narrative: str = ""
    npc: PathNpc | None = None


class PathChallengeSeed(BaseModel):
    prompt_text: str
    # Opcional y breve; la enseñanza vive en path.lesson_narrative, no aquí.
    narrative_wrapper: str = ""
    teaching_beat: str = ""
    npc_id: str | None = None
    item_type: Literal["mcq", "short_text", "true_false"] = "mcq"
    options: list[DialogueOption] = Field(default_factory=list)
    correct_option_id: str | None = None
    expected_answer: str | None = None
    explanation: str = ""

    @model_validator(mode="after")
    def validate_answer_fields(self) -> PathChallengeSeed:
        if self.item_type == "mcq":
            if len(self.options) < 2:
                raise ValueError("mcq_needs_options")
            if not str(self.correct_option_id or "").strip():
                raise ValueError("mcq_missing_correct_option_id")
        elif self.item_type == "short_text":
            if not str(self.expected_answer or "").strip():
                raise ValueError("short_text_missing_expected")
        return self


class PathDetail(BaseModel):
    path: PathOption
    challenges: list[PathChallengeSeed] = Field(default_factory=list)


class PathPackEnvelope(BaseModel):
    """Tres caminos sobre materias flojas (SPEC_APP_JOURNEY_MECHANICS)."""

    agent_text: str
    paths: list[PathDetail] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)


class ChallengeEnvelope(BaseModel):
    agent_text: str
    subject_id: str | None = None
    input_mode: Literal["options_only", "text_only", "options_or_text", "continue"] = "text_only"
    options: list[DialogueOption] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)


class ChallengeResultEnvelope(BaseModel):
    success_text: str
    near_miss_text: str = ""


class WaitingCopyBundle(BaseModel):
    lines: list[str] = Field(default_factory=list)


class SessionSummaryEnvelope(BaseModel):
    summary_markdown: str
    structured: dict[str, Any] = Field(default_factory=dict)


class TravelerProfileEnvelope(BaseModel):
    """Salida de character_coach: burbuja + ficha del viajero."""

    agent_text: str
    input_mode: Literal[
        "options_only",
        "text_only",
        "options_or_text",
        "continue",
        "blocked",
    ] = "continue"
    options: list[DialogueOption] = Field(default_factory=list)
    species: str
    palette: str
    features: list[str] = Field(default_factory=list)
    abilities: list[str] = Field(default_factory=list)
    vibe: str = ""
    description_md: str = ""
    outfit_md: str = ""
    personality_md: str = ""
    abilities_md: str = ""
    meta: dict[str, Any] = Field(default_factory=dict)


class DictationComposeEnvelope(BaseModel):
    theory_mentor: str
    canonical_text: str
    focus_applied: list[str] = Field(default_factory=list)
    weak_points_used: list[str] = Field(default_factory=list)
    tts_instruction: str = ""
    word_count: int = 0


class DictationGradeEnvelope(BaseModel):
    transcription: str = ""
    confidence: float = 0.0
    unreadable: bool = False
    mentor_text: str = ""
    error_hints: list[dict[str, Any]] = Field(default_factory=list)
