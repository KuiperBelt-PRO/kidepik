from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.services.journey_memory import JourneyMemoryService
from tests.helpers.db_session import FakeExecuteResult, ScriptedSession
from tests.helpers.factories import CHILD_ID, PARENT_ID


@pytest.mark.unit
@pytest.mark.asyncio
async def test_maybe_condense_skips_when_not_due(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    session = ScriptedSession([FakeExecuteResult(scalar=2)])
    svc = JourneyMemoryService(session)
    result = await svc.maybe_condense(CHILD_ID, every_n=3)
    assert result["wrote"] is False
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_condense_now_writes_summary(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    session = ScriptedSession(
        [
            FakeExecuteResult(rows=[{"sequence_num": 1, "narrative_text": "Beat uno"}]),
            FakeExecuteResult(),
            FakeExecuteResult(scalar=PARENT_ID),
        ]
    )
    svc = JourneyMemoryService(session)
    result = await svc.condense_now(CHILD_ID)
    assert result["wrote"] is True
    assert "Beat uno" in (result["summary"] or "")
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_latest_summary_text_from_db(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    session = ScriptedSession(
        [
            FakeExecuteResult(scalar=None),
            FakeExecuteResult(scalar="Resumen PG"),
        ]
    )
    svc = JourneyMemoryService(session)
    text = await svc.latest_summary_text(CHILD_ID)
    assert text == "Resumen PG"
    get_settings.cache_clear()
