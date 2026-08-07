"""Tests mentor_profiles."""
from __future__ import annotations

import pytest

from app.services.mentor_profiles import mentor_for_child, mentor_profile, resolve_mentor_key


@pytest.mark.unit
def test_resolve_mentor_key_pre_world() -> None:
    assert resolve_mentor_key({"world_theme": None}) == "host"
    assert resolve_mentor_key({}) == "host"


@pytest.mark.unit
def test_resolve_mentor_key_by_world() -> None:
    assert resolve_mentor_key({"world_theme": "fantasy"}) == "guardian"
    assert resolve_mentor_key({"world_theme": "sci-fi"}) == "architect"


@pytest.mark.unit
def test_mentor_profile_display_names() -> None:
    assert mentor_profile("host")["display_name"] == "El Guía"
    assert mentor_profile("guardian")["display_name"] == "El Guardián del Conocimiento"
    assert mentor_profile("architect")["display_name"] == "El Arquitecto del Saber"


@pytest.mark.unit
def test_mentor_for_child() -> None:
    assert mentor_for_child({"world_theme": None})["id"] == "host"
    assert mentor_for_child({"world_theme": "sci-fi"})["mentor_id"] == "mentor_scifi_architect"
