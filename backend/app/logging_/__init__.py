from __future__ import annotations

import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import get_settings

_SECRET_KEYS = re.compile(
    r"(password|secret|token|api[_-]?key|authorization|bearer)",
    re.IGNORECASE,
)


class AppLogger:
    def __init__(self, channel: str) -> None:
        self.channel = channel

    def _enabled(self, level: str) -> bool:
        settings = get_settings()
        if not settings.log_to_files:
            return False
        order = ["debug", "info", "warning", "error"]
        want = level.lower()
        min_level = settings.log_level.lower()
        if settings.ai_debug_enabled() and self.channel in {"ai", "compose", "api", "client"}:
            min_level = "debug"
        try:
            return order.index(want) >= order.index(min_level)
        except ValueError:
            return True

    def _path(self) -> Path:
        settings = get_settings()
        day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        root = Path(settings.log_dir)
        root.mkdir(parents=True, exist_ok=True)
        return root / f"{self.channel}-{day}.log"

    def _sanitize(self, context: dict[str, Any] | None) -> dict[str, Any]:
        if not context:
            return {}
        out: dict[str, Any] = {}
        for key, value in context.items():
            if _SECRET_KEYS.search(str(key)):
                out[key] = "[redacted]"
            else:
                out[key] = value
        return out

    def log(self, level: str, message: str, **context: Any) -> None:
        if not self._enabled(level):
            return
        payload = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": level.lower(),
            "channel": self.channel,
            "message": message,
            "context": self._sanitize(context),
        }
        line = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        try:
            with self._path().open("a", encoding="utf-8") as handle:
                handle.write(line + "\n")
        except OSError:
            pass

    def debug(self, message: str, **context: Any) -> None:
        self.log("debug", message, **context)

    def info(self, message: str, **context: Any) -> None:
        self.log("info", message, **context)

    def warning(self, message: str, **context: Any) -> None:
        self.log("warning", message, **context)

    def error(self, message: str, **context: Any) -> None:
        self.log("error", message, **context)


def channel(name: str) -> AppLogger:
    return AppLogger(name)


def timed_ms(start: float) -> float:
    return round((time.perf_counter() - start) * 1000, 2)
