from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.ai.errors import AiProductError
from tests.helpers.factories import CHILD_ID, sample_crew_member
from tests.helpers.http import assert_auth_error, assert_status

SESSION_ID = "33333333-3333-4333-8333-333333333333"


@pytest.fixture
def mock_play_services(mocker, mock_session_scope):
    dialogue = mocker.patch("app.routers.play.DialogueService").return_value
    dialogue.open_session = AsyncMock(
        return_value={"session_id": SESSION_ID, "flow_id": "first_run", "turn": {"id": "t1"}}
    )
    dialogue.submit_turn = AsyncMock(
        return_value={"session_id": SESSION_ID, "turn": {"id": "t2"}, "messages": []}
    )
    dialogue.load_history = AsyncMock(return_value={"items": [], "has_more": False})
    dialogue._child = AsyncMock(return_value={"id": CHILD_ID})
    memory = mocker.patch("app.routers.play.JourneyMemoryService").return_value
    memory.latest_summary_text = AsyncMock(return_value="Resumen corto")
    timeline = mocker.patch("app.routers.play.JourneyTimelineService").return_value
    timeline.page = AsyncMock(return_value={"items": [], "next_cursor": None})
    crew = mocker.patch("app.routers.play.CrewService").return_value
    crew.ensure_tutor_profile_for_auth_user = AsyncMock(return_value=None)
    crew.get_accessible_for_auth_user = AsyncMock(return_value=sample_crew_member())
    crew.get_for_auth_user = AsyncMock(return_value=sample_crew_member())
    parent = mocker.patch("app.routers.play.ParentAccountService").return_value
    parent.get_or_bootstrap = AsyncMock(return_value={"parent_id": "p1"})
    parent.bootstrap = AsyncMock(
        return_value={"parent_id": "p1", "created": False, "auth_user_id": "u1", "email": "tutor@example.com"}
    )
    parent.find_by_auth_user_id = AsyncMock(return_value={"parent_id": "p1", "email": "tutor@example.com"})
    return dialogue


@pytest.mark.contract
@pytest.mark.asyncio
async def test_play_open_session_requires_auth(client: AsyncClient) -> None:
    assert_auth_error(
        await client.post(f"/api/v1/play/{CHILD_ID}/dialogue/session", json={})
    )


@pytest.mark.contract
@pytest.mark.asyncio
async def test_play_open_session_ok(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_play_services,
) -> None:
    body = assert_status(
        await client.post(
            f"/api/v1/play/{CHILD_ID}/dialogue/session",
            json={"flow_id": "first_run"},
            headers=auth_headers,
        ),
        200,
    )
    assert body["session_id"] == SESSION_ID


@pytest.mark.contract
@pytest.mark.asyncio
async def test_play_submit_turn_requires_payload(
    client: AsyncClient,
    mock_auth,
    auth_headers,
) -> None:
    body = assert_status(
        await client.post(
            f"/api/v1/play/{CHILD_ID}/dialogue/turn",
            json={"session_id": SESSION_ID},
            headers=auth_headers,
        ),
        422,
    )
    assert "session_id and reply required" in body["detail"]


@pytest.mark.contract
@pytest.mark.asyncio
async def test_play_submit_turn_ok(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_play_services,
) -> None:
    body = assert_status(
        await client.post(
            f"/api/v1/play/{CHILD_ID}/dialogue/turn",
            json={"session_id": SESSION_ID, "reply": {"text": "Hola"}},
            headers=auth_headers,
        ),
        200,
    )
    assert body["session_id"] == SESSION_ID
    mock_play_services.submit_turn.assert_awaited_once()


@pytest.mark.contract
@pytest.mark.asyncio
async def test_play_submit_turn_ai_error(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_play_services,
) -> None:
    mock_play_services.submit_turn.side_effect = AiProductError(
        "ai_compose_failed",
        "No se pudo generar la respuesta.",
        http_status=503,
        retryable=False,
    )
    response = await client.post(
        f"/api/v1/play/{CHILD_ID}/dialogue/turn",
        json={"session_id": SESSION_ID, "reply": {"text": "Hola"}},
        headers=auth_headers,
    )
    assert response.status_code == 503
    body = response.json()
    assert body["error_code"] == "ai_compose_failed"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_play_history_ok(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_play_services,
) -> None:
    body = assert_status(
        await client.get(
            f"/api/v1/play/{CHILD_ID}/dialogue/history",
            params={"session_id": SESSION_ID, "before_turn_id": "t9"},
            headers=auth_headers,
        ),
        200,
    )
    assert body["has_more"] is False


@pytest.mark.contract
@pytest.mark.asyncio
async def test_play_journey_summary_ok(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_play_services,
) -> None:
    body = assert_status(
        await client.get(f"/api/v1/play/{CHILD_ID}/journey/summary", headers=auth_headers),
        200,
    )
    assert body["child_id"] == CHILD_ID
    assert body["summary"] == "Resumen corto"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_play_journey_timeline_ok(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_play_services,
) -> None:
    body = assert_status(
        await client.get(f"/api/v1/play/{CHILD_ID}/journey/timeline", headers=auth_headers),
        200,
    )
    assert body["child_id"] == CHILD_ID
    assert body["items"] == []


@pytest.mark.contract
@pytest.mark.asyncio
async def test_play_requires_email(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mocker,
) -> None:
    mocker.patch(
        "app.services.auth.SupabaseAuthService.validate_bearer",
        new=mocker.AsyncMock(
            return_value={
                "sub": "00000000-0000-4000-8000-000000000099",
                "role": "authenticated",
                "email": None,
            }
        ),
    )
    body = assert_status(
        await client.post(
            f"/api/v1/play/{CHILD_ID}/dialogue/session",
            json={},
            headers=auth_headers,
        ),
        422,
    )
    assert body["detail"] == "Email required"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_play_parent_bootstrap_unavailable(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mocker,
) -> None:
    mocker.patch(
        "app.routers.play.ParentAccountService"
    ).return_value.bootstrap = AsyncMock(
        side_effect=RuntimeError("Database unavailable")
    )
    body = assert_status(
        await client.post(
            f"/api/v1/play/{CHILD_ID}/dialogue/session",
            json={},
            headers=auth_headers,
        ),
        503,
    )
    assert body["detail"] == "Database unavailable"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_play_open_session_not_found(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_play_services,
) -> None:
    mock_play_services.open_session.side_effect = ValueError("invalid flow")
    body = assert_status(
        await client.post(
            f"/api/v1/play/{CHILD_ID}/dialogue/session",
            json={},
            headers=auth_headers,
        ),
        422,
    )
    assert "invalid flow" in body["detail"]


@pytest.mark.contract
@pytest.mark.asyncio
async def test_play_history_crew_not_found(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_play_services,
) -> None:
    mock_play_services.load_history.side_effect = Exception("Crew member not found")
    body = assert_status(
        await client.get(
            f"/api/v1/play/{CHILD_ID}/dialogue/history",
            params={"session_id": SESSION_ID, "before_turn_id": "t1"},
            headers=auth_headers,
        ),
        404,
    )
    assert body["detail"] == "Crew member not found"
