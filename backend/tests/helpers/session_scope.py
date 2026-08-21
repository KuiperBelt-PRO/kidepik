from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from pytest_mock import MockerFixture

from tests.helpers.db_session import ScriptedSession

_SCOPE_MODULES = (
    "app.services.session_accounts",
    "app.services.parents",
    "app.services.account_authorization",
    "app.services.crew",
    "app.services.crew_progress",
    "app.services.settings",
    "app.services.inventory",
    "app.services.reward_economy",
    "app.services.baggage_use",
)


def patch_session_scope(mocker: MockerFixture, session: ScriptedSession | Any) -> Any:
    @asynccontextmanager
    async def _scope():
        yield session

    mocker.patch("app.db.session_scope", _scope)
    for module in _SCOPE_MODULES:
        try:
            mocker.patch(f"{module}.session_scope", _scope)
        except AttributeError:
            pass
    return session
