"""Smoke: open dialogue session + choose_world via DialogueService."""
from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.config import get_settings
from app.db import dispose_engine, init_engine, session_scope
from app.services.dialogue import DialogueService


async def main() -> None:
    init_engine(get_settings())
    async with session_scope() as session:
        row = (
            await session.execute(
                text(
                    """
                    select c.id as child_id, p.auth_user_id, c.onboarding_step
                    from children c
                    join parent_accounts p on p.id = c.parent_id
                    where c.status <> 'deleted'
                    order by c.updated_at desc
                    limit 1
                    """
                )
            )
        ).mappings().first()
        if not row:
            print("NO_CHILD")
            return
        print("child", row["child_id"], "step", row["onboarding_step"])
        svc = DialogueService(session)
        opened = await svc.open_session(
            str(row["auth_user_id"]), str(row["child_id"]), "first_run"
        )
        print("session", opened["session_id"])
        print("flow", opened["flow_id"], "onboarding", opened["onboarding_step"])
        print("turns", len(opened["turns"]))
        pending = opened.get("pending_agent_turn") or {}
        phase = (pending.get("meta") or {}).get("phase")
        print("phase", phase, "text", (pending.get("text") or "")[:100])
        if phase == "choose_world":
            turn = await svc.submit_turn(
                str(row["auth_user_id"]),
                str(row["child_id"]),
                opened["session_id"],
                {"kind": "option", "option_id": "fantasy"},
            )
            print("effects", [e.get("type") for e in turn.get("effects") or []])
            at = (turn.get("agent_turns") or [{}])[0]
            print(
                "next_phase",
                (at.get("meta") or {}).get("phase"),
                "mentor",
                (at.get("text") or "")[:120],
            )
    await dispose_engine()


if __name__ == "__main__":
    asyncio.run(main())
