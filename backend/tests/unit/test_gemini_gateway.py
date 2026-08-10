from __future__ import annotations

import pytest

from app.ai.errors import classify_gemini_exception, product_error
from app.ai.gemini_gateway import GeminiGateway
from app.ai.skills.loader import PURPOSE_SKILL_IDS, default_skills_root, parse_skill_md, skill_ids_for
from app.config import Settings


@pytest.mark.unit
@pytest.mark.parametrize(
    "status_code,message,expected_code,advance",
    [
        (429, "RESOURCE_EXHAUSTED: per day quota", "ai_quota_exhausted", True),
        (429, "RESOURCE_EXHAUSTED", "ai_rate_limited", True),
    ],
    ids=["daily-quota", "rpm"],
)
def test_classify_gemini_exception(
    status_code: int,
    message: str,
    expected_code: str,
    advance: bool,
) -> None:
    class Exc(Exception):
        pass

    exc = Exc(message)
    exc.status_code = status_code
    classified = classify_gemini_exception(exc)
    assert classified.error_code == expected_code
    assert classified.advance_model is advance


@pytest.mark.unit
def test_product_error_payload() -> None:
    err = product_error("ai_quota_exhausted", model="gemini-3-flash-preview", models_tried=["a", "b"])
    body = err.to_dict()
    assert body["error_code"] == "ai_quota_exhausted"
    assert body["models_tried"] == ["a", "b"]
    assert body["retryable"] is False


@pytest.mark.unit
def test_gemini_model_list_for_purpose() -> None:
    settings = Settings(
        ai_gemini_model_list="flash-3,flash-25",
        ai_gemini_model_list_lite="lite-25,lite-31",
    )
    assert settings.gemini_model_list_for_purpose("mentor_guide")[0] == "gemini-3-flash-preview"
    assert settings.gemini_model_list_for_purpose("path_composer")[0] == "gemini-3.1-flash-lite"
    assert settings.gemini_model_list_for_purpose("journey_summarizer") == [
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash-lite",
        "gemini-2.5-flash-lite",
    ]
    resilient = settings.gemini_model_list_resilient("mentor_guide")
    assert resilient[0] == "gemini-3-flash-preview"
    assert "gemini-3.1-flash-lite" in resilient
    assert settings.gemini_model_list_resilient("journey_summarizer") == [
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash-lite",
        "gemini-2.5-flash-lite",
    ]
    assert settings.gemini_model_tier_for_purpose("waiting_copy_writer") == "lite"
    assert settings.gemini_model_tier_for_purpose("placement_item_writer") == "quality"


@pytest.mark.unit
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
    assert used == "gemini-3.1-flash-lite"
    assert calls == ["gemini-3.1-flash-lite"]


@pytest.mark.unit
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

    result, used = await gw.run_with_model_list("dialogue", runner)
    assert result == {"ok": True}
    assert used == "model-b"
    assert calls == ["model-a", "model-b"]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_gateway_requires_key() -> None:
    settings = Settings(ai_enabled=True, google_api_key="", gemini_api_key="")
    gw = GeminiGateway(settings)

    async def runner(_model_id: str):
        return 1

    with pytest.raises(Exception) as excinfo:
        await gw.run_with_model_list("mentor_guide", runner)
    assert excinfo.value.error_code == "ai_not_configured"  # type: ignore[attr-defined]


@pytest.mark.unit
def test_skill_ids_for_mentor() -> None:
    ids = skill_ids_for("mentor_guide")
    assert "audience-language" in ids
    assert "mentor-voice" in ids
    assert "original-ip" in ids
    assert "evaluation-rubric" not in ids


@pytest.mark.unit
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


@pytest.mark.unit
def test_gateway_disabled_raises() -> None:
    gw = GeminiGateway(Settings(ai_enabled=False))
    with pytest.raises(Exception) as excinfo:
        gw.ensure_configured()
    assert excinfo.value.error_code == "ai_not_configured"  # type: ignore[attr-defined]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_gateway_raises_on_safety_block() -> None:
    settings = Settings(ai_enabled=True, google_api_key="test-key", ai_gemini_model_list="model-a")
    gw = GeminiGateway(settings)

    async def runner(_model_id: str):
        raise product_error("ai_safety_blocked", model="model-a")

    with pytest.raises(Exception) as excinfo:
        await gw.run_with_model_list("mentor_guide", runner)
    assert excinfo.value.error_code == "ai_safety_blocked"  # type: ignore[attr-defined]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_gateway_non_advance_exception_stops() -> None:
    settings = Settings(ai_enabled=True, google_api_key="test-key", ai_gemini_model_list="model-a,model-b")
    gw = GeminiGateway(settings)

    class Exc(Exception):
        pass

    exc = Exc("blocked")
    exc.status_code = 400

    async def runner(_model_id: str):
        raise exc

    with pytest.raises(Exception) as excinfo:
        await gw.run_with_model_list("mentor_guide", runner)
    assert excinfo.value.error_code  # type: ignore[attr-defined]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_gateway_exhausts_model_list() -> None:
    settings = Settings(ai_enabled=True, google_api_key="test-key", ai_gemini_model_list="model-a")
    gw = GeminiGateway(settings)

    async def runner(_model_id: str):
        raise product_error("ai_quota_exhausted", model="model-a")

    with pytest.raises(Exception) as excinfo:
        await gw.run_with_model_list("mentor_guide", runner)
    assert excinfo.value.error_code == "ai_quota_exhausted"  # type: ignore[attr-defined]
