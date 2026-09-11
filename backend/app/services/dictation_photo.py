"""Validación de fotos de dictado."""
from __future__ import annotations

from urllib.parse import urlparse


def validate_dictation_photo_url(photo_url: str, *, user_id: str) -> str:
    raw = str(photo_url or "").strip()
    if not raw.startswith("/media/dictations/"):
        raise ValueError("dictation_photo_invalid")
    if ".." in raw or "\\" in raw:
        raise ValueError("dictation_photo_invalid")
    path = urlparse(raw).path
    prefix = f"/media/dictations/{user_id}/"
    if not path.startswith(prefix):
        raise ValueError("dictation_photo_invalid")
    rest = path[len(prefix) :]
    if not rest or "/" in rest or rest.startswith("."):
        raise ValueError("dictation_photo_invalid")
    return path
