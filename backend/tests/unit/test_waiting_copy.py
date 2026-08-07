from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.services.waiting_copy import WaitingCopyService
from tests.helpers.db_session import FakeExecuteResult, ScriptedSession
from tests.helpers.factories import CHILD_ID


@pytest.mark.unit
@pytest.mark.asyncio
async def test_cached_lines_empty_without_row() -> None:
    session = ScriptedSession([FakeExecuteResult(rows=None)])
    svc = WaitingCopyService(session)
    assert await svc.cached_lines(CHILD_ID, "general") == []


@pytest.mark.unit
@pytest.mark.asyncio
async def test_cached_lines_returns_fresh_cache() -> None:
    now = datetime.now(timezone.utc).isoformat()
    session = ScriptedSession(
        [
            FakeExecuteResult(
                rows={
                    "settings": {
                        "play_waiting_cache": {
                            "general": {
                                "generated_at": now,
                                "ttl_hours": 24,
                                "lines": ["Un momento...", "Preparando..."],
                            }
                        }
                    }
                }
            )
        ]
    )
    svc = WaitingCopyService(session)
    lines = await svc.cached_lines(CHILD_ID, "general")
    assert lines == ["Un momento...", "Preparando..."]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_waiting_copy_from_cache_groups_kinds() -> None:
    session = ScriptedSession([FakeExecuteResult(rows={"settings": {}})] * 4)
    svc = WaitingCopyService(session)
    body = await svc.waiting_copy_from_cache(CHILD_ID)
    assert set(body.keys()) == {
        "preparing_exam",
        "evaluating_answer",
        "adventure_compose",
        "general",
    }


@pytest.mark.unit
@pytest.mark.asyncio
async def test_lines_for_uses_cache(mocker) -> None:
    session = ScriptedSession([])
    svc = WaitingCopyService(session)
    svc.cached_lines = AsyncMock(return_value=["cached"])
    result = await svc.lines_for(CHILD_ID, {}, "sess", "general")
    assert result["lines"] == ["cached"]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_lines_for_compose_failure_returns_empty(mocker) -> None:
    session = ScriptedSession([])
    compose = AsyncMock()
    compose.compose_waiting_bundle = AsyncMock(side_effect=RuntimeError("fail"))
    svc = WaitingCopyService(session, compose=compose)
    svc.cached_lines = AsyncMock(return_value=[])
    result = await svc.lines_for(CHILD_ID, {}, "sess", "general")
    assert result["lines"] == []
