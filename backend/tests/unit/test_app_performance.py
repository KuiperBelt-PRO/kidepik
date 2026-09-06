from __future__ import annotations

import uuid
from pathlib import Path
from unittest.mock import patch

import pytest

from app.ai.journey.ledger import JourneyLedger
from app.logging_ import AppLogger, flush_log_buffers


@pytest.mark.unit
def test_read_events_tail_limit(tmp_path: Path) -> None:
    ledger = JourneyLedger(tmp_path)
    parent = str(uuid.uuid4())
    child = str(uuid.uuid4())
    session = str(uuid.uuid4())

    for idx in range(120):
        ledger.append_event(
            parent,
            child,
            session,
            kind="system",
            text=f"evt-{idx}",
        )

    tail = ledger.read_events(parent, child, session, limit=5)
    assert len(tail) == 5
    assert tail[0]["text"] == "evt-115"
    assert tail[-1]["text"] == "evt-119"


@pytest.mark.unit
def test_app_logger_buffers_before_flush(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LOG_DIR", str(tmp_path))
    monkeypatch.setenv("LOG_TO_FILES", "true")
    monkeypatch.setenv("LOG_BUFFER_LINES", "50")
    monkeypatch.setenv("LOG_FLUSH_MS", "60000")

    from app.config import get_settings

    get_settings.cache_clear()

    logger = AppLogger("api")
    with patch("builtins.open", wraps=open) as open_mock:
        for idx in range(10):
            logger.info("buffered", idx=idx)
        flush_log_buffers(channel="api")
        assert open_mock.call_count <= 2

    log_files = list(tmp_path.glob("api-*.log"))
    assert log_files
    content = log_files[0].read_text(encoding="utf-8")
    assert content.count('"message":"buffered"') == 10

    get_settings.cache_clear()
