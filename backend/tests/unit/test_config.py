from __future__ import annotations

import pytest

from app.config import Settings, get_settings, settings_dict


@pytest.mark.unit
def test_parse_csv_empty_and_values() -> None:
    settings = Settings()
    assert settings.parse_csv("") == []
    assert settings.parse_csv(" a, b ,,c ") == ["a", "b", "c"]


@pytest.mark.unit
def test_gemini_helpers_defaults() -> None:
    settings = Settings(google_api_key="", gemini_api_key="")
    assert settings.gemini_api_key_resolved() == ""
    assert settings.gemini_model_list()[0] == "gemini-3-flash-preview"
    assert settings.gemini_model_list_lite()[0] == "gemini-2.5-flash-lite"
    assert settings.gemini_model_tier_for_purpose("placement_text_scorer") == "lite"
    assert settings.gemini_model_tier_for_purpose("dialogue") == "quality"
    assert settings.gemini_tts_model_list()[0] == "gemini-3.1-flash-tts-preview"
    assert settings.gemini_model_list_for_purpose("dictation_tts")[0].endswith("tts") or "tts" in settings.gemini_model_list_for_purpose("dictation_tts")[0]
    assert "tts" in settings.gemini_model_list_for_purpose("dictation_tts")[0]
    assert settings.gemini_model_list_for_purpose("dictation_composer")[0] == "gemini-3.1-flash-lite"
    assert settings.pydantic_google_model("gemini-test") == "google:gemini-test"
    assert settings.pydantic_google_model("google:gemini-test") == "google:gemini-test"
    assert settings.gemini_api_key_resolved() == (settings.google_api_key or settings.gemini_api_key).strip()


@pytest.mark.unit
def test_model_preference_seed_branches(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_MODEL_PREFERENCE_PLACEMENT", "place-a,place-b")
    monkeypatch.setenv("AI_MODEL_PREFERENCE_JOURNEY", "journey-a")
    monkeypatch.setenv("AI_MODEL_PREFERENCE_QUALITY", "quality-a")
    monkeypatch.setenv("AI_MODEL_PREFERENCE", "default-a")
    monkeypatch.setenv("OPENROUTER_MODELS", "or-a,or-b")
    get_settings.cache_clear()
    settings = get_settings()
    assert settings.model_preference_seed("placement_item_writer") == ["place-a", "place-b"]
    assert settings.model_preference_seed("dialogue") == ["journey-a"]
    assert settings.model_preference_seed("adventure_narrator") == ["quality-a"]
    get_settings.cache_clear()


@pytest.mark.unit
def test_feature_flags(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "local")
    monkeypatch.setenv("APP_DEBUG_AI", "true")
    monkeypatch.setenv("LOG_CLIENT_INGEST", "true")
    get_settings.cache_clear()
    settings = get_settings()
    assert settings.ai_debug_enabled() is True
    assert settings.client_log_ingest_enabled() is True
    assert isinstance(settings_dict(), dict)
    get_settings.cache_clear()
