"""Compose pedagógico de dictado."""
from __future__ import annotations

from typing import Any

from app.ai.agents.envelopes import DictationComposeEnvelope
from app.services.dictation_pedagogy import (
    build_tutor_context_block,
    word_count_range,
    world_frame,
)
from app.services.dictation_settings import effective_dictation_settings


def build_compose_prompt(
    child: dict[str, Any],
    weak_points: list[dict[str, Any]] | None = None,
) -> str:
    band = str(child.get("effective_age_band") or child.get("age_band") or "band_child")
    world = str(child.get("active_world_theme") or child.get("world_theme") or "fantasy")
    learning = (child.get("settings") or {}).get("learning") if isinstance(child.get("settings"), dict) else {}
    learning = learning if isinstance(learning, dict) else {}
    dictation = effective_dictation_settings(learning.get("dictation"))
    lo, hi = word_count_range(band, dictation.get("orthography_level_id") or "L1")
    frame = world_frame(world, rotate_key=str(child.get("id") or ""))
    ctx = build_tutor_context_block(learning, weak_points)
    return (
        f"Banda: {band}. Mundo: {world}. Marco: {frame['marco']}.\n"
        f"Nivel de ortografía independiente: {dictation.get('orthography_level_id') or 'L1'}.\n"
        f"Longitud del canónico: {lo}-{hi} palabras. Ortografía ES-ES (castellano de España) correcta.\n"
        f"Instrucción TTS sugerida: {frame['tts']} Idioma es-ES.\n"
        f"Foco chips: {', '.join(dictation['focus_tags']) or 'regla de la banda'}.\n"
        f"{ctx}\n"
        "Devuelve theory_mentor (visible, sin revelar el canónico) y canonical_text (interno)."
    )


async def compose_dictation(
    child: dict[str, Any],
    weak_points: list[dict[str, Any]] | None = None,
    *,
    runner=None,
) -> DictationComposeEnvelope:
    prompt = build_compose_prompt(child, weak_points)
    if runner is not None:
        out = await runner(prompt)
        if isinstance(out, DictationComposeEnvelope):
            return out
        return DictationComposeEnvelope.model_validate(out)
    from app.ai.agents.registry import build_agent
    from app.ai.gemini_gateway import GeminiGateway

    gateway = GeminiGateway()

    async def _run(model_id: str) -> DictationComposeEnvelope:
        agent = build_agent(
            "dictation_composer",
            model=gateway.model_string(model_id),
        )
        result = await agent.run(prompt)
        return result.output

    envelope, _model = await gateway.run_with_model_list(
        "dictation_composer",
        _run,
        child_id=str(child.get("id") or "") or None,
    )
    return envelope
