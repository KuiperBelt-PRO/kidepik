"""Hash y verificación de PIN de salida (4 dígitos). Compatible PHP password_hash y PG crypt."""

from __future__ import annotations

import re

import bcrypt

_PIN_RE = re.compile(r"^\d{4}$")


def hash_exit_pin(pin: str) -> str:
    if not _PIN_RE.fullmatch(pin):
        raise ValueError("exit_pin invalid")
    return bcrypt.hashpw(pin.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_exit_pin(pin: str, stored_hash: str | None) -> bool:
    if not _PIN_RE.fullmatch(pin) or not stored_hash:
        return False
    hash_bytes = stored_hash.encode("utf-8")
    # PHP password_hash usa prefijo $2y$; bcrypt acepta $2a$/$2b$.
    if hash_bytes.startswith(b"$2y$"):
        hash_bytes = b"$2a$" + hash_bytes[4:]
    try:
        return bcrypt.checkpw(pin.encode("utf-8"), hash_bytes)
    except ValueError:
        return False
