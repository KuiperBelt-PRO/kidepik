"""Elimina path_pack pendiente del ledger para forzar recomposición completa."""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from app.config import get_settings


def _is_path_completed(payload: dict) -> bool:
    path = payload.get("path") if isinstance(payload.get("path"), dict) else {}
    challenges = path.get("challenges") or []
    if not isinstance(challenges, list) or not challenges:
        return False
    if payload.get("last_ok") is not True:
        return False
    idx = int(payload.get("challenge_index") or 0)
    return idx >= len(challenges)


def clear_pending_path_pack(
    *,
    parent_id: str,
    child_id: str,
    session_id: str,
    world: str,
    journey_root: Path,
) -> dict:
    events_path = (
        journey_root
        / parent_id
        / child_id
        / "worlds"
        / world
        / "sessions"
        / session_id
        / "events.jsonl"
    )
    if not events_path.exists():
        raise SystemExit(f"events file not found: {events_path}")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup = events_path.with_suffix(f".jsonl.bak-{stamp}")
    shutil.copy2(events_path, backup)

    kept: list[str] = []
    removed: dict[str, int] = {}
    last_completed_progress: str | None = None

    for line in events_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        kind = str(row.get("kind") or "")
        if kind in {"path_pack", "path_compose_context"}:
            removed[kind] = removed.get(kind, 0) + 1
            continue
        if kind == "path_progress":
            payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
            if _is_path_completed(payload):
                kept.append(line)
                last_completed_progress = str(payload.get("path_id") or "")
                continue
            removed["path_progress_incomplete"] = (
                removed.get("path_progress_incomplete", 0) + 1
            )
            continue
        if kind == "chapter_opened":
            chapter_id = str((row.get("payload") or {}).get("chapter_id") or "")
            if chapter_id.startswith("adventure:"):
                removed["chapter_opened_adventure"] = (
                    removed.get("chapter_opened_adventure", 0) + 1
                )
                continue
        kept.append(line)

    events_path.write_text(
        "\n".join(kept) + ("\n" if kept else ""),
        encoding="utf-8",
    )
    return {
        "events_path": str(events_path),
        "backup_path": str(backup),
        "kept_events": len(kept),
        "removed": removed,
        "last_completed_path_id": last_completed_progress,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Clear pending path_pack so Continue composes 3 fresh paths."
    )
    parser.add_argument("--parent-id", required=True)
    parser.add_argument("--child-id", required=True)
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--world", default="sci-fi")
    args = parser.parse_args()

    settings = get_settings()
    report = clear_pending_path_pack(
        parent_id=args.parent_id,
        child_id=args.child_id,
        session_id=args.session_id,
        world=args.world,
        journey_root=Path(settings.journey_data_dir),
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
