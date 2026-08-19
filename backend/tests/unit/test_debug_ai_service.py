from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.services.debug_ai import DebugAiService
from tests.helpers.factories import CHILD_ID


@pytest.mark.unit
@pytest.mark.asyncio
async def test_debug_ai_status(mocker) -> None:
    service = DebugAiService(mocker.AsyncMock())
    mocker.patch(
        "app.services.debug_ai.debug_capabilities_for_parent",
        new=AsyncMock(
            return_value={
                "operator_eligible": True,
                "debug_enabled": True,
                "debug_allowed": True,
            }
        ),
    )
    body = await service.status("parent-1", {"diagnostics": {"debug_ai_enabled": True}})
    assert body["provider"] == "gemini"
    assert "models" in body
    assert body["operator_eligible"] is True


@pytest.mark.unit
@pytest.mark.asyncio
async def test_debug_ai_queues_filters_purpose() -> None:
    service = DebugAiService(AsyncMock())
    rows = await service.queues("dialogue")
    assert len(rows) >= 1
    assert rows[0]["purpose"] == "mentor_guide"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_debug_ai_resolve_alias() -> None:
    service = DebugAiService(AsyncMock())
    body = await service.resolve("placement_exam_composer")
    assert body["purpose"] == "placement_item_writer"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_debug_ai_attempts_from_db() -> None:
    session = AsyncMock()
    session.execute = AsyncMock(
        return_value=type(
            "R",
            (),
            {
                "mappings": lambda self: type(
                    "M",
                    (),
                    {
                        "all": lambda self: [
                            {
                                "purpose": "mentor_guide",
                                "model_id": "gemini-test",
                                "ok": True,
                                "http_status": 200,
                                "latency_ms": 120,
                                "error_class": None,
                                "created_at": None,
                            }
                        ]
                    },
                )()
            },
        )()
    )
    service = DebugAiService(session)
    rows = await service.attempts(5)
    assert rows[0]["provider"] == "gemini"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_debug_ai_ping_failure(mocker) -> None:
    from app.ai.errors import AiProductError

    service = DebugAiService(AsyncMock())
    mocker.patch(
        "app.services.debug_ai.run_dialogue_purpose",
        new=AsyncMock(side_effect=AiProductError("ai_disabled", "off", retryable=False)),
    )
    body = await service.ping(CHILD_ID)
    assert body["ok"] is False
    assert body["error_code"] == "ai_disabled"


@pytest.mark.unit
def test_debug_ai_attempts_from_logs(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("LOG_TO_FILES", "true")
    log_dir = tmp_path / "logs"
    log_dir.mkdir()
    (log_dir / "ai-2026-08-07.log").write_text(
        '{"message":"llm_attempt","ts":"2026-08-07","context":{"purpose":"mentor_guide","model":"gemini","ok":true}}\n',
        encoding="utf-8",
    )
    from app.config import get_settings

    get_settings.cache_clear()
    service = DebugAiService(AsyncMock())
    service.settings = get_settings()
    service.settings.log_dir = str(log_dir)
    rows = service._attempts_from_ai_logs(5)
    assert rows[0]["purpose"] == "mentor_guide"
    get_settings.cache_clear()
