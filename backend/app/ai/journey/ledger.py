"""Ledger de viaje en JSONL + Markdown (SPEC_AI_JOURNEY_FILE_LEDGER)."""
from __future__ import annotations

import json
import re
import shutil
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

import yaml

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)

Kind = Literal[
    "mentor_utterance",
    "explorer_reply",
    "decision",
    "challenge",
    "quest",
    "level",
    "rank",
    "system",
    "amendment",
    "traveler_update",
    "placement_queue",
    "placement_answer",
    "placement_result",
    "path_pack",
    "path_progress",
    "chapter_opened",
    "item_used",
    "dictation",
]


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def require_uuid(value: str, *, label: str = "id") -> str:
    text = str(value).strip()
    if not _UUID_RE.match(text):
        raise ValueError(f"invalid {label}")
    if ".." in text or "/" in text or "\\" in text:
        raise ValueError(f"invalid {label}")
    return text.lower()


@dataclass
class JourneyFileEvent:
    id: str
    at: str
    seq: int
    kind: Kind
    session_id: str | None = None
    flow_id: str | None = None
    purpose: str | None = None
    model: str | None = None
    text: str | None = None
    summary: str | None = None
    payload: dict[str, Any] = field(default_factory=dict)
    source: Literal["primary", "echo"] | None = None

    def to_json(self) -> str:
        data = {k: v for k, v in asdict(self).items() if v is not None}
        return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


class JourneyLedger:
    """Escritura/lectura bajo ``JOURNEY_DATA_DIR/{parent}/{child}/``.

    Con ``world_theme``, usa ``worlds/{theme}/`` (SPEC_APP_PARALLEL_WORLDS).
    Lectura con fallback al layout plano legado.
    """

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root)

    def child_dir(self, parent_id: str, child_id: str) -> Path:
        parent = require_uuid(parent_id, label="parent_id")
        child = require_uuid(child_id, label="child_id")
        return self.root / parent / child

    def world_dir(
        self, parent_id: str, child_id: str, world_theme: str | None
    ) -> Path:
        base = self.child_dir(parent_id, child_id)
        if world_theme in {"fantasy", "sci-fi"}:
            return base / "worlds" / world_theme
        return base

    def session_dir(
        self,
        parent_id: str,
        child_id: str,
        session_id: str,
        *,
        world_theme: str | None = None,
    ) -> Path:
        session = require_uuid(session_id, label="session_id")
        return self.world_dir(parent_id, child_id, world_theme) / "sessions" / session

    def ensure_session(
        self,
        parent_id: str,
        child_id: str,
        session_id: str,
        *,
        world_theme: str | None = None,
    ) -> Path:
        path = self.session_dir(
            parent_id, child_id, session_id, world_theme=world_theme
        )
        path.mkdir(parents=True, exist_ok=True)
        index = self.child_dir(parent_id, child_id) / "index.json"
        index.parent.mkdir(parents=True, exist_ok=True)
        payload: dict[str, Any] = {
            "active_session_id": require_uuid(session_id, label="session_id"),
            "updated_at": _utc_now(),
        }
        if world_theme in {"fantasy", "sci-fi"}:
            payload["active_world_theme"] = world_theme
        index.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return path

    def dialogue_path(
        self,
        parent_id: str,
        child_id: str,
        *,
        world_theme: str | None = None,
    ) -> Path:
        return self.world_dir(parent_id, child_id, world_theme) / "dialogue.jsonl"

    def traveler_path(self, parent_id: str, child_id: str) -> Path:
        return self.child_dir(parent_id, child_id) / "traveler.md"

    def events_path(
        self,
        parent_id: str,
        child_id: str,
        session_id: str,
        *,
        world_theme: str | None = None,
    ) -> Path:
        return (
            self.session_dir(
                parent_id, child_id, session_id, world_theme=world_theme
            )
            / "events.jsonl"
        )

    def next_dialogue_seq(
        self,
        parent_id: str,
        child_id: str,
        *,
        world_theme: str | None = None,
    ) -> int:
        path = self.dialogue_path(parent_id, child_id, world_theme=world_theme)
        if not path.exists() and world_theme:
            # fallback legado plano
            path = self.dialogue_path(parent_id, child_id, world_theme=None)
        if not path.exists():
            return 1
        last = 0
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    last = max(last, int(json.loads(line).get("seq", 0)))
                except (json.JSONDecodeError, TypeError, ValueError):
                    continue
        return last + 1

    def append_dialogue(
        self,
        parent_id: str,
        child_id: str,
        session_id: str,
        *,
        kind: Kind,
        text: str | None = None,
        summary: str | None = None,
        flow_id: str | None = None,
        purpose: str | None = None,
        model: str | None = None,
        payload: dict[str, Any] | None = None,
        source: Literal["primary", "echo"] | None = "primary",
        world_theme: str | None = None,
    ) -> JourneyFileEvent:
        """Append to journey-wide dialogue.jsonl AND session events.jsonl."""
        session = require_uuid(session_id, label="session_id")
        self.ensure_session(
            parent_id, child_id, session, world_theme=world_theme
        )
        event = JourneyFileEvent(
            id=str(uuid.uuid4()),
            at=_utc_now(),
            seq=self.next_dialogue_seq(
                parent_id, child_id, world_theme=world_theme
            ),
            kind=kind,
            session_id=session,
            flow_id=flow_id,
            purpose=purpose,
            model=model,
            text=text,
            summary=summary,
            payload=payload or {},
            source=source,
        )
        dpath = self.dialogue_path(parent_id, child_id, world_theme=world_theme)
        dpath.parent.mkdir(parents=True, exist_ok=True)
        with dpath.open("a", encoding="utf-8") as handle:
            handle.write(event.to_json() + "\n")
        self.append_event(
            parent_id,
            child_id,
            session,
            kind=kind,
            text=text,
            summary=summary,
            flow_id=flow_id,
            purpose=purpose,
            model=model,
            payload={**(payload or {}), "journey_seq": event.seq},
            source="echo" if source == "primary" else source,
            world_theme=world_theme,
        )
        return event

    def read_dialogue(
        self,
        parent_id: str,
        child_id: str,
        *,
        limit: int | None = None,
        after_seq: int = 0,
        session_id: str | None = None,
        world_theme: str | None = None,
    ) -> list[dict[str, Any]]:
        path = self.dialogue_path(parent_id, child_id, world_theme=world_theme)
        if not path.exists() and world_theme:
            path = self.dialogue_path(parent_id, child_id, world_theme=None)
        if not path.exists():
            return []
        rows: list[dict[str, Any]] = []
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if int(row.get("seq", 0)) <= after_seq:
                    continue
                if session_id and str(row.get("session_id") or "") != session_id:
                    continue
                rows.append(row)
        rows.sort(key=lambda r: int(r.get("seq", 0)))
        if limit is not None:
            return rows[-limit:]
        return rows

    def write_traveler_profile(
        self,
        parent_id: str,
        child_id: str,
        *,
        front_matter: dict[str, Any],
        body_markdown: str,
    ) -> Path:
        path = self.traveler_path(parent_id, child_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        fm = dict(front_matter)
        fm.setdefault("schema", "kidepik.traveler_profile/v1")
        fm["child_id"] = require_uuid(child_id, label="child_id")
        fm.setdefault("updated_at", _utc_now())
        dumped = yaml.safe_dump(fm, allow_unicode=True, sort_keys=False).strip()
        path.write_text(f"---\n{dumped}\n---\n\n{body_markdown.strip()}\n", encoding="utf-8")
        return path

    def read_traveler_profile(
        self, parent_id: str, child_id: str
    ) -> tuple[dict[str, Any], str]:
        return self.read_markdown_document(self.traveler_path(parent_id, child_id))

    def next_seq(
        self,
        parent_id: str,
        child_id: str,
        session_id: str,
        *,
        world_theme: str | None = None,
    ) -> int:
        path = self.events_path(
            parent_id, child_id, session_id, world_theme=world_theme
        )
        if not path.exists():
            return 1
        last = 0
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    last = max(last, int(json.loads(line).get("seq", 0)))
                except (json.JSONDecodeError, TypeError, ValueError):
                    continue
        return last + 1

    def append_event(
        self,
        parent_id: str,
        child_id: str,
        session_id: str,
        *,
        kind: Kind,
        text: str | None = None,
        summary: str | None = None,
        flow_id: str | None = None,
        purpose: str | None = None,
        model: str | None = None,
        payload: dict[str, Any] | None = None,
        source: Literal["primary", "echo"] | None = "primary",
        world_theme: str | None = None,
    ) -> JourneyFileEvent:
        self.ensure_session(
            parent_id, child_id, session_id, world_theme=world_theme
        )
        event = JourneyFileEvent(
            id=str(uuid.uuid4()),
            at=_utc_now(),
            seq=self.next_seq(
                parent_id, child_id, session_id, world_theme=world_theme
            ),
            kind=kind,
            session_id=require_uuid(session_id, label="session_id"),
            flow_id=flow_id,
            purpose=purpose,
            model=model,
            text=text,
            summary=summary,
            payload=payload or {},
            source=source,
        )
        path = self.events_path(
            parent_id, child_id, session_id, world_theme=world_theme
        )
        with path.open("a", encoding="utf-8") as handle:
            handle.write(event.to_json() + "\n")
        return event

    def read_events(
        self,
        parent_id: str,
        child_id: str,
        session_id: str,
        *,
        limit: int | None = None,
        after_seq: int = 0,
        world_theme: str | None = None,
    ) -> list[dict[str, Any]]:
        path = self.events_path(
            parent_id, child_id, session_id, world_theme=world_theme
        )
        if not path.exists() and world_theme:
            path = self.events_path(parent_id, child_id, session_id, world_theme=None)
        if not path.exists():
            return []
        return self._read_events_file(path, limit=limit, after_seq=after_seq)

    @staticmethod
    def _parse_event_line(line: str, after_seq: int) -> dict[str, Any] | None:
        line = line.strip()
        if not line:
            return None
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            return None
        if int(row.get("seq", 0)) <= after_seq:
            return None
        return row

    def _read_events_file(
        self,
        path: Path,
        *,
        limit: int | None,
        after_seq: int,
    ) -> list[dict[str, Any]]:
        from collections import deque

        if limit is not None:
            buf: deque[dict[str, Any]] = deque(maxlen=limit)
            with path.open(encoding="utf-8") as handle:
                for line in handle:
                    row = self._parse_event_line(line, after_seq)
                    if row is not None:
                        buf.append(row)
            return list(buf)

        rows: list[dict[str, Any]] = []
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                row = self._parse_event_line(line, after_seq)
                if row is not None:
                    rows.append(row)
        return rows

    def _sessions_dirs(
        self, parent_id: str, child_id: str, *, world_theme: str | None
    ) -> list[Path]:
        dirs: list[Path] = []
        world_dir = self.world_dir(parent_id, child_id, world_theme)
        themed = world_dir / "sessions"
        if themed.is_dir():
            dirs.append(themed)
        legacy = self.child_dir(parent_id, child_id) / "sessions"
        if legacy.is_dir() and legacy not in dirs:
            dirs.append(legacy)
        return dirs

    def read_item_used_events(
        self,
        parent_id: str,
        child_id: str,
        *,
        world_theme: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """Aggregate ``item_used`` events across session ledgers for a world."""
        cap = max(1, min(int(limit or 50), 200))
        rows: list[dict[str, Any]] = []
        for sessions_dir in self._sessions_dirs(
            parent_id, child_id, world_theme=world_theme
        ):
            if not sessions_dir.is_dir():
                continue
            for session_path in sessions_dir.iterdir():
                if not session_path.is_dir():
                    continue
                events_file = session_path / "events.jsonl"
                if not events_file.is_file():
                    continue
                session_id = session_path.name
                with events_file.open(encoding="utf-8") as handle:
                    for line in handle:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            row = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        if row.get("kind") != "item_used":
                            continue
                        payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
                        rows.append(
                            {
                                "id": str(row.get("id") or ""),
                                "used_at": str(row.get("at") or ""),
                                "session_id": str(row.get("session_id") or session_id),
                                **payload,
                            }
                        )
        rows.sort(key=lambda r: str(r.get("used_at") or ""), reverse=True)
        return rows[:cap]

    def write_session_summary(
        self,
        parent_id: str,
        child_id: str,
        session_id: str,
        *,
        front_matter: dict[str, Any],
        body_markdown: str,
    ) -> Path:
        path = self.ensure_session(parent_id, child_id, session_id) / "summary.md"
        fm = dict(front_matter)
        fm.setdefault("schema", "kidepik.session_summary/v1")
        fm["child_id"] = require_uuid(child_id, label="child_id")
        fm["session_id"] = require_uuid(session_id, label="session_id")
        dumped = yaml.safe_dump(fm, allow_unicode=True, sort_keys=False).strip()
        path.write_text(f"---\n{dumped}\n---\n\n{body_markdown.strip()}\n", encoding="utf-8")
        return path

    def write_journey_condensed(
        self,
        parent_id: str,
        child_id: str,
        *,
        front_matter: dict[str, Any],
        body_markdown: str,
    ) -> Path:
        path = self.child_dir(parent_id, child_id) / "journey-condensed.md"
        path.parent.mkdir(parents=True, exist_ok=True)
        fm = dict(front_matter)
        fm.setdefault("schema", "kidepik.journey_condensed/v1")
        fm["child_id"] = require_uuid(child_id, label="child_id")
        dumped = yaml.safe_dump(fm, allow_unicode=True, sort_keys=False).strip()
        path.write_text(f"---\n{dumped}\n---\n\n{body_markdown.strip()}\n", encoding="utf-8")
        return path

    def read_markdown_document(self, path: Path) -> tuple[dict[str, Any], str]:
        if not path.exists():
            return {}, ""
        raw = path.read_text(encoding="utf-8")
        if not raw.startswith("---"):
            return {}, raw
        parts = raw.split("---", 2)
        if len(parts) < 3:
            return {}, raw
        meta = yaml.safe_load(parts[1]) or {}
        if not isinstance(meta, dict):
            meta = {}
        return meta, parts[2].strip()

    def archive_child(
        self, parent_id: str, child_id: str, *, stamp: str | None = None
    ) -> Path | None:
        src = self.child_dir(parent_id, child_id)
        if not src.exists():
            return None
        stamp = stamp or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        dest = (
            self.root
            / "_archive"
            / stamp
            / require_uuid(parent_id, label="parent_id")
            / require_uuid(child_id, label="child_id")
        )
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.exists():
            shutil.rmtree(dest)
        shutil.move(str(src), str(dest))
        return dest

    def delete_child(self, parent_id: str, child_id: str) -> bool:
        src = self.child_dir(parent_id, child_id)
        if not src.exists():
            return False
        shutil.rmtree(src)
        return True

    @staticmethod
    def _trim_jsonl_file(
        path: Path,
        *,
        anchor_at: str,
        session_id: str | None = None,
    ) -> int:
        if not path.exists():
            return 0
        kept: list[str] = []
        removed = 0
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                raw = line.strip()
                if not raw:
                    continue
                try:
                    row = json.loads(raw)
                except json.JSONDecodeError:
                    kept.append(raw)
                    continue
                if session_id and row.get("session_id"):
                    if str(row.get("session_id")) != session_id:
                        kept.append(raw)
                        continue
                at = str(row.get("at") or "")
                if at and at > anchor_at:
                    removed += 1
                    continue
                kept.append(raw)
        path.write_text(
            ("\n".join(kept) + "\n") if kept else "",
            encoding="utf-8",
        )
        return removed

    def trim_after(
        self,
        parent_id: str,
        child_id: str,
        *,
        session_id: str,
        anchor_at: str,
        world_theme: str | None = None,
        clear_traveler: bool = False,
        clear_session_summary: bool = False,
    ) -> int:
        """Elimina eventos posteriores al ancla en dialogue.jsonl y events.jsonl."""
        trimmed = self._trim_jsonl_file(
            self.dialogue_path(parent_id, child_id, world_theme=world_theme),
            anchor_at=anchor_at,
            session_id=session_id,
        )
        if world_theme:
            trimmed += self._trim_jsonl_file(
                self.dialogue_path(parent_id, child_id, world_theme=None),
                anchor_at=anchor_at,
                session_id=session_id,
            )
        trimmed += self._trim_jsonl_file(
            self.events_path(parent_id, child_id, session_id, world_theme=world_theme),
            anchor_at=anchor_at,
            session_id=session_id,
        )
        if world_theme:
            trimmed += self._trim_jsonl_file(
                self.events_path(parent_id, child_id, session_id, world_theme=None),
                anchor_at=anchor_at,
                session_id=session_id,
            )
        if clear_traveler:
            traveler = self.traveler_path(parent_id, child_id)
            if traveler.exists():
                traveler.unlink()
        if clear_session_summary:
            summary = (
                self.session_dir(
                    parent_id, child_id, session_id, world_theme=world_theme
                )
                / "summary.md"
            )
            if summary.exists():
                summary.unlink()
        return trimmed
