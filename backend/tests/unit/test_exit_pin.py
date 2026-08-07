from __future__ import annotations

from pathlib import Path

import bcrypt
import pytest

from app.security.exit_pin import hash_exit_pin, verify_exit_pin


@pytest.mark.unit
def test_hash_and_verify_roundtrip() -> None:
    stored = hash_exit_pin("1234")
    assert verify_exit_pin("1234", stored)
    assert not verify_exit_pin("0000", stored)


@pytest.mark.unit
def test_verify_php_password_hash_prefix() -> None:
    stored = bcrypt.hashpw(b"5678", bcrypt.gensalt()).decode("utf-8")
    php_style = "$2y$" + stored[4:]
    assert verify_exit_pin("5678", php_style)
    assert not verify_exit_pin("1234", php_style)


@pytest.mark.unit
@pytest.mark.parametrize(
    "pin, stored",
    [
        ("12", "from-hash"),
        ("1234", None),
        ("1234", "not-a-bcrypt-hash"),
    ],
    ids=["short-pin", "missing-hash", "invalid-hash"],
)
def test_verify_rejects_invalid_pin_or_hash(pin: str, stored: str | None) -> None:
    hash_value = hash_exit_pin("1234") if stored == "from-hash" else stored
    assert not verify_exit_pin(pin, hash_value)
