from __future__ import annotations

import pytest

from app.services.journey_timeline import JourneyTimelineService
from tests.helpers.db_session import FakeExecuteResult, ScriptedSession
from tests.helpers.factories import CHILD_ID, PARENT_ID

SESSION_ID = "33333333-3333-4333-8333-333333333333"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_timeline_page_from_ledger(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.ai.journey.ledger import JourneyLedger
    from app.config import get_settings

    get_settings.cache_clear()
    ledger = JourneyLedger(tmp_path)
    ledger.append_dialogue(PARENT_ID, CHILD_ID, SESSION_ID, kind="explorer_reply", text="hola")
    session = ScriptedSession(
        [
            FakeExecuteResult(
                rows={
                    "id": CHILD_ID,
                    "parent_id": PARENT_ID,
                    "display_name": "Ada",
                    "world_theme": "fantasy",
                }
            )
        ]
    )
    svc = JourneyTimelineService(session)
    page = await svc.page(CHILD_ID, limit=10)
    assert page["events"]
    assert page["events"][0]["kind"] == "explorer_reply"
    get_settings.cache_clear()
