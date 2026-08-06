from __future__ import annotations

from pathlib import Path

from app.ai.agents.md_loader import clear_agent_spec_cache, get_agent_spec, load_all_agent_specs
from app.ai.orchestrator.tools import glossary_search


def test_agent_md_loader_finds_mentor_guide() -> None:
    clear_agent_spec_cache()
    specs = load_all_agent_specs()
    assert "mentor_guide" in specs
    spec = get_agent_spec("mentor_guide")
    assert spec is not None
    assert spec.model_tier == "quality"
    assert "glossary_search" in spec.tools
    assert "mentor" in spec.instructions.lower() or "breve" in spec.instructions.lower()


def test_glossary_search_fantasy(tmp_path: Path) -> None:
    fantasy = tmp_path / "fantasy.jsonl"
    fantasy.write_text(
        '{"id":"t1","world":"fantasy","kind":"place_type","term":"claro",'
        '"definition":"Un claro","tags":["naturaleza"]}\n',
        encoding="utf-8",
    )
    hits = glossary_search("fantasy", kind="place_type", glossary_dir=tmp_path)
    assert len(hits) >= 1
    assert hits[0].term == "claro"


def test_orchestrator_resolve_purpose() -> None:
    from app.ai.orchestrator import Orchestrator, TurnContext

    orch = Orchestrator.__new__(Orchestrator)
    ctx = TurnContext(
        child={"id": "00000000-0000-4000-8000-000000000001", "world_theme": None},
        session_id="00000000-0000-4000-8000-000000000002",
        flow_id="first_run",
        sequence=1,
        phase="choose_world",
        purpose="",
    )
    assert orch.resolve_purpose(ctx) == "onboarding_host"
    ctx.purpose = "mentor_guide"
    ctx.child["world_theme"] = "fantasy"
    ctx.phase = "choose_name"
    assert orch.resolve_purpose(ctx) == "mentor_guide"
