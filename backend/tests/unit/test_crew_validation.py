from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.services.crew import CrewService


@pytest.mark.unit
@pytest.mark.parametrize(
    "payload,message",
    [
        ({"age_years": "bad"}, "age_years invalid"),
        ({"status": "deleted"}, "status invalid"),
        ({"world_theme": "invalid"}, "world_theme invalid"),
        ({"learning": "bad"}, "learning invalid"),
        ({"learning": {"active_subjects": "bad"}}, "learning.active_subjects invalid"),
        ({"character_summary": 1}, "character_summary invalid"),
        ({"explorer_gender": "other"}, "explorer_gender invalid"),
    ],
)
@pytest.mark.asyncio
async def test_update_profile_validation_errors(payload, message, mocker) -> None:
    svc = CrewService()
    base = {
        "is_tutor_profile": False,
        "settings": {},
        "permissions": {"lock_world_theme": False},
        "world_theme": "fantasy",
    }
    mocker.patch.object(svc, "get_for_auth_user", new=AsyncMock(return_value=base))
    with pytest.raises(ValueError, match=message):
        await svc.update_profile_for_auth_user("auth", "child", payload)


@pytest.mark.unit
@pytest.mark.parametrize(
    "payload,message",
    [
        ({"allow_solo_start": "yes"}, "allow_solo_start invalid"),
        ({"session_limit_per_day": 0}, "session_limit_per_day invalid"),
        ({"max_session_minutes": 7}, "max_session_minutes invalid"),
        ({"font_scale_play": "xxl"}, "font_scale_play invalid"),
    ],
)
@pytest.mark.asyncio
async def test_update_permissions_validation_errors(payload, message, mocker) -> None:
    svc = CrewService()
    mocker.patch.object(svc, "get_for_auth_user", new=AsyncMock(return_value={"id": "child"}))
    with pytest.raises(ValueError, match=message):
        await svc.update_permissions_for_auth_user("auth", "child", payload)
