from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.services.adventure_compose import AdventureComposeFailedException, AdventureComposeService


@pytest.mark.unit
@pytest.mark.asyncio
async def test_compose_waiting_bundle_ok() -> None:
    gateway = AsyncMock()
    gateway.complete = AsyncMock(
        return_value={"content": '{"lines":["Un momento...","Preparando reto..."]}'}
    )
    svc = AdventureComposeService(AsyncMock(), gateway=gateway)
    bundle = await svc.compose_waiting_bundle(
        "child",
        {"world_theme": "fantasy", "age_band": "band_child", "age_years": 9},
        "general",
    )
    assert bundle["lines"][0] == "Un momento..."
    assert bundle["ttl_hours"] == 24


@pytest.mark.unit
@pytest.mark.asyncio
async def test_compose_pitch_bundle_validates_options() -> None:
    gateway = AsyncMock()
    gateway.complete = AsyncMock(
        side_effect=[
            {"content": '{"mentor_bridge":"Hola","options":[{"id":"zone_math","label":"Math"}]}'},
        ]
    )
    svc = AdventureComposeService(AsyncMock(), gateway=gateway)
    bundle = await svc.compose_pitch_bundle(
        "child",
        {"world_theme": "fantasy"},
        "sess",
        ["zone_math"],
        {"math": "L1"},
    )
    assert bundle["options"][0]["id"] == "zone_math"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_compose_scene_returns_npc_meta(mocker) -> None:
    gateway = AsyncMock()
    gateway.complete = AsyncMock(
        return_value={
            "content": '{"agent_text":"Bienvenido al bosque","npc_display":{"name":"Guardián"}}'
        }
    )
    mocker.patch(
        "app.services.adventure_compose.JourneyContextPack.build",
        new=AsyncMock(return_value={"recent_beats": [], "recent_turns": []}),
    )
    svc = AdventureComposeService(AsyncMock(), gateway=gateway)
    scene = await svc.compose_scene(
        "child",
        {"world_theme": "fantasy", "display_name": "Ada"},
        "zone_math",
        "zone_arrive",
        {},
    )
    assert "Bienvenido" in scene["text"]
    assert scene["meta"]["npc_display"]["name"] == "Guardián"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_compose_json_failure_raises() -> None:
    gateway = AsyncMock()
    gateway.complete = AsyncMock(side_effect=RuntimeError("boom"))
    svc = AdventureComposeService(AsyncMock(), gateway=gateway)
    with pytest.raises(AdventureComposeFailedException):
        await svc.compose_waiting_bundle("child", {"world_theme": "fantasy"}, "general")
