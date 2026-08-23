from __future__ import annotations

import pytest

from app.services.journey_timeline import JourneyTimelineService, tutor_facing_summary
from tests.helpers.db_session import FakeExecuteResult, ScriptedSession
from tests.helpers.factories import CHILD_ID, PARENT_ID

SESSION_ID = "33333333-3333-4333-8333-333333333333"


def _child_session() -> ScriptedSession:
    child = FakeExecuteResult(
        rows={
            "id": CHILD_ID,
            "parent_id": PARENT_ID,
            "display_name": "Ada",
            "world_theme": "fantasy",
        }
    )
    return ScriptedSession([child] * 16)


@pytest.mark.unit
def test_tutor_facing_summary_prefers_explorer_display_label() -> None:
    summary = tutor_facing_summary(
        kind="explorer_reply",
        text="b",
        payload={"reply": {"kind": "option", "option_id": "b", "displayLabel": "6 sectores"}},
    )
    assert summary == "6 sectores"


@pytest.mark.unit
def test_tutor_facing_summary_continue_without_text() -> None:
    summary = tutor_facing_summary(
        kind="explorer_reply",
        text="",
        payload={"reply": {"kind": "continue", "displayLabel": "Continuar"}},
    )
    assert summary == "Continuar"


@pytest.mark.unit
def test_tutor_facing_summary_keeps_long_mentor_utterance() -> None:
    text = (
        "Tras analizar los datos de la última telemetría, el resultado fue ____: "
        "el motor de curvatura funcionaba por encima de su capacidad nominal. "
        "No hubo margen de duda en el informe."
    )
    summary = tutor_facing_summary(kind="mentor_utterance", text=text)
    assert "margen de duda" in summary
    assert len(summary) == len(" ".join(text.split()))


@pytest.mark.unit
@pytest.mark.asyncio
async def test_timeline_page_from_ledger(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.ai.journey.ledger import JourneyLedger
    from app.config import get_settings

    get_settings.cache_clear()
    ledger = JourneyLedger(tmp_path)
    ledger.append_dialogue(PARENT_ID, CHILD_ID, SESSION_ID, kind="explorer_reply", text="hola")
    svc = JourneyTimelineService(_child_session())
    page = await svc.page(CHILD_ID, limit=10)
    assert page["events"]
    assert page["events"][0]["kind"] == "explorer_reply"
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_timeline_page_explorer_option_uses_display_label(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.ai.journey.ledger import JourneyLedger
    from app.config import get_settings

    get_settings.cache_clear()
    ledger = JourneyLedger(tmp_path)
    ledger.append_dialogue(
        PARENT_ID,
        CHILD_ID,
        SESSION_ID,
        kind="explorer_reply",
        text="c",
        payload={"reply": {"kind": "option", "option_id": "c", "displayLabel": "84 unidades"}},
    )
    svc = JourneyTimelineService(_child_session())
    page = await svc.page(CHILD_ID, limit=10)
    assert page["events"][0]["summary"] == "84 unidades"
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_timeline_page_matches_adventure_chronological_order(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.ai.journey.ledger import JourneyLedger
    from app.config import get_settings

    get_settings.cache_clear()
    ledger = JourneyLedger(tmp_path)
    ledger.append_dialogue(PARENT_ID, CHILD_ID, SESSION_ID, kind="mentor_utterance", text="pregunta")
    ledger.append_dialogue(PARENT_ID, CHILD_ID, SESSION_ID, kind="explorer_reply", text="respuesta")
    svc = JourneyTimelineService(_child_session())
    page = await svc.page(CHILD_ID, limit=10)
    kinds = [ev["kind"] for ev in page["events"]]
    summaries = [ev["summary"] for ev in page["events"]]
    assert kinds == ["mentor_utterance", "explorer_reply"]
    assert summaries == ["pregunta", "respuesta"]
    get_settings.cache_clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_timeline_first_page_is_latest_window_older_pages_go_back(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("JOURNEY_DATA_DIR", str(tmp_path))
    from app.ai.journey.ledger import JourneyLedger
    from app.config import get_settings

    get_settings.cache_clear()
    ledger = JourneyLedger(tmp_path)
    for index in range(5):
        ledger.append_dialogue(
            PARENT_ID,
            CHILD_ID,
            SESSION_ID,
            kind="explorer_reply",
            text=f"e{index}",
        )
    svc = JourneyTimelineService(_child_session())
    first = await svc.page(CHILD_ID, limit=3)
    assert [ev["summary"] for ev in first["events"]] == ["e2", "e3", "e4"]
    assert first["next_cursor"]
    older = await svc.page(CHILD_ID, cursor=first["next_cursor"], limit=3)
    assert [ev["summary"] for ev in older["events"]] == ["e0", "e1"]
    get_settings.cache_clear()
