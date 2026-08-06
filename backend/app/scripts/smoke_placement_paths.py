"""Smoke E2E: placement (JSONL) → choose_path ×3 → path_challenge con Gemini real."""
from __future__ import annotations

import asyncio
import sys
from typing import Any

from sqlalchemy import text

from app.config import get_settings
from app.db import dispose_engine, init_engine, session_scope
from app.services.dialogue import DialogueService


def _phase(turn: dict[str, Any] | None) -> str:
    if not turn:
        return ""
    return str((turn.get("meta") or {}).get("phase") or "")


def _last_agent(result: dict[str, Any]) -> dict[str, Any]:
    turns = result.get("agent_turns") or []
    return turns[-1] if turns else {}


def _reply_for(turn: dict[str, Any]) -> dict[str, Any]:
    mode = str(turn.get("input_mode") or "continue")
    options = turn.get("options") or []
    if mode in {"options_only", "options_and_text"} and options:
        # Prefer label "4" / id "b" when present (fallback math item); else first option.
        for opt in options:
            label = str(opt.get("label") or "").strip()
            oid = str(opt.get("id") or "")
            if label == "4" or oid == "b":
                return {"kind": "option", "option_id": oid}
        return {"kind": "option", "option_id": str(options[0].get("id"))}
    if mode == "text_only":
        return {"kind": "text", "text": "4"}
    return {"kind": "continue"}


async def _prepare_child(session: Any) -> dict[str, Any]:
    row = (
        await session.execute(
            text(
                """
                select c.id as child_id, p.auth_user_id, c.parent_id
                from children c
                join parent_accounts p on p.id = c.parent_id
                where c.status <> 'deleted'
                  and coalesce(c.is_tutor_profile, false) = false
                order by c.updated_at desc
                limit 1
                """
            )
        )
    ).mappings().first()
    if not row:
        raise SystemExit("NO_CHILD")

    child_id = str(row["child_id"])
    await session.execute(
        text(
            """
            update dialogue_sessions
            set status = 'closed', updated_at = now()
            where child_id = :id and status = 'open'
            """
        ),
        {"id": child_id},
    )
    await session.execute(
        text(
            """
            update children set
              display_name = coalesce(nullif(display_name, ''), 'SmokeViajero'),
              age_years = coalesce(age_years, 9),
              age_band = coalesce(age_band, 'band_child'),
              effective_age_band = coalesce(effective_age_band, 'band_child'),
              world_theme = 'fantasy',
              active_world_theme = 'fantasy',
              onboarding_step = 'placement',
              placement_status = 'not_started',
              general_level = null,
              updated_at = now()
            where id = :id
            """
        ),
        {"id": child_id},
    )
    await session.execute(
        text("delete from child_world_progress where child_id = :id"),
        {"id": child_id},
    )
    await session.execute(
        text("delete from user_subject_levels where child_id = :id"),
        {"id": child_id},
    )
    await session.commit()
    return dict(row)


async def main() -> None:
    get_settings.cache_clear()
    settings = get_settings()
    if not settings.gemini_api_key_resolved():
        raise SystemExit("missing GOOGLE_API_KEY / GEMINI_API_KEY")

    init_engine(settings)
    phases: list[str] = []
    try:
        async with session_scope() as session:
            row = await _prepare_child(session)
            auth = str(row["auth_user_id"])
            child_id = str(row["child_id"])
            print(f"child={child_id}")

            svc = DialogueService(session)
            opened = await svc.open_session(auth, child_id, "placement")
            sid = str(opened["session_id"])
            pending = opened.get("pending_agent_turn") or {}
            phase = _phase(pending)
            print(f"open_phase={phase} session={sid}")
            if phase != "handoff_placement":
                raise SystemExit(f"expected handoff_placement, got {phase!r}")

            # 1) Start placement (Gemini compose queue)
            result = await svc.submit_turn(
                auth, child_id, sid, {"kind": "continue"}
            )
            turn = _last_agent(result)
            phase = _phase(turn)
            phases.append(phase)
            print(f"after_start={phase} hints={len((turn.get('meta') or {}).get('waiting_hints') or [])}")
            if phase != "placement_item":
                raise SystemExit(f"expected placement_item, got {phase!r} text={(turn.get('text') or '')[:160]}")

            # 2) Answer placement items until choose_path
            guard = 0
            while phase == "placement_item" and guard < 8:
                guard += 1
                reply = _reply_for(turn)
                result = await svc.submit_turn(auth, child_id, sid, reply)
                turn = _last_agent(result)
                phase = _phase(turn)
                phases.append(phase)
                print(f"placement_step={guard} phase={phase}")

            if phase != "choose_path":
                raise SystemExit(f"expected choose_path, got {phase!r}")

            options = turn.get("options") or []
            print(f"paths={len(options)} titles={[o.get('label') for o in options]}")
            if len(options) < 2:
                raise SystemExit("expected at least 2 path options")

            # 3) Choose first path
            path_id = str(options[0].get("id"))
            result = await svc.submit_turn(
                auth, child_id, sid, {"kind": "option", "option_id": path_id}
            )
            turn = _last_agent(result)
            phase = _phase(turn)
            phases.append(phase)
            print(f"after_choose={phase}")
            if phase != "path_intro":
                raise SystemExit(f"expected path_intro, got {phase!r}")

            # 4) Continue to first challenge
            result = await svc.submit_turn(auth, child_id, sid, {"kind": "continue"})
            turn = _last_agent(result)
            phase = _phase(turn)
            phases.append(phase)
            print(f"after_intro={phase}")
            if phase != "path_challenge":
                raise SystemExit(f"expected path_challenge, got {phase!r}")

            # 5) Answer one challenge (ok → next challenge / adventure; fail → retry path_intro)
            reply = _reply_for(turn)
            result = await svc.submit_turn(auth, child_id, sid, reply)
            turn = _last_agent(result)
            phase = _phase(turn)
            phases.append(phase)
            print(f"after_challenge={phase}")
            if phase not in {"path_intro", "path_challenge", "adventure_ready"}:
                raise SystemExit(f"unexpected post-challenge phase {phase!r}")

            effects = [e.get("type") for e in (result.get("effects") or [])]
            print(f"effects={effects}")
            print(f"phases={phases}")
            print("ok=True")
    finally:
        await dispose_engine()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except SystemExit as exc:
        print(f"ok=False reason={exc}", file=sys.stderr)
        raise
