from __future__ import annotations

import pytest

from app.services.gmail_canonical import InviteEmailError, canonicalize_gmail, display_invite_email


@pytest.mark.unit
@pytest.mark.parametrize(
    "raw,expected",
    [
        (None, None),
        ("", None),
        ("   ", None),
        ("nina@gmail.com", "nina@gmail.com"),
        ("  Nina.Viajera@Gmail.Com  ", "ninaviajera@gmail.com"),
        ("nina+tag@gmail.com", "nina@gmail.com"),
        ("n.i.n.a+play@googlemail.com", "nina@gmail.com"),
    ],
)
def test_canonicalize_gmail_ok(raw: object, expected: str | None) -> None:
    assert canonicalize_gmail(raw) == expected


@pytest.mark.unit
@pytest.mark.parametrize(
    "raw",
    [
        "nina@hotmail.com",
        "nina@kuiperbelt.pro",
        "nina",
        123,
        "@gmail.com",
        "nina@",
        "+tag@gmail.com",
    ],
)
def test_canonicalize_gmail_rejects_non_gmail(raw: object) -> None:
    with pytest.raises(InviteEmailError, match="invite_email_not_gmail"):
        canonicalize_gmail(raw)


@pytest.mark.unit
def test_display_invite_email_trims() -> None:
    assert display_invite_email("  Nina@gmail.com  ") == "Nina@gmail.com"
    assert display_invite_email("") is None
    assert display_invite_email(None) is None
