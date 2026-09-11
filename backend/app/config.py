from __future__ import annotations

from functools import lru_cache
from typing import Any

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


GEMINI_LITE_PURPOSES = frozenset(
    {
        "waiting_copy_writer",
        "journey_summarizer",
        "placement_text_scorer",
    }
)

# Cadenas por tier (ver .cursor/operations/GEMINI_API_FREE_TIER_LIMITS_KIDEPIK.md)
GEMINI_LITE_CHAIN: tuple[str, ...] = (
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash-lite",
)
GEMINI_QUALITY_CHAIN: tuple[str, ...] = (
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
    "gemini-3.5-flash-preview",
    "gemini-3.6-flash-preview",
)

def _dedupe_models(models: list[str]) -> list[str]:
    return list(dict.fromkeys(m for m in models if m))


def _chain(*parts: tuple[str, ...]) -> list[str]:
    merged: list[str] = []
    for part in parts:
        merged.extend(part)
    return _dedupe_models(merged)


# Orden de fallback por agente: primero preferente, luego reserva si cuota/RPM agotada.
GEMINI_PURPOSE_MODEL_DEFAULTS: dict[str, list[str]] = {
    # Composes batch: lite primero (≈500 RPD en proyecto kidepik) → quality
    "path_composer": _chain(GEMINI_LITE_CHAIN, GEMINI_QUALITY_CHAIN),
    "placement_item_writer": _chain(GEMINI_LITE_CHAIN, GEMINI_QUALITY_CHAIN),
    "zone_pitch_writer": _chain(GEMINI_LITE_CHAIN, GEMINI_QUALITY_CHAIN),
    # Diálogo / narrativa: calidad primero → lite
    "mentor_guide": _chain(GEMINI_QUALITY_CHAIN, GEMINI_LITE_CHAIN),
    "onboarding_host": _chain(GEMINI_QUALITY_CHAIN, GEMINI_LITE_CHAIN),
    "character_coach": _chain(GEMINI_QUALITY_CHAIN, GEMINI_LITE_CHAIN),
    "zone_scene_writer": _chain(GEMINI_QUALITY_CHAIN, GEMINI_LITE_CHAIN),
    "adventure_narrator": _chain(GEMINI_QUALITY_CHAIN, GEMINI_LITE_CHAIN),
    # Lite-only / scoring
    "placement_text_scorer": list(GEMINI_LITE_CHAIN),
    "waiting_copy_writer": list(GEMINI_LITE_CHAIN),
    "journey_summarizer": list(GEMINI_LITE_CHAIN),
    "safety_rewriter": _chain(GEMINI_LITE_CHAIN, GEMINI_QUALITY_CHAIN),
    "challenge_writer": _chain(GEMINI_LITE_CHAIN, GEMINI_QUALITY_CHAIN),
    "challenge_result_writer": _chain(GEMINI_LITE_CHAIN, GEMINI_QUALITY_CHAIN),
    "dictation_composer": _chain(GEMINI_LITE_CHAIN, GEMINI_QUALITY_CHAIN),
    "dictation_grader": _chain(GEMINI_LITE_CHAIN, GEMINI_QUALITY_CHAIN),
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=None,
        extra="ignore",
        populate_by_name=True,
    )

    app_name: str = Field(default="kidepik-api", alias="APP_NAME")
    app_env: str = Field(default="local", alias="APP_ENV")
    app_debug_ai: bool = Field(default=True, alias="APP_DEBUG_AI")

    supabase_url: str = Field(
        default="http://host.docker.internal:54321",
        alias="SUPABASE_URL",
    )
    supabase_anon_key: str = Field(default="", alias="SUPABASE_ANON_KEY")
    database_url: str | None = Field(default=None, alias="DATABASE_URL")

    public_api_url: str = Field(default="/api/v1", alias="PUBLIC_API_URL")
    public_supabase_url: str = Field(
        default="http://localhost:54321",
        alias="PUBLIC_SUPABASE_URL",
    )

    storage_driver: str = Field(default="local", alias="STORAGE_DRIVER")
    media_root: str = Field(default="/var/www/html/media", alias="MEDIA_ROOT")
    media_public_base_url: str = Field(default="/media", alias="MEDIA_PUBLIC_BASE_URL")
    upload_token_ttl: int = Field(default=900, alias="UPLOAD_TOKEN_TTL")

    log_dir: str = Field(default="/var/www/html/logs", alias="LOG_DIR")
    log_level: str = Field(default="info", alias="LOG_LEVEL")
    log_to_files: bool = Field(default=True, alias="LOG_TO_FILES")
    log_buffer_lines: int = Field(default=32, alias="LOG_BUFFER_LINES")
    log_flush_ms: int = Field(default=500, alias="LOG_FLUSH_MS")
    log_client_ingest: bool = Field(default=True, alias="LOG_CLIENT_INGEST")
    client_log_level: str = Field(default="info", alias="CLIENT_LOG_LEVEL")

    migrations_dir: str = Field(
        default="/var/www/supabase/migrations",
        alias="MIGRATIONS_DIR",
    )
    run_migrations_on_startup: bool = Field(
        default=True,
        alias="RUN_MIGRATIONS_ON_STARTUP",
    )

    ai_enabled: bool = Field(default=True, alias="AI_ENABLED")
    ai_provider: str = Field(default="gemini", alias="AI_PROVIDER")
    google_api_key: str = Field(default="", alias="GOOGLE_API_KEY")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    ai_gemini_model_list: str = Field(
        default="gemini-3-flash-preview,gemini-2.5-flash,gemini-3.5-flash-preview,gemini-3.6-flash-preview",
        alias="AI_GEMINI_MODEL_LIST",
    )
    ai_gemini_model_list_lite: str = Field(
        default="gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-2.5-flash-lite",
        alias="AI_GEMINI_MODEL_LIST_LITE",
    )
    journey_data_dir: str = Field(default="/data/journey", alias="JOURNEY_DATA_DIR")
    glossary_data_dir: str = Field(default="/data/glossary", alias="GLOSSARY_DATA_DIR")
    glossary_compose_enabled: bool = Field(default=True, alias="GLOSSARY_COMPOSE_ENABLED")
    waiting_data_dir: str = Field(default="/data/waiting", alias="WAITING_DATA_DIR")
    chapters_data_dir: str = Field(default="/data/chapters", alias="CHAPTERS_DATA_DIR")
    items_data_dir: str = Field(default="/data/items", alias="ITEMS_DATA_DIR")
    ai_summary_every_n: int = Field(default=8, alias="AI_SUMMARY_EVERY_N")

    # Legado OpenRouter (PHP / port parcial) — no usar en camino agentic Gemini
    openrouter_api_key: str = Field(default="", alias="OPENROUTER_API_KEY")
    openrouter_base_url: str = Field(
        default="https://openrouter.ai/api/v1",
        alias="OPENROUTER_BASE_URL",
    )
    openrouter_models: str = Field(default="", alias="OPENROUTER_MODELS")
    ai_model_preference: str = Field(default="", alias="AI_MODEL_PREFERENCE")
    ai_model_preference_quality: str = Field(default="", alias="AI_MODEL_PREFERENCE_QUALITY")
    ai_model_preference_journey: str = Field(default="", alias="AI_MODEL_PREFERENCE_JOURNEY")
    ai_model_preference_placement: str = Field(
        default="",
        alias="AI_MODEL_PREFERENCE_PLACEMENT",
    )
    ai_http_referer: str = Field(default="http://localhost:8082", alias="AI_HTTP_REFERER")
    ai_app_title: str = Field(default="KidepiK Local", alias="AI_APP_TITLE")
    ai_max_model_attempts: int = Field(default=12, alias="AI_MAX_MODEL_ATTEMPTS")
    ai_rate_limit_per_child_day: int = Field(default=80, alias="AI_RATE_LIMIT_PER_CHILD_DAY")
    ai_compose_batch_max_slots: int = Field(default=4, alias="AI_COMPOSE_BATCH_MAX_SLOTS")
    ai_compose_batch_retries: int = Field(default=3, alias="AI_COMPOSE_BATCH_RETRIES")
    ai_gemini_tts_model_list: str = Field(
        default="gemini-3.1-flash-tts-preview,gemini-2.5-flash-preview-tts",
        alias="AI_GEMINI_TTS_MODEL_LIST",
    )
    ai_tts_voice: str = Field(default="Kore", alias="AI_TTS_VOICE")
    ai_tts_language: str = Field(default="es-ES", alias="AI_TTS_LANGUAGE")

    @property
    def media_base(self) -> str:
        base = self.media_public_base_url.strip() or "/media"
        return base.rstrip("/")

    @property
    def supabase_base(self) -> str:
        return self.supabase_url.rstrip("/")

    @property
    def openrouter_base(self) -> str:
        return self.openrouter_base_url.rstrip("/")

    def ai_debug_enabled(self) -> bool:
        return self.app_env == "local" and self.app_debug_ai

    def client_log_ingest_enabled(self) -> bool:
        return self.log_client_ingest

    def parse_csv(self, raw: str) -> list[str]:
        if not raw.strip():
            return []
        return [part.strip() for part in raw.split(",") if part.strip()]

    def gemini_api_key_resolved(self) -> str:
        return (self.google_api_key or self.gemini_api_key or "").strip()

    def gemini_model_list(self) -> list[str]:
        models = self.parse_csv(self.ai_gemini_model_list)
        return models or ["gemini-3-flash-preview"]

    def gemini_model_list_lite(self) -> list[str]:
        models = self.parse_csv(self.ai_gemini_model_list_lite)
        return models or ["gemini-2.5-flash-lite"]

    def gemini_model_tier_for_purpose(self, purpose: str) -> str:
        return "lite" if purpose in GEMINI_LITE_PURPOSES else "quality"

    def gemini_tts_model_list(self) -> list[str]:
        models = self.parse_csv(self.ai_gemini_tts_model_list)
        return models or [
            "gemini-3.1-flash-tts-preview",
            "gemini-2.5-flash-preview-tts",
        ]

    def gemini_model_list_for_purpose(self, purpose: str) -> list[str]:
        if purpose == "dictation_tts":
            return self.gemini_tts_model_list()
        if purpose in GEMINI_PURPOSE_MODEL_DEFAULTS:
            return list(GEMINI_PURPOSE_MODEL_DEFAULTS[purpose])
        if purpose in GEMINI_LITE_PURPOSES:
            return self.gemini_model_list_lite()
        return self.gemini_model_list()

    def gemini_model_list_resilient(self, purpose: str) -> list[str]:
        """Lista ordenada de fallback para el purpose (incluye reserva lite/quality si aplica)."""
        if purpose == "dictation_tts":
            return self.gemini_tts_model_list()
        if purpose in GEMINI_PURPOSE_MODEL_DEFAULTS:
            return list(GEMINI_PURPOSE_MODEL_DEFAULTS[purpose])
        primary = self.gemini_model_list_for_purpose(purpose)
        if purpose in GEMINI_LITE_PURPOSES:
            return primary
        extra = [model for model in self.gemini_model_list_lite() if model not in primary]
        return primary + extra

    def pydantic_google_model(self, model_id: str | None = None) -> str:
        mid = (model_id or self.gemini_model_list()[0]).strip()
        if mid.startswith("google:"):
            return mid
        return f"google:{mid}"

    def model_preference_seed(self, purpose: str) -> list[str]:
        if purpose.startswith("placement_") or purpose in {
            "placement_exam_composer",
            "placement_exam_batch_writer",
            "placement_item_writer",
        }:
            seed = self.parse_csv(self.ai_model_preference_placement)
            if seed:
                return seed
        if purpose in {"dialogue", "journey_summarizer"}:
            seed = self.parse_csv(self.ai_model_preference_journey)
            if seed:
                return seed
        if purpose.startswith("adventure_") or purpose in {
            "dialogue",
            "journey_summarizer",
            "placement_exam_composer",
            "placement_exam_batch_writer",
            "placement_item_writer",
        } or purpose.startswith("placement_"):
            seed = self.parse_csv(self.ai_model_preference_quality)
            if seed:
                return seed
        seed = self.parse_csv(self.ai_model_preference)
        if seed:
            return seed
        return self.parse_csv(self.openrouter_models)


@lru_cache
def get_settings() -> Settings:
    return Settings()


def settings_dict() -> dict[str, Any]:
    return get_settings().model_dump()
