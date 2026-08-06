from __future__ import annotations

import pytest

from app.ai.errors import classify_gemini_exception, product_error
from app.ai.gemini_gateway import GeminiGateway
from app.ai.skills.loader import PURPOSE_SKILL_IDS, parse_skill_md, skill_ids_for
from app.ai.skills.loader import default_skills_root
from app.config import Settings


def test_classify_quota_daily() -> None:
    class Exc(Exception):
        status_code = 429

    classified = classify_gemini_exception(Exc("RESOURCE_EXHAUSTED: per day quota"))
    assert classified.error_code == "ai_quota_exhausted"
    assert classified.advance_model is True


def test_classify_rate_limit_rpm() -> None:
    class Exc(Exception):
        status_code = 429

    classified = classify_gemini_exception(Exc("RESOURCE_EXHAUSTED"))
    assert classified.error_code == "ai_rate_limited"


def test_product_error_payload() -> None:
    err = product_error("ai_quota_exhausted", model="gemini-3-flash-preview", models_tried=["a", "b"])
    body = err.to_dict()
    assert body["error_code"] == "ai_quota_exhausted"
    assert body["models_tried"] == ["a", "b"]
    assert body["retryable"] is False


def test_gemini_model_list_for_purpose() -> None:
    settings = Settings(
        ai_gemini_model_list="flash-3,flash-25",
        ai_gemini_model_list_lite="lite-25,lite-31",
    )
    assert settings.gemini_model_list_for_purpose("mentor_guide") == ["flash-3", "flash-25"]
    assert settings.gemini_model_list_for_purpose("journey_summarizer") == ["lite-25", "lite-31"]
    assert settings.gemini_model_tier_for_purpose("waiting_copy_writer") == "lite"
    assert settings.gemini_model_tier_for_purpose("placement_item_writer") == "quality"


@pytest.mark.asyncio
async def test_gateway_uses_lite_list_for_summarizer() -> None:
    settings = Settings(
        ai_enabled=True,
        google_api_key="test-key",
        ai_gemini_model_list="flash-3,flash-25",
        ai_gemini_model_list_lite="lite-25,lite-31",
    )
    gw = GeminiGateway(settings)
    calls: list[str] = []

    async def runner(model_id: str):
        calls.append(model_id)
        return {"ok": True}

    result, used = await gw.run_with_model_list("journey_summarizer", runner)
    assert result == {"ok": True}
    assert used == "lite-25"
    assert calls == ["lite-25"]


@pytest.mark.asyncio
async def test_gateway_advances_model_list() -> None:
    settings = Settings(
        ai_enabled=True,
        google_api_key="test-key",
        ai_gemini_model_list="model-a,model-b",
    )
    gw = GeminiGateway(settings)
    calls: list[str] = []

    async def runner(model_id: str):
        calls.append(model_id)
        if model_id == "model-a":
            raise product_error("ai_quota_exhausted", model=model_id)
        return {"ok": True}

    result, used = await gw.run_with_model_list("mentor_guide", runner)
    assert result == {"ok": True}
    assert used == "model-b"
    assert calls == ["model-a", "model-b"]


@pytest.mark.asyncio
async def test_gateway_requires_key() -> None:
    settings = Settings(ai_enabled=True, google_api_key="", gemini_api_key="")
    gw = GeminiGateway(settings)

    async def runner(_model_id: str):
        return 1

    with pytest.raises(Exception) as excinfo:
        await gw.run_with_model_list("mentor_guide", runner)
    assert excinfo.value.error_code == "ai_not_configured"  # type: ignore[attr-defined]


def test_skill_ids_for_mentor() -> None:
    ids = skill_ids_for("mentor_guide")
    assert "audience-language" in ids
    assert "mentor-voice" in ids
    assert "evaluation-rubric" not in ids


def test_all_purpose_skills_exist_on_disk() -> None:
    root = default_skills_root()
    missing = []
    for purpose, skill_ids in PURPOSE_SKILL_IDS.items():
        for sid in skill_ids:
            path = root / sid / "SKILL.md"
            if not path.is_file():
                missing.append(f"{purpose}:{sid}")
            else:
                parsed = parse_skill_md(path)
                assert parsed["id"] == sid
                assert parsed["instructions"]
    assert missing == []
