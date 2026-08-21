from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.security.exit_pin import hash_exit_pin
from app.services.crew import CrewService
from tests.helpers.db_session import FakeExecuteResult, ScriptedSession
from tests.helpers.factories import AUTH_USER_ID, CHILD_ID, PARENT_ID
from tests.helpers.session_scope import patch_session_scope


def child_row(**overrides):
    row = {
        "id": CHILD_ID,
        "parent_id": PARENT_ID,
        "display_name": "Ada",
        "age_years": 9,
        "age_band": "band_child",
        "effective_age_band": "band_child",
        "birth_year": None,
        "world_theme": "fantasy",
        "locale": "es-ES",
        "status": "active",
        "onboarding_step": "complete",
        "placement_status": "completed",
        "settings": {"learning": {"active_subjects": ["math", "language"]}},
        "is_tutor_profile": False,
        "rank_id": "fantasy_spark",
        "rank_track": "fantasy",
        "general_level": "L1",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "allow_solo_start": True,
        "require_exit_pin": False,
        "exit_pin_hash": None,
        "session_limit_per_day": 3,
        "max_session_minutes": 10,
        "allowed_hours": None,
        "can_choose_story_branch": True,
        "lock_world_theme": True,
        "font_scale_play": "md",
        "learning_overrides": {},
    }
    row.update(overrides)
    return row


@pytest.fixture
def crew_svc(mocker):
    session = ScriptedSession([])
    patch_session_scope(mocker, session)
    parents = MagicMock()
    parents.find_by_auth_user_id = AsyncMock(
        return_value={
            "parent_id": PARENT_ID,
            "auth_user_id": AUTH_USER_ID,
            "email": "tutor@example.com",
            "display_name": "Tutor Test",
        }
    )
    settings_repo = MagicMock()
    settings_repo.get_merged_settings_for_parent_id = AsyncMock(
        return_value={
            "crew_defaults": {
                "allow_solo_start": True,
                "require_exit_pin": False,
                "session_limit_per_day": 3,
                "max_session_minutes": 10,
                "lock_world_theme": True,
                "font_scale_play": "md",
            }
        }
    )
    svc = CrewService(parents=parents, settings_repo=settings_repo)
    return svc, session


@pytest.mark.unit
def test_crew_static_validators() -> None:
    assert CrewService._tutor_name({"display_name": "  Ana  "}) == "Ana"
    assert CrewService._tutor_name({"email": "ana.lopez@example.com"}) == "Ana Lopez"
    assert CrewService._display_name("Ada") == "Ada"
    assert CrewService._tutor_label("Mamá") == "Mamá"
    assert CrewService._summary("Hola <b>mundo</b>") == "Hola mundo"


@pytest.mark.unit
@pytest.mark.parametrize(
    "method,args,message",
    [
        ("_display_name", (123,), "display_name invalid"),
        ("_tutor_label", ("x" * 41,), "tutor_label too long"),
        ("_summary", ("x" * 601,), "character_summary too long"),
    ],
)
def test_crew_static_validator_errors(method: str, args: tuple, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        getattr(CrewService, method)(*args)


@pytest.mark.unit
def test_normalize_subject_notes() -> None:
    notes = CrewService._normalize_subject_notes(
        [{"subject_id": "math", "note": "Domina tablas de multiplicar"}]
    )
    assert notes == [{"subject_id": "math", "note": "Domina tablas de multiplicar"}]
    with pytest.raises(ValueError, match="learning.subject_notes invalid"):
        CrewService._normalize_subject_notes([{"subject_id": "invalid", "note": "x"}])


@pytest.mark.unit
def test_effective_subject_notes_merges_legacy_weak_spots() -> None:
    learning = {
        "subject_notes": [{"subject_id": "math", "note": "nueva"}],
        "weak_spots": [{"subject_id": "language", "note": "legacy"}],
    }
    merged = CrewService.effective_subject_notes(learning)
    assert len(merged) == 2
    assert merged[0]["subject_id"] == "math"


@pytest.mark.unit
def test_subject_notes_prompt_line() -> None:
    line = CrewService.subject_notes_prompt_line(
        {
            "general_note": "8 años, muy adelantado",
            "subject_notes": [{"subject_id": "math", "note": "tablas"}],
        }
    )
    assert "Información adicional general del tutor" in line
    assert "Información adicional por materia" in line
    assert "math: tablas" in line


@pytest.mark.unit
def test_normalize_general_note() -> None:
    assert CrewService._normalize_general_note(None) is None
    assert CrewService._normalize_general_note("  nota  ") == "nota"
    with pytest.raises(ValueError, match="learning.general_note too long"):
        CrewService._normalize_general_note("x" * 401)


@pytest.mark.unit
def test_normalize_subject_priorities() -> None:
    assert CrewService._normalize_subject_priorities(None) == []
    priorities = CrewService._normalize_subject_priorities(
        ["math", "math", "invalid", "logic"],
        active_subjects=["math", "language", "logic"],
    )
    assert priorities == ["math", "logic"]
    with pytest.raises(ValueError, match="learning.subject_priorities invalid"):
        CrewService._normalize_subject_priorities("x")


def test_normalize_weak_spots() -> None:
    assert CrewService._normalize_weak_spots(None) == []
    assert CrewService._normalize_weak_spots("  nota libre  ") == [
        {"subject_id": None, "note": "nota libre"}
    ]
    spots = CrewService._normalize_weak_spots(
        [{"subject_id": "math", "note": "sumas"}, "lectura"]
    )
    assert len(spots) == 2
    assert spots[0]["subject_id"] == "math"


@pytest.mark.unit
def test_list_item_and_traits() -> None:
    svc = CrewService()
    item = svc._list_item(child_row())
    assert item["id"] == CHILD_ID
    traits = svc._traits(
        {
            "species": "dragón",
            "palette": "azul",
            "features": ["valiente"],
            "vibe": "curioso",
            "achievements": [],
            "character_summary": None,
            "updated_at": datetime.now(timezone.utc),
        }
    )
    assert traits["species"] == "dragón"
    assert traits["character_summary"]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_list_for_auth_user(crew_svc, mocker) -> None:
    svc, session = crew_svc
    mocker.patch.object(svc, "ensure_tutor_profile_for_auth_user", new=AsyncMock())
    session._results = [FakeExecuteResult(rows=[child_row(is_tutor_profile=True), child_row()])]
    body = await svc.list_for_auth_user(AUTH_USER_ID)
    assert body["member_count"] == 1
    assert body["has_tutor_profile"] is True


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ensure_tutor_profile_updates_existing(crew_svc) -> None:
    svc, session = crew_svc
    session._results = [
        FakeExecuteResult(rows={"id": CHILD_ID}),
        FakeExecuteResult(),
    ]
    await svc.ensure_tutor_profile_for_auth_user(AUTH_USER_ID)
    assert len(session.executed) == 2


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ensure_tutor_profile_creates_new(crew_svc) -> None:
    svc, session = crew_svc
    session._results = [
        FakeExecuteResult(rows=None),
        FakeExecuteResult(scalar=CHILD_ID),
        FakeExecuteResult(),
    ]
    await svc.ensure_tutor_profile_for_auth_user(AUTH_USER_ID)
    assert len(session.executed) == 3


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_for_auth_user(crew_svc, mocker) -> None:
    svc, session = crew_svc
    mocker.patch.object(
        svc,
        "list_for_auth_user",
        new=AsyncMock(return_value={"member_count": 0}),
    )
    mocker.patch.object(svc, "get_for_auth_user", new=AsyncMock(return_value={"id": CHILD_ID}))
    session._results = [FakeExecuteResult(scalar=CHILD_ID), FakeExecuteResult()]
    created = await svc.create_for_auth_user(AUTH_USER_ID, {"tutor_label": "Papá"})
    assert created["id"] == CHILD_ID


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_for_auth_user_limit(crew_svc, mocker) -> None:
    svc, _session = crew_svc
    mocker.patch.object(
        svc,
        "list_for_auth_user",
        new=AsyncMock(return_value={"member_count": 10}),
    )
    with pytest.raises(ValueError, match="Crew member limit reached"):
        await svc.create_for_auth_user(AUTH_USER_ID)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_for_auth_user_with_progress(crew_svc, mocker) -> None:
    svc, session = crew_svc
    session._results = [
        FakeExecuteResult(rows=child_row()),
        FakeExecuteResult(rows=None),
    ]
    mocker.patch(
        "app.services.crew_progress.CrewProgressService.build_for_child",
        new=AsyncMock(
            return_value={
                "progress": {"general_level": "L1", "rank": {"id": "fantasy_spark"}},
                "journey": {"chapter_id": "C1"},
            }
        ),
    )
    detail = await svc.get_for_auth_user(AUTH_USER_ID, CHILD_ID)
    assert detail["progress"]["general_level"] == "L1"
    assert detail["journey"]["chapter_id"] == "C1"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_for_auth_user_not_found(crew_svc) -> None:
    svc, session = crew_svc
    session._results = [FakeExecuteResult(rows=None)]
    with pytest.raises(RuntimeError, match="Crew member not found"):
        await svc.get_for_auth_user(AUTH_USER_ID, CHILD_ID)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_update_profile_display_name(crew_svc, mocker) -> None:
    svc, session = crew_svc
    base = svc._detail(child_row())
    base["is_tutor_profile"] = False
    base["settings"] = {}
    base["permissions"] = {"lock_world_theme": False}
    mocker.patch.object(svc, "get_for_auth_user", new=AsyncMock(return_value=base))
    session._results = [FakeExecuteResult(), FakeExecuteResult(rows=child_row())]
    mocker.patch(
        "app.services.crew_progress.CrewProgressService.build_for_child",
        new=AsyncMock(return_value={"progress": {}, "journey": {}}),
    )
    updated = await svc.update_profile_for_auth_user(
        AUTH_USER_ID, CHILD_ID, {"display_name": "Luna"}
    )
    assert updated["display_name"] == "Ada"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_update_profile_locked_world(crew_svc, mocker) -> None:
    svc, _session = crew_svc
    base = svc._detail(child_row(world_theme="fantasy"))
    base["permissions"] = {"lock_world_theme": True}
    base["settings"] = {}
    mocker.patch.object(svc, "get_for_auth_user", new=AsyncMock(return_value=base))
    with pytest.raises(ValueError, match="world_theme locked"):
        await svc.update_profile_for_auth_user(
            AUTH_USER_ID, CHILD_ID, {"world_theme": "sci-fi"}
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_update_profile_learning(crew_svc, mocker) -> None:
    svc, session = crew_svc
    base = svc._detail(child_row())
    base["settings"] = {}
    base["permissions"] = {"lock_world_theme": False}
    mocker.patch.object(svc, "get_for_auth_user", new=AsyncMock(return_value=base))
    session._results = [FakeExecuteResult(), FakeExecuteResult(rows=child_row())]
    mocker.patch(
        "app.services.crew_progress.CrewProgressService.build_for_child",
        new=AsyncMock(return_value={"progress": {}, "journey": {}}),
    )
    await svc.update_profile_for_auth_user(
        AUTH_USER_ID,
        CHILD_ID,
        {"learning": {"active_subjects": ["math"], "weak_spots": ["lectura"]}},
    )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_update_profile_no_fields(crew_svc, mocker) -> None:
    svc, _session = crew_svc
    base = svc._detail(child_row())
    base["settings"] = {}
    base["permissions"] = {}
    mocker.patch.object(svc, "get_for_auth_user", new=AsyncMock(return_value=base))
    with pytest.raises(ValueError, match="No updatable fields"):
        await svc.update_profile_for_auth_user(AUTH_USER_ID, CHILD_ID, {})


@pytest.mark.unit
@pytest.mark.asyncio
async def test_update_permissions_exit_pin(crew_svc, mocker) -> None:
    svc, session = crew_svc
    detail = svc._detail(child_row())
    mocker.patch.object(
        svc,
        "get_for_auth_user",
        new=AsyncMock(side_effect=[{"id": CHILD_ID}, detail]),
    )
    session._results = [FakeExecuteResult()]
    mocker.patch(
        "app.services.crew_progress.CrewProgressService.build_for_child",
        new=AsyncMock(return_value={"progress": {}, "journey": {}}),
    )
    updated = await svc.update_permissions_for_auth_user(
        AUTH_USER_ID, CHILD_ID, {"exit_pin": "1234", "font_scale_play": "lg"}
    )
    assert updated["display_name"] == "Ada"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_update_permissions_invalid_pin(crew_svc, mocker) -> None:
    svc, _session = crew_svc
    mocker.patch.object(svc, "get_for_auth_user", new=AsyncMock(return_value={"id": CHILD_ID}))
    with pytest.raises(ValueError, match="exit_pin invalid"):
        await svc.update_permissions_for_auth_user(
            AUTH_USER_ID, CHILD_ID, {"exit_pin": "12"}
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_soft_delete_requires_confirm(crew_svc, mocker) -> None:
    svc, _session = crew_svc
    with pytest.raises(ValueError, match="confirm required"):
        await svc.soft_delete_for_auth_user(AUTH_USER_ID, CHILD_ID, False)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_soft_delete_tutor_forbidden(crew_svc, mocker) -> None:
    svc, _session = crew_svc
    mocker.patch.object(
        svc,
        "get_for_auth_user",
        new=AsyncMock(return_value={"is_tutor_profile": True}),
    )
    with pytest.raises(ValueError, match="Cannot delete tutor profile"):
        await svc.soft_delete_for_auth_user(AUTH_USER_ID, CHILD_ID, True)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_soft_delete_ok(crew_svc, mocker) -> None:
    svc, session = crew_svc
    mocker.patch.object(
        svc,
        "get_for_auth_user",
        new=AsyncMock(return_value={"is_tutor_profile": False}),
    )
    session._results = [FakeExecuteResult()]
    result = await svc.soft_delete_for_auth_user(AUTH_USER_ID, CHILD_ID, True)
    assert result["deleted"] is True


@pytest.mark.unit
@pytest.mark.asyncio
async def test_verify_exit_pin_not_required(crew_svc, mocker) -> None:
    svc, _session = crew_svc
    mocker.patch.object(
        svc,
        "get_for_auth_user",
        new=AsyncMock(return_value={"permissions": {"require_exit_pin": False}}),
    )
    result = await svc.verify_exit_pin_for_auth_user(AUTH_USER_ID, CHILD_ID, "1234")
    assert result == {"ok": True, "required": False}


@pytest.mark.unit
@pytest.mark.asyncio
async def test_verify_exit_pin_wrong(crew_svc, mocker) -> None:
    svc, session = crew_svc
    mocker.patch.object(
        svc,
        "get_for_auth_user",
        new=AsyncMock(
            return_value={
                "permissions": {"require_exit_pin": True, "exit_pin_set": True}
            }
        ),
    )
    session._results = [FakeExecuteResult(rows={"exit_pin_hash": hash_exit_pin("9999")})]
    result = await svc.verify_exit_pin_for_auth_user(AUTH_USER_ID, CHILD_ID, "1234")
    assert result == {"ok": False, "required": True}


@pytest.mark.unit
@pytest.mark.asyncio
async def test_verify_exit_pin_ok(crew_svc, mocker) -> None:
    svc, session = crew_svc
    mocker.patch.object(
        svc,
        "get_for_auth_user",
        new=AsyncMock(
            return_value={
                "permissions": {"require_exit_pin": True, "exit_pin_set": True}
            }
        ),
    )
    session._results = [FakeExecuteResult(rows={"exit_pin_hash": hash_exit_pin("1234")})]
    result = await svc.verify_exit_pin_for_auth_user(AUTH_USER_ID, CHILD_ID, "1234")
    assert result == {"ok": True, "required": True}


@pytest.mark.unit
@pytest.mark.asyncio
async def test_upsert_summary_insert(crew_svc) -> None:
    svc, session = crew_svc
    session._results = [FakeExecuteResult(rows=None), FakeExecuteResult()]
    await svc._upsert_summary(CHILD_ID, "Resumen corto")
    assert len(session.executed) == 2


@pytest.mark.unit
@pytest.mark.asyncio
async def test_unlink_keep_invite_does_not_clear_email(crew_svc) -> None:
    svc, session = crew_svc
    session._results = [FakeExecuteResult(rowcount=1), FakeExecuteResult()]
    ok = await svc.unlink_keep_invite(AUTH_USER_ID)
    assert ok is True
    update_sql = str(session.executed[0][0])
    assert "linked_auth_user_id = null" in update_sql
    assert "invite_email" not in update_sql
    assert "delete from auth.users" in str(session.executed[1][0]).lower()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_apply_invite_email_sets_canonical(crew_svc) -> None:
    svc, session = crew_svc
    session._results = [FakeExecuteResult(rows=[]), FakeExecuteResult(rows=None)]
    fields: list[str] = []
    params: dict = {"id": CHILD_ID}
    await svc._apply_invite_email(
        AUTH_USER_ID,
        {"id": CHILD_ID, "is_tutor_profile": False, "invite_email": None},
        "Nina.Viajera@gmail.com",
        fields,
        params,
    )
    assert params["invite_email"] == "Nina.Viajera@gmail.com"
    assert params["invite_email_canonical"] == "ninaviajera@gmail.com"


@pytest.mark.unit
def test_to_self_view_includes_member_ui_settings() -> None:
    svc = CrewService()
    row = child_row(
        font_scale_play="xl",
        settings={
            "learning": {"active_subjects": ["math", "language"]},
            "ui_preferences": {"reduce_motion": "never", "ui_theme": "sci-fi"},
        },
    )
    detail = svc._detail(row)
    view = svc.to_self_view(detail)
    assert view["font_scale_play"] == "xl"
    assert view["ui_preferences"]["reduce_motion"] == "never"
    assert view["ui_preferences"]["ui_theme"] == "sci-fi"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_update_self_profile_font_scale_play(crew_svc, mocker) -> None:
    svc, session = crew_svc
    linked = svc._detail(child_row())
    get_mock = mocker.patch.object(
        svc,
        "get_for_linked_crew",
        new=AsyncMock(return_value=linked),
    )
    session._results = [FakeExecuteResult(rowcount=1)]
    await svc.update_self_profile(AUTH_USER_ID, CHILD_ID, {"font_scale_play": "lg"})
    assert session.executed[0][1]["font_scale_play"] == "lg"
    get_mock.assert_awaited()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_update_self_profile_ui_preferences(crew_svc, mocker) -> None:
    svc, session = crew_svc
    linked = svc._detail(child_row())
    get_mock = mocker.patch.object(
        svc,
        "get_for_linked_crew",
        new=AsyncMock(return_value=linked),
    )
    session._results = [FakeExecuteResult(rowcount=1)]
    await svc.update_self_profile(
        AUTH_USER_ID,
        CHILD_ID,
        {"ui_preferences": {"reduce_motion": "always", "ui_theme": "sci-fi"}},
    )
    settings = json.loads(session.executed[0][1]["settings"])
    assert settings["ui_preferences"]["reduce_motion"] == "always"
    assert settings["ui_preferences"]["ui_theme"] == "sci-fi"
    assert get_mock.await_count >= 2
