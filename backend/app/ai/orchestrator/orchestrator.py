"""Orquestador central de play (SPEC_AI_CENTRAL_ORCHESTRATOR)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.ai.agents.deps import RunDeps
from app.ai.agents.envelopes import DialogueEnvelope, TravelerProfileEnvelope
from app.ai.agents.md_loader import get_agent_spec
from app.ai.agents.runner import build_mentor_prompt, run_purpose
from app.ai.gemini_gateway import GeminiGateway
from app.ai.orchestrator.tools import glossary_search, ledger_recent_stems
from app.ai.orchestrator.input_modes import normalize_dialogue_envelope
from app.ai.orchestrator.turn_context import TurnContext
from app.config import Settings, get_settings


@dataclass
class TurnResult:
    purpose: str
    output: Any
    model_used: str | None
    tool_notes: list[str]


class Orchestrator:
    """Decide rol, enriquece prompt con tools, ejecuta subagente vía gateway."""

    def __init__(
        self,
        *,
        settings: Settings | None = None,
        gateway: GeminiGateway | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.gateway = gateway or GeminiGateway(self.settings)

    def resolve_purpose(self, ctx: TurnContext) -> str:
        if ctx.purpose:
            return ctx.purpose
        phase = ctx.phase or ""
        world = ctx.world_theme
        if not world and phase in {"pending_entry", "choose_world", ""}:
            return "onboarding_host"
        if phase in {"choose_name", "choose_age", "choose_character_species"}:
            return "mentor_guide"
        if phase in {"choose_character", "character"}:
            return "character_coach"
        if phase in {"placement", "handoff_placement", "placement_compose"}:
            return "placement_item_writer"
        return "mentor_guide"

    def _tool_context(self, ctx: TurnContext, purpose: str) -> str:
        notes: list[str] = []
        chunks: list[str] = []
        spec = get_agent_spec(purpose)
        tools = spec.tools if spec else ()
        world = ctx.world_theme or "fantasy"
        if "glossary_search" in tools and world in {"fantasy", "sci-fi"}:
            is_character_choice = ctx.phase == "choose_character_species"
            limit = 18 if is_character_choice else 5
            hits = glossary_search(
                world,  # type: ignore[arg-type]
                limit=limit,
            )
            if hits:
                header = (
                    "Glosario de arquetipos (especies, profesiones, criaturas y referencias; "
                    "inspírate, no copies una lista cerrada):"
                    if is_character_choice
                    else "Glosario (tipos, no nombres propios):"
                )
                lines = [f"- {h.term}: {h.definition}" for h in hits]
                chunks.append(header + "\n" + "\n".join(lines))
                notes.append(f"glossary:{len(hits)}")
        if ctx.ledger and ctx.parent_id and "ledger_query" in tools:
            stems = ledger_recent_stems(
                ctx.ledger,
                str(ctx.parent_id),
                str(ctx.child_id),
                world_theme=world,
            )
            if stems:
                chunks.append(
                    "Evita repetir estos stems/keys recientes:\n- "
                    + "\n- ".join(stems[:12])
                )
                notes.append(f"stems:{len(stems)}")
        ctx.meta["tool_notes"] = notes
        return "\n\n".join(chunks)

    async def run(self, ctx: TurnContext) -> TurnResult:
        purpose = self.resolve_purpose(ctx)
        deps = ctx.deps
        if deps is None:
            raise ValueError("TurnContext.deps required")
        deps = deps.model_copy(update={"purpose": purpose})
        tool_block = self._tool_context(ctx, purpose)
        if purpose == "character_coach":
            user_prompt = ctx.extra_prompt or (
                "Genera TravelerProfileEnvelope a partir de la descripción del explorador."
            )
        else:
            user_prompt = build_mentor_prompt(deps, explorer_reply=ctx.explorer_reply)
            user_prompt += f"\nphase={ctx.phase}. Responde en el envelope tipado del purpose."
            if ctx.extra_prompt:
                user_prompt += f"\n{ctx.extra_prompt}"
            if ctx.force_input_mode:
                user_prompt += f"\ninput_mode debe ser {ctx.force_input_mode}."
        if tool_block:
            user_prompt += f"\n\nContexto de tools:\n{tool_block}"

        expect: type | None = None
        if purpose == "character_coach":
            expect = TravelerProfileEnvelope
        elif purpose in {
            "onboarding_host",
            "mentor_guide",
            "zone_scene_writer",
            "adventure_narrator",
            "safety_rewriter",
        }:
            expect = DialogueEnvelope

        output, model = await run_purpose(
            purpose,
            user_prompt,
            deps,
            settings=self.settings,
            gateway=self.gateway,
            expect_type=expect,
        )
        if isinstance(output, DialogueEnvelope):
            output = normalize_dialogue_envelope(
                ctx.phase,
                output,
                force_input_mode=ctx.force_input_mode,
                force_options=ctx.force_options,
            )
        return TurnResult(
            purpose=purpose,
            output=output,
            model_used=model,
            tool_notes=list(ctx.meta.get("tool_notes") or []),
        )
