"""Tests carga de fichas mentor."""
from __future__ import annotations

import pytest

from app.ai.mentors.loader import load_mentor_body


@pytest.mark.unit
def test_load_neutral_host_body() -> None:
    body = load_mentor_body("mentor_neutral_host")
    assert "El Guía" in body
    assert "mentor_neutral_host" in body
