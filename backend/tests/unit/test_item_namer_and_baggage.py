from __future__ import annotations

import pytest

from app.catalogs.item_catalog import ItemCatalog
from app.catalogs.item_namer import ItemNamer, instance_labels
from app.catalogs.subject_catalog import SubjectCatalog
from app.services.crew_progress import CrewProgressService
from app.services.inventory import InventoryService


@pytest.mark.unit
def test_item_namer_prefers_agent_name() -> None:
    name = ItemNamer.propose(
        world_theme="fantasy",
        kind="scroll",
        subject_ids=["reading"],
        grant_key="k1",
        agent_name="  Pergamino de las voces gemelas  ",
    )
    assert name == "Pergamino de las voces gemelas"


@pytest.mark.unit
def test_item_namer_is_deterministic_and_world_aware() -> None:
    kwargs = dict(kind="potion", subject_ids=["math"], grant_key="same-grant")
    a = ItemNamer.propose(world_theme="fantasy", **kwargs)
    b = ItemNamer.propose(world_theme="fantasy", **kwargs)
    sci = ItemNamer.propose(world_theme="sci-fi", **kwargs)
    assert a == b
    assert a != sci
    assert a[0].isupper()


@pytest.mark.unit
def test_catalog_allows_multiple_subjects_and_scroll_kind() -> None:
    ItemCatalog._defs.cache_clear()
    reading = ItemCatalog.require("fantasy_charm_second_chance_reading")
    assert reading["kind"] == "scroll"
    assert "reading" in reading["subject_ids"]
    language = ItemCatalog.require("fantasy_potion_focus_language")
    assert set(language["subject_ids"]) >= {"language"}
    both = ItemCatalog.list_for_subject("fantasy", "reading")
    assert any(d["id"] == "fantasy_charm_second_chance_reading" for d in both)
    assert any("language" in d["subject_ids"] and "reading" in d["subject_ids"] for d in both)


@pytest.mark.unit
def test_language_reading_potion_usable_with_either_subject() -> None:
    ItemCatalog._defs.cache_clear()
    inv = InventoryService()
    row = {
        "id": "row-lang",
        "item_def_id": "fantasy_potion_focus_language",
        "qty": 1,
        "instance_name": "Elixir de palabras vivas",
        "acquired_at": "2026-08-15",
        "meta": {},
    }
    via_reading = inv._hydrate_item(row, "fantasy", ["reading"], audience="child")
    via_language = inv._hydrate_item(row, "fantasy", ["language"], audience="child")
    neither = inv._hydrate_item(row, "fantasy", ["math"], audience="child")
    assert via_reading is not None and via_reading["usable_now"] is True
    assert via_language is not None and via_language["usable_now"] is True
    assert neither is not None and neither["usable_now"] is False


@pytest.mark.unit
def test_hydrate_uses_instance_name_and_multi_subject_usable() -> None:
    ItemCatalog._defs.cache_clear()
    inv = InventoryService()
    row = {
        "id": "row1",
        "item_def_id": "fantasy_charm_second_chance_reading",
        "qty": 1,
        "instance_name": "Pergamino de la segunda voz",
        "acquired_at": "2026-08-15",
        "meta": {},
    }
    dto = inv._hydrate_item(row, "fantasy", ["reading", "math"], audience="tutor")
    assert dto is not None
    assert dto["usable_now"] is True
    assert dto["use_blocked_reason"] is None
    assert dto["label_child"] == "Pergamino de la segunda voz"
    paused = inv._hydrate_item(row, "fantasy", ["math"], audience="tutor")
    assert paused is not None
    assert paused["usable_now"] is False
    assert paused["use_blocked_reason"] == "Materia en pausa"


@pytest.mark.unit
def test_resolve_active_subjects_empty_list_falls_back_to_band() -> None:
    child = {
        "age_band": "band_child",
        "settings": {"learning": {"active_subjects": []}},
    }
    subjects = SubjectCatalog.resolve_active_subjects(child)
    assert "reading" in subjects
    assert "math" in subjects


@pytest.mark.unit
def test_rank_legend_hints_avoid_mvp() -> None:
    svc = CrewProgressService()
    legend = svc._rank_legend("fantasy")
    assert legend[0]["age_hint"] == "Inicio del viaje"
    assert legend[-1]["age_hint"] == "Cumbre del viaje"
    assert all("MVP" not in row["age_hint"] for row in legend)
    sci = svc._rank_legend("sci-fi")
    assert sci[0]["label"] == "Recluta estelar"
    assert sci[-1]["label"] == "Capitán del saber"


@pytest.mark.unit
def test_instance_labels_fallback_to_catalog() -> None:
    defn = {"label_child": "Poción de palabras vivas", "label_tutor": "Pista · Lengua"}
    child, purpose, label = instance_labels(defn, {}, audience="child")
    assert child == "Poción de palabras vivas"
    assert purpose == "Pista · Lengua"
    assert label == child
