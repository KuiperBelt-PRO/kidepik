from __future__ import annotations

import bcrypt

from app.security.exit_pin import hash_exit_pin, verify_exit_pin


def test_hash_and_verify_roundtrip() -> None:
    stored = hash_exit_pin("1234")
    assert verify_exit_pin("1234", stored)
    assert not verify_exit_pin("0000", stored)


def test_verify_php_password_hash_prefix() -> None:
    # Simula hash generado por PHP password_hash (prefijo $2y$).
    stored = bcrypt.hashpw(b"5678", bcrypt.gensalt()).decode("utf-8")
    php_style = "$2y$" + stored[4:]
    assert verify_exit_pin("5678", php_style)
    assert not verify_exit_pin("1234", php_style)


def test_verify_rejects_invalid_pin_or_hash() -> None:
    assert not verify_exit_pin("12", hash_exit_pin("1234"))
    assert not verify_exit_pin("1234", None)
    assert not verify_exit_pin("1234", "not-a-bcrypt-hash")
