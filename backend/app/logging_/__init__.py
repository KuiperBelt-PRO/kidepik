from __future__ import annotations

import atexit
import json
import re
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import get_settings

_SECRET_KEYS = re.compile(
    r"(password|secret|token|api[_-]?key|authorization|bearer)",
    re.IGNORECASE,
)

_BUFFER_LOCK = threading.Lock()
_BUFFERS: dict[tuple[str, str], list[str]] = {}
_OPEN_HANDLES: dict[tuple[str, str], Any] = {}
_LAST_FLUSH_MS: dict[tuple[str, str], float] = {}


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
        if settings.ai_debug_enabled() and self.channel in {"ai", "compose", "api"}:
            min_level = "debug"
        try:
            return order.index(want) >= order.index(min_level)
        except ValueError:
            return True

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
        _enqueue_line(self.channel, line)

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


def _buffer_key(channel: str) -> tuple[str, str]:
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return channel, day


def _enqueue_line(channel: str, line: str) -> None:
    settings = get_settings()
    key = _buffer_key(channel)
    flush_now = False
    now_ms = time.monotonic() * 1000
    with _BUFFER_LOCK:
        bucket = _BUFFERS.setdefault(key, [])
        bucket.append(line)
        if len(bucket) >= settings.log_buffer_lines:
            flush_now = True
        elif now_ms - _LAST_FLUSH_MS.get(key, 0.0) >= settings.log_flush_ms:
            flush_now = True
    if flush_now:
        _flush_buffer_key(key, settings)


def flush_log_buffers(*, channel: str | None = None) -> None:
    """Escribe buffers pendientes a disco (tests y apagado)."""
    settings = get_settings()
    if not settings.log_to_files:
        return
    with _BUFFER_LOCK:
        keys = [
            key
            for key in list(_BUFFERS.keys())
            if channel is None or key[0] == channel
        ]
    for key in keys:
        _flush_buffer_key(key, settings)


def _flush_buffer_key(key: tuple[str, str], settings: Any) -> None:
    with _BUFFER_LOCK:
        lines = _BUFFERS.pop(key, [])
        if not lines:
            return
    log_path = Path(settings.log_dir) / f"{key[0]}-{key[1]}.log"
    try:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with _BUFFER_LOCK:
            handle = _OPEN_HANDLES.get(key)
            if handle is None or handle.closed:
                handle = log_path.open("a", encoding="utf-8")
                _OPEN_HANDLES[key] = handle
        handle.writelines(f"{line}\n" for line in lines)
        handle.flush()
        _LAST_FLUSH_MS[key] = time.monotonic() * 1000
    except OSError:
        with _BUFFER_LOCK:
            _BUFFERS.setdefault(key, []).extend(lines)


atexit.register(flush_log_buffers)
