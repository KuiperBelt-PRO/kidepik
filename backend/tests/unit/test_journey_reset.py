from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.journey_reset import ResetReport, list_resettable_children, reset_travelers
from tests.helpers.db_session import FakeExecuteResult, FakeIterableResult, ScriptedSession
from tests.helpers.factories import CHILD_ID, PARENT_ID


class MappingRow:
    def __init__(self, data: dict) -> None:
        self._mapping = data


@pytest.mark.unit
def test_reset_report_to_dict() -> None:
    report = ResetReport(dry_run=True, children_matched=2, child_ids=[CHILD_ID])
    body = report.to_dict()
    assert body["dry_run"] is True
    assert body["children_matched"] == 2


@pytest.mark.unit
@pytest.mark.asyncio
async def test_list_resettable_children() -> None:
    session = AsyncMock()
    session.execute = AsyncMock(
        return_value=FakeIterableResult(
            [
                MappingRow(
                    {
                        "id": CHILD_ID,
                        "parent_id": PARENT_ID,
                        "display_name": "Ada",
                        "onboarding_step": "complete",
                        "placement_status": "completed",
                        "is_tutor_profile": False,
                    }
                )
            ]
        )
    )
    rows = await list_resettable_children(session)
    assert rows[0]["id"] == CHILD_ID


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reset_travelers_dry_run(mocker, tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    session = AsyncMock()
    session.execute = AsyncMock(return_value=FakeExecuteResult())
    session.commit = AsyncMock()
    mocker.patch(
        "app.services.journey_reset.list_resettable_children",
        new=AsyncMock(return_value=[{"id": CHILD_ID, "parent_id": PARENT_ID}]),
    )
    report = await reset_travelers(session, dry_run=True)
    assert report.dry_run is True
    assert report.children_matched == 1
    session.execute.assert_not_called()
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reset_travelers_applies(mocker, tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    session = ScriptedSession([FakeExecuteResult()] * 11)
    ledger = MagicMock()
    ledger.archive_child = MagicMock(return_value=tmp_path / "archive")
    mocker.patch("app.services.journey_reset.JourneyLedger", return_value=ledger)
    mocker.patch(
        "app.services.journey_reset.list_resettable_children",
        new=AsyncMock(return_value=[{"id": CHILD_ID, "parent_id": PARENT_ID}]),
    )
    report = await reset_travelers(session, dry_run=False, archive_files=True)
    assert report.children_updated == 1
    assert report.files_archived == 1
    get_settings.cache_clear()
