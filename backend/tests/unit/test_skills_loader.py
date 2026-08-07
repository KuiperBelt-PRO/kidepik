from __future__ import annotations

from pathlib import Path

import pytest

from app.ai.skills.loader import (
    list_skill_directories,
    load_skill_capability,
    load_skills_for_purpose,
    parse_skill_md,
    skill_ids_for,
)


@pytest.mark.unit
def test_skill_ids_for_known_purpose() -> None:
    ids = skill_ids_for("onboarding_host")
    assert "onboarding-flow" in ids
    assert skill_ids_for("unknown_purpose") == []


@pytest.mark.unit
def test_parse_skill_md_ok(tmp_path: Path) -> None:
    skill_dir = tmp_path / "demo-skill"
    skill_dir.mkdir()
    path = skill_dir / "SKILL.md"
    path.write_text(
        "---\nid: demo-skill\ndescription: Demo\n---\nInstrucciones del skill.\n",
        encoding="utf-8",
    )
    parsed = parse_skill_md(path)
    assert parsed["id"] == "demo-skill"
    assert parsed["description"] == "Demo"
    assert "Instrucciones" in parsed["instructions"]


@pytest.mark.unit
@pytest.mark.parametrize(
    "content,message",
    [
        ("Sin frontmatter", "skill missing frontmatter"),
        ("---\nonly: one\n", "skill frontmatter invalid"),
    ],
)
def test_parse_skill_md_errors(tmp_path: Path, content: str, message: str) -> None:
    path = tmp_path / "bad" / "SKILL.md"
    path.parent.mkdir(parents=True)
    path.write_text(content, encoding="utf-8")
    with pytest.raises(ValueError, match=message):
        parse_skill_md(path)


@pytest.mark.unit
def test_list_skill_directories(tmp_path: Path) -> None:
    good = tmp_path / "alpha"
    good.mkdir()
    (good / "SKILL.md").write_text("---\nid: alpha\n---\nbody\n", encoding="utf-8")
    (tmp_path / "empty").mkdir()
    assert list_skill_directories(tmp_path) == ["alpha"]
    assert list_skill_directories(tmp_path / "missing") == []


@pytest.mark.unit
def test_load_skills_for_purpose(tmp_path: Path) -> None:
    for skill_id in skill_ids_for("onboarding_host"):
        folder = tmp_path / skill_id
        folder.mkdir()
        (folder / "SKILL.md").write_text(
            f"---\nid: {skill_id}\ndescription: {skill_id}\n---\nCuerpo.\n",
            encoding="utf-8",
        )
    caps = load_skills_for_purpose("onboarding_host", root=tmp_path)
    assert len(caps) == len(skill_ids_for("onboarding_host"))
    assert load_skill_capability(tmp_path / skill_ids_for("onboarding_host")[0] / "SKILL.md").id


@pytest.mark.unit
def test_load_skills_missing_file(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match="missing skill"):
        load_skills_for_purpose("onboarding_host", root=tmp_path)
