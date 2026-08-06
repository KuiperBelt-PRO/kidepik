"""Smoke E2E: mentor_guide + Gemini real + ledger JSONL."""
from __future__ import annotations

import asyncio
import uuid

from app.ai.agents.deps import AudienceContext, RunDeps
from app.ai.agents.runner import build_mentor_prompt, run_dialogue_purpose
from app.ai.gemini_gateway import GeminiGateway
from app.ai.journey.ledger import JourneyLedger
from app.config import get_settings


async def main() -> None:
    get_settings.cache_clear()
    settings = get_settings()
    if not settings.gemini_api_key_resolved():
        raise SystemExit("missing GOOGLE_API_KEY")

    parent = uuid.uuid4()
    child = uuid.uuid4()
    session = str(uuid.uuid4())
    ledger = JourneyLedger(settings.journey_data_dir)
    deps = RunDeps(
        child_id=child,
        parent_id=parent,
        session_id=session,
        purpose="mentor_guide",
        world_theme="fantasy",
        age_band="band_child",
        audience=AudienceContext(age_band="band_child", age_years=9),
        mentor={"id": "guardian", "name": "El Guardián"},
        player_state={"onboarding_step": "choose_name"},
        ledger=ledger,
    )
    prompt = build_mentor_prompt(deps)
    prompt += (
        "\nContexto: el explorador acaba de elegir fantasía. "
        "Salúdalo brevemente y pregunta cómo quiere llamarse. Máximo 3 frases."
    )
    envelope, model = await run_dialogue_purpose(
        "mentor_guide",
        prompt,
        deps,
        settings=settings,
        gateway=GeminiGateway(settings),
    )
    events = ledger.read_events(str(parent), str(child), session)
    print("ok=True")
    print(f"model={model}")
    print(f"input_mode={envelope.input_mode}")
    print(f"text_len={len(envelope.agent_text)}")
    print("text=" + envelope.agent_text[:500].replace("\n", " / "))
    print(f"events={len(events)}")
    print(f"parent={parent}")
    print(f"child={child}")
    print(f"session={session}")


if __name__ == "__main__":
    asyncio.run(main())
