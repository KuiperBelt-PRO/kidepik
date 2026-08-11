from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.services.inventory import InventoryService
from app.services.reward_economy import RewardEconomyService
from tests.helpers.db_session import FakeExecuteResult, ScriptedSession
from tests.helpers.factories import CHILD_ID
from tests.helpers.session_scope import patch_session_scope


@pytest.mark.unit
def test_wallet_labels() -> None:
    inv = InventoryService()
    assert inv.wallet_labels("fantasy")["currency_kind"] == "coins"
    assert inv.wallet_labels("sci-fi")["currency_kind"] == "credits"
    assert inv.normalize_theme("sci-fi") == "sci-fi"
    assert inv.slot_soft_max("band_child") == 20


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_wallet_creates_row(mocker) -> None:
    session = ScriptedSession(
        [
            FakeExecuteResult(rows=None),  # select missing
            FakeExecuteResult(rows=None),  # insert
        ]
    )
    patch_session_scope(mocker, session)
    wallet = await InventoryService().get_wallet(CHILD_ID, "fantasy")
    assert wallet["balance"] == 0
    assert wallet["label_child"] == "Monedas"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_baggage_empty(mocker) -> None:
    session = ScriptedSession(
        [
            FakeExecuteResult(rows=[{"balance": 12, "lifetime_earned": 12, "lifetime_spent": 0}]),
            FakeExecuteResult(rows=[]),
        ]
    )
    patch_session_scope(mocker, session)
    bag = await InventoryService().get_baggage(
        CHILD_ID,
        "fantasy",
        active_subjects=["math"],
        age_band="band_child",
        audience="child",
    )
    assert bag["wallet"]["balance"] == 12
    assert bag["empty"] is True
    assert bag["slot_soft_max"] == 20


@pytest.mark.unit
@pytest.mark.asyncio
async def test_grant_idempotent(mocker) -> None:
    # First grant: no existing key
    session1 = ScriptedSession(
        [
            FakeExecuteResult(rows=None),  # select grant
            FakeExecuteResult(rows=None),  # ensure wallet select
            FakeExecuteResult(rows=None),  # ensure wallet insert
            FakeExecuteResult(rows=None),  # update wallet
            FakeExecuteResult(rows=None),  # insert grant
            FakeExecuteResult(rows=[{"balance": 10}]),
        ]
    )
    patch_session_scope(mocker, session1)
    first = await RewardEconomyService().grant(
        CHILD_ID,
        "fantasy",
        grant_key="k1",
        offer_id="offer",
        currency_amount=10,
    )
    assert first["skipped"] is False
    assert first["currency_delta"] == 10

    # Second: grant exists
    session2 = ScriptedSession(
        [
            FakeExecuteResult(rows=[{"grant_key": "k1"}]),
            FakeExecuteResult(rows=[{"balance": 10, "lifetime_earned": 10, "lifetime_spent": 0}]),
        ]
    )
    patch_session_scope(mocker, session2)
    second = await RewardEconomyService().grant(
        CHILD_ID,
        "fantasy",
        grant_key="k1",
        offer_id="offer",
        currency_amount=10,
    )
    assert second["skipped"] is True
    assert second["currency_delta"] == 0
