from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from tests.helpers.factories import CHILD_ID
from tests.helpers.http import assert_auth_error, assert_status

SESSION_ID = "33333333-3333-4333-8333-333333333333"
TURN_ID = "44444444-4444-4444-8444-444444444444"


@pytest.fixture
def debug_ai_enabled(settings, monkeypatch, mocker):
    monkeypatch.setenv("APP_ENV", "local")
    monkeypatch.setenv("APP_DEBUG_AI", "true")
    from app.config import get_settings

    get_settings.cache_clear()
    mocker.patch(
        "app.routers.debug_journey.debug_capabilities_for_claims",
        new=AsyncMock(
            return_value={
                "operator_eligible": True,
                "debug_enabled": True,
                "debug_allowed": True,
            }
        ),
    )
    yield
    get_settings.cache_clear()


@pytest.fixture
def mock_journey_rewind(mocker, mock_session_scope):
    service = mocker.patch("app.routers.debug_journey.JourneyRewindService").return_value
    service.rewind_to_turn = AsyncMock(
        return_value=(
            {
                "session_id": SESSION_ID,
                "turns": [],
                "pending_agent_turn": None,
                "debug": {"rewind": {"anchor_turn_id": TURN_ID, "deleted_turns": 2}},
            },
            None,
        )
    )
    return service


@pytest.mark.contract
@pytest.mark.asyncio
async def test_debug_journey_rewind_hidden_when_disabled(client: AsyncClient) -> None:
    body = assert_status(
        await client.post(
            "/api/v1/debug/journey/rewind",
            json={
                "child_id": CHILD_ID,
                "session_id": SESSION_ID,
                "turn_id": TURN_ID,
            },
        ),
        404,
    )
    assert body["detail"] == "Not Found"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_debug_journey_rewind_requires_auth(
    client: AsyncClient, debug_ai_enabled
) -> None:
    assert_auth_error(
        await client.post(
            "/api/v1/debug/journey/rewind",
            json={
                "child_id": CHILD_ID,
                "session_id": SESSION_ID,
                "turn_id": TURN_ID,
            },
        )
    )


@pytest.mark.contract
@pytest.mark.asyncio
async def test_debug_journey_rewind_ok(
    client: AsyncClient,
    debug_ai_enabled,
    mock_auth,
    auth_headers,
    mock_journey_rewind,
) -> None:
    body = assert_status(
        await client.post(
            "/api/v1/debug/journey/rewind",
            headers=auth_headers,
            json={
                "child_id": CHILD_ID,
                "session_id": SESSION_ID,
                "turn_id": TURN_ID,
            },
        ),
        200,
    )
    assert body["session_id"] == SESSION_ID
    assert body["debug"]["rewind"]["deleted_turns"] == 2


@pytest.mark.contract
@pytest.mark.asyncio
async def test_debug_journey_rewind_dry_run_ok(
    client: AsyncClient,
    debug_ai_enabled,
    mock_auth,
    auth_headers,
    mocker,
    mock_session_scope,
) -> None:
    from app.services.journey_rewind import RewindReport

    service = mocker.patch("app.routers.debug_journey.JourneyRewindService").return_value
    service.rewind_to_turn = AsyncMock(
        return_value=(
            {},
            RewindReport(anchor_turn_id=TURN_ID, deleted_turns=5, dry_run=True),
        )
    )

    body = assert_status(
        await client.post(
            "/api/v1/debug/journey/rewind/dry-run",
            headers=auth_headers,
            json={
                "child_id": CHILD_ID,
                "session_id": SESSION_ID,
                "turn_id": TURN_ID,
            },
        ),
        200,
    )
    assert body["rewind"]["deleted_turns"] == 5
    assert body["rewind"]["dry_run"] is True
