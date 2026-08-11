from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.helpers.factories import CHILD_ID
from tests.helpers.http import assert_status


@pytest.mark.contract
@pytest.mark.asyncio
async def test_crew_baggage_ok(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
    mock_crew_service,
    mocker,
) -> None:
    mocker.patch(
        "app.routers.crew.InventoryService.get_baggage",
        new=mocker.AsyncMock(
            return_value={
                "world_theme": "fantasy",
                "wallet": {
                    "world_theme": "fantasy",
                    "currency_kind": "coins",
                    "balance": 0,
                    "label_child": "Monedas",
                    "label_tutor": "Monedas del reino",
                },
                "items": [],
                "slot_count": 0,
                "slot_soft_max": 20,
                "empty": True,
            }
        ),
    )
    body = assert_status(
        await client.get(f"/api/v1/crew/{CHILD_ID}/baggage", headers=auth_headers),
        200,
    )
    assert body["empty"] is True


@pytest.mark.contract
@pytest.mark.asyncio
async def test_play_baggage_and_progress_ok(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
    mock_crew_service,
    mocker,
) -> None:
    mocker.patch(
        "app.routers.play.InventoryService.get_baggage",
        new=mocker.AsyncMock(
            return_value={
                "world_theme": "fantasy",
                "wallet": {
                    "world_theme": "fantasy",
                    "currency_kind": "coins",
                    "balance": 5,
                    "label_child": "Monedas",
                    "label_tutor": "Monedas del reino",
                },
                "items": [],
                "slot_count": 0,
                "slot_soft_max": 20,
                "empty": True,
            }
        ),
    )
    mocker.patch(
        "app.routers.play.progress_hud_for_child",
        new=mocker.AsyncMock(
            return_value={
                "visible": True,
                "show_levels_to_child": False,
                "rank_label_child": "Adept",
                "general_progress": {"current": "L3", "next": "L4", "percent_to_next": 50},
            }
        ),
    )
    bag = assert_status(
        await client.get(f"/api/v1/play/{CHILD_ID}/baggage", headers=auth_headers),
        200,
    )
    assert bag["wallet"]["balance"] == 5
    prog = assert_status(
        await client.get(f"/api/v1/play/{CHILD_ID}/progress", headers=auth_headers),
        200,
    )
    assert prog["visible"] is True
