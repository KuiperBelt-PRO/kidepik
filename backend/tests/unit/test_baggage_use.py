from __future__ import annotations

import pytest

from app.services.baggage_use import BaggageUseService, UseItemError
from tests.helpers.db_session import FakeExecuteResult, ScriptedSession
from tests.helpers.factories import CHILD_ID
from tests.helpers.session_scope import patch_session_scope


@pytest.mark.unit
def test_hint_text_avoids_answer_leak() -> None:
    ch = {
        "explanation": "La opción correcta es opt_a porque 2+2=4",
        "correct_option_id": "opt_a",
    }
    hint = BaggageUseService._hint_text(ch)
    assert "opt_a" not in hint.lower()
    assert len(hint) > 10


@pytest.mark.unit
@pytest.mark.asyncio
async def test_use_hint_consumes_qty(mocker) -> None:
    session = ScriptedSession(
        [
            FakeExecuteResult(
                rows=[
                    {
                        "id": "row1",
                        "item_def_id": "fantasy_potion_focus_math",
                        "qty": 2,
                        "world_theme": "fantasy",
                    }
                ]
            ),
            FakeExecuteResult(rows=None),  # update qty
            # get_baggage after consume
            FakeExecuteResult(
                rows=[{"balance": 0, "lifetime_earned": 0, "lifetime_spent": 0}]
            ),
            FakeExecuteResult(rows=[]),
        ]
    )
    patch_session_scope(mocker, session)
    svc = BaggageUseService()
    child = {
        "id": CHILD_ID,
        "world_theme": "fantasy",
        "settings": {"learning": {"active_subjects": ["math"]}},
        "age_band": "band_child",
    }
    result = await svc.use(
        child=child,
        item_row_id="row1",
        effect_id="challenge_hint",
        session_id="sess1",
        active_challenge={"subject_id": "math", "explanation": "Cuenta con calma."},
        can_retry=False,
    )
    assert result["ok"] is True
    assert result["consumed_qty"] == 1
    assert "hint_text" in result
    assert "baggage" in result


@pytest.mark.unit
@pytest.mark.asyncio
async def test_use_retry_not_eligible(mocker) -> None:
    session = ScriptedSession(
        [
            FakeExecuteResult(
                rows=[
                    {
                        "id": "row1",
                        "item_def_id": "fantasy_charm_second_chance_math",
                        "qty": 1,
                        "world_theme": "fantasy",
                    }
                ]
            ),
        ]
    )
    patch_session_scope(mocker, session)
    svc = BaggageUseService()
    child = {
        "id": CHILD_ID,
        "world_theme": "fantasy",
        "settings": {"learning": {"active_subjects": ["math"]}},
    }
    with pytest.raises(UseItemError) as ei:
        await svc.use(
            child=child,
            item_row_id="row1",
            effect_id="challenge_retry",
            session_id="sess1",
            active_challenge={"subject_id": "math"},
            can_retry=False,
        )
    assert ei.value.code == "retry_not_eligible"
