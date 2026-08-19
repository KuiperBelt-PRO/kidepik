from __future__ import annotations

from pathlib import Path

import pytest

from app.ai.skills.loader import (
    default_skills_root,
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


def _skill_instructions(skill_id: str) -> str:
    parsed = parse_skill_md(default_skills_root() / skill_id / "SKILL.md")
    return str(parsed["instructions"])


@pytest.mark.unit
def test_placement_exam_skill_forbids_invented_world_lore() -> None:
    text = _skill_instructions("placement-exam")
    assert "conocimiento escolar previo" in text
    assert "lore inventado" in text
    assert "mitos reales" in text
    assert "Arquitecto de las Chispas" in text


@pytest.mark.unit
def test_subject_pedagogy_skill_mythology_uses_real_myths() -> None:
    text = _skill_instructions("subject-pedagogy")
    assert "`mythology`" in text
    assert "mitos reales" in text
    assert "conocimiento escolar previo" in text


@pytest.mark.unit
def test_challenge_design_skill_lore_only_if_taught() -> None:
    text = _skill_instructions("challenge-design")
    assert "acaba de enseñarse" in text
    assert "conocimiento escolar previo" in text
    assert "lore inventado" in text
