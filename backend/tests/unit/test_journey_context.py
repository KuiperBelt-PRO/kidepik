from __future__ import annotations

import pytest

from app.services.journey_context import JourneyContextPack
from tests.helpers.db_session import FakeExecuteResult, ScriptedSession
from tests.helpers.factories import CHILD_ID


@pytest.mark.unit
@pytest.mark.asyncio
async def test_journey_context_build_truncates() -> None:
    session = ScriptedSession(
        [
            FakeExecuteResult(scalar="Resumen largo del viaje"),
            FakeExecuteResult(
                rows=[
                    {"sequence": 1, "text": "beat " * 50, "kind": "scene"},
                    {"sequence": 2, "text": "beat2 " * 50, "kind": "scene"},
                ]
            ),
            FakeExecuteResult(
                rows=[
                    {"sequence": 1, "role": "mentor", "text": "hola " * 80},
                    {"sequence": 2, "role": "explorer", "text": "respuesta " * 80},
                ]
            ),
        ]
    )
    pack = await JourneyContextPack(session).build(CHILD_ID, max_chars=500)
    assert pack["journey_summary"] == "Resumen largo del viaje"
    assert pack["truncated"] is True


@pytest.mark.unit
def test_journey_context_to_prompt_block() -> None:
    block = JourneyContextPack.to_prompt_block(
        {
            "journey_summary": "Resumen",
            "recent_beats": [{"sequence": 1, "kind": "scene", "text": "Llegaste"}],
            "recent_turns": [{"role": "mentor", "text": "Hola"}],
        }
    )
    assert "JOURNEY_CONDENSED" in block
    assert "Llegaste" in block
