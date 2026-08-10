"""Ejecución genérica de purposes vía GeminiGateway + Pydantic AI."""
from __future__ import annotations

from typing import Any, TypeVar

from app.ai.agents.audience_prompt import prepend_audience_block
from app.ai.agents.envelopes import DialogueEnvelope
from app.ai.agents.registry import build_agent, resolve_output_type
from app.ai.errors import AiProductError, product_error
from app.ai.gemini_gateway import GeminiGateway
from app.ai.mentors.loader import load_mentor_body
from app.catalogs.explorer_gender import gender_grammar_prompt_block
from app.config import Settings, get_settings
from app.logging_ import AppLogger

compose_log = AppLogger("ai")

T = TypeVar("T")


async def run_purpose(
    purpose: str,
    user_prompt: str,
    deps: RunDeps,
    *,
    settings: Settings | None = None,
    gateway: GeminiGateway | None = None,
    expect_type: type | None = None,
) -> tuple[Any, str]:
    cfg = settings or get_settings()
    gw = gateway or GeminiGateway(cfg)
    expected = expect_type or resolve_output_type(purpose)
    user_prompt = prepend_audience_block(
        user_prompt,
        age_years=deps.audience.age_years,
        age_band=deps.age_band or deps.audience.age_band,
    )

    async def _runner(model_id: str) -> Any:
        agent = build_agent(
            purpose,
            model=gw.model_string(model_id),
            settings=cfg,
            load_skills=True,
        )
        try:
            result = await agent.run(user_prompt, deps=deps)
        except AiProductError:
            raise
        except Exception as exc:  # noqa: BLE001
            compose_log.warning(
                "compose_exception",
                purpose=purpose,
                model=model_id,
                error=f"{type(exc).__name__}: {exc}"[:500],
            )
            raise product_error("ai_compose_failed", model=model_id) from exc
        output = result.output
        if not isinstance(output, expected):
            raise product_error("ai_compose_failed", model=model_id)
        text = getattr(output, "agent_text", None) or getattr(
            output, "summary_markdown", None
        )
        if isinstance(text, str) and not text.strip() and expected in {
            DialogueEnvelope,
        }:
            raise product_error("ai_compose_failed", model=model_id)
        if expected.__name__ == "TravelerProfileEnvelope":
            from app.ai.agents.envelopes import TravelerProfileEnvelope

            if isinstance(output, TravelerProfileEnvelope) and not output.agent_text.strip():
                raise product_error("ai_compose_failed", model=model_id)
        return output

    return await gw.run_with_model_list(
        purpose,
        _runner,
        child_id=str(deps.child_id),
    )


async def run_dialogue_purpose(
    purpose: str,
    user_prompt: str,
    deps: RunDeps,
    *,
    settings: Settings | None = None,
    gateway: GeminiGateway | None = None,
) -> tuple[DialogueEnvelope, str]:
    envelope, model_used = await run_purpose(
        purpose,
        user_prompt,
        deps,
        settings=settings,
        gateway=gateway,
        expect_type=DialogueEnvelope,
    )
    if deps.ledger is not None and deps.parent_id is not None:
        deps.ledger.append_event(
            str(deps.parent_id),
            str(deps.child_id),
            deps.session_id,
            kind="mentor_utterance",
            text=envelope.agent_text,
            purpose=purpose,
            model=model_used,
            payload={
                "input_mode": envelope.input_mode,
                "options": [o.model_dump() for o in envelope.options],
                "meta": envelope.meta,
            },
        )
    return envelope, model_used


def build_mentor_prompt(deps: RunDeps, explorer_reply: str | None = None) -> str:
    parts = [
        f"purpose={deps.purpose}",
        f"world_theme={deps.world_theme}",
        f"age_band={deps.age_band or deps.audience.age_band}",
        f"age_years={deps.audience.age_years}",
        f"player_state={deps.player_state}",
    ]
    if deps.mentor:
        parts.append(f"mentor={deps.mentor}")
        mentor_id = deps.mentor.get("mentor_id")
        if isinstance(mentor_id, str) and mentor_id:
            body = load_mentor_body(mentor_id)
            if body:
                parts.append(f"MENTOR_PROFILE:\n{body}")
    gender = deps.player_state.get("explorer_gender")
    if gender in {"male", "female"}:
        parts.append(
            gender_grammar_prompt_block(
                gender,
                deps.player_state.get("display_name"),
            )
        )
    if explorer_reply:
        parts.append(f"explorer_reply={explorer_reply}")
    parts.append(
        "agent_text admite markdown ligero: **negrita**, *cursiva*; sin encabezados ni listas largas. "
        "No escapes asteriscos (mal: \\*\\*palabra\\*\\*); escribe **palabra** directamente. "
        "Reserva la negrita para 1-2 palabras clave, no toda la frase."
    )
    parts.append(
        "Genera la siguiente burbuja del mentor (DialogueEnvelope) coherente con el estado."
    )
    return "\n".join(parts)


def build_character_coach_prompt(
    deps: RunDeps,
    *,
    explorer_choice: str,
    extra_hint: str | None = None,
) -> str:
    """Prompt unificado para character_coach (audiencia la añade run_purpose)."""
    age_years = deps.audience.age_years
    age_band = deps.age_band or deps.audience.age_band
    parts = [
        f"purpose={deps.purpose}",
        f"world_theme={deps.world_theme}",
        f"age_band={age_band}",
        f"age_years={age_years}",
        (
            "El explorador describe su forma. Genera TravelerProfileEnvelope: "
            "species, palette, features, abilities, vibe, y secciones markdown "
            "(description_md, outfit_md, personality_md, abilities_md)."
        ),
        f"Respuesta del explorador: {explorer_choice!r}.",
        (
            "agent_text: confirma en 2ª persona (tú eres…) con las mismas palabras "
            "sencillas que usaría un niño de su edad. input_mode=continue. "
            "Castellano de España."
        ),
    ]
    if extra_hint:
        parts.append(f"Corrección obligatoria: {extra_hint}")
    return "\n".join(parts)
