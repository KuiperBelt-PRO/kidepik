"""Reset hint/retry flags for a path challenge (local dev)."""

from __future__ import annotations

import argparse
import asyncio

from app.ai.journey.ledger import JourneyLedger
from app.config import get_settings


def _latest_path_progress(
    ledger: JourneyLedger,
    parent_id: str,
    child_id: str,
    session_id: str,
    world: str,
) -> dict:
    try:
        rows = ledger.read_events(parent_id, child_id, session_id, world_theme=world)
    except TypeError:
        rows = ledger.read_events(parent_id, child_id, session_id)
    progress: dict = {}
    for row in rows:
        if row.get("kind") == "path_progress":
            progress = dict(row.get("payload") or {})
    return progress


async def main() -> None:
    parser = argparse.ArgumentParser(description="Clear helps for a challenge index in play.")
    parser.add_argument("--parent-id", required=True)
    parser.add_argument("--child-id", required=True)
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--world", default="fantasy")
    parser.add_argument("--challenge-index", type=int, required=True)
    parser.add_argument("--clear-hint", action="store_true")
    parser.add_argument("--clear-retry", action="store_true")
    parser.add_argument("--clear-all", action="store_true")
    args = parser.parse_args()

    if not (args.clear_hint or args.clear_retry or args.clear_all):
        parser.error("Specify --clear-hint, --clear-retry, or --clear-all")

    settings = get_settings()
    ledger = JourneyLedger(settings.journey_data_dir)
    progress = _latest_path_progress(
        ledger, args.parent_id, args.child_id, args.session_id, args.world
    )
    if not progress:
        raise SystemExit("No path_progress found for session")

    helps = dict(progress.get("helps") or {})
    key = str(args.challenge_index)
    row = dict(helps.get(key) or {})
    if args.clear_all:
        helps.pop(key, None)
    else:
        if args.clear_hint:
            row.pop("hint", None)
        if args.clear_retry:
            row.pop("retry", None)
        if row:
            helps[key] = row
        else:
            helps.pop(key, None)

    payload = {**progress, "helps": helps}
    ledger.append_event(
        args.parent_id,
        args.child_id,
        args.session_id,
        kind="path_progress",
        payload=payload,
        world_theme=args.world,
    )
    print(
        f"Cleared helps for challenge {args.challenge_index}. "
        f"Remaining helps keys: {list(helps.keys())}"
    )


if __name__ == "__main__":
    asyncio.run(main())
