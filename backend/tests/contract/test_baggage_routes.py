from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.helpers.factories import CHILD_ID
from tests.helpers.http import assert_status


@pytest.mark.contract
@pytest.mark.asyncio
async def test_crew_baggage_include_usage(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
    mock_crew_service,
    mocker,
) -> None:
    get_baggage = mocker.AsyncMock(
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
    )
    mocker.patch("app.routers.crew.InventoryService.get_baggage", new=get_baggage)
    mocker.patch(
        "app.routers.crew.InventoryService.get_usage_log",
        return_value=[
            {
                "id": "evt1",
                "used_at": "2026-08-16T12:00:00Z",
                "effect_id": "challenge_hint",
                "effect_label_tutor": "Pista en reto",
                "label_tutor": "Poción de calma",
                "subject_labels": ["Matemáticas"],
            }
        ],
    )
    body = assert_status(
        await client.get(
            f"/api/v1/crew/{CHILD_ID}/baggage?include_usage=1",
            headers=auth_headers,
        ),
        200,
    )
    assert body["usage_log"][0]["effect_id"] == "challenge_hint"
    get_baggage.assert_awaited_once()


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
