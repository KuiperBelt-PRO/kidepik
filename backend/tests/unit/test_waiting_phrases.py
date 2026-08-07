from __future__ import annotations

from pathlib import Path

import pytest

from app.services.waiting_phrases import clear_waiting_cache, pick_waiting_batch_sync


@pytest.mark.unit
def test_pick_waiting_from_jsonl(tmp_path: Path) -> None:
    clear_waiting_cache()
    fantasy = tmp_path / "fantasy.jsonl"
    fantasy.write_text(
        '{"id":"a","world_theme":"fantasy","age_band":null,"phase":"placement_compose",'
        '"locale":"es","body":"Frase fantasy A","weight":3,"active":true}\n'
        '{"id":"b","world_theme":"fantasy","age_band":null,"phase":"path_compose",'
        '"locale":"es","body":"Frase path","weight":1,"active":true}\n',
        encoding="utf-8",
    )
    (tmp_path / "neutral.jsonl").write_text(
        '{"id":"n","world_theme":"neutral","age_band":null,"phase":"generic",'
        '"locale":"es","body":"Neutral genérica","weight":1,"active":true}\n',
        encoding="utf-8",
    )
    out = pick_waiting_batch_sync(
        world_theme="fantasy",
        age_band=None,
        phase="placement_compose",
        waiting_dir=tmp_path,
    )
    assert "Frase fantasy A" in out
    assert "Frase path" not in out


@pytest.mark.unit
def test_pick_waiting_fallback(tmp_path: Path) -> None:
    clear_waiting_cache()
    out = pick_waiting_batch_sync(
        world_theme="fantasy",
        age_band=None,
        phase="placement_compose",
        waiting_dir=tmp_path,
    )
    assert out
    assert isinstance(out[0], str)
