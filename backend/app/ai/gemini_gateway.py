"""Gateway Gemini: lista de modelos free + clasificación de errores.

SPEC_AI_GEMINI_GATEWAY — delgado: no orquesta juego ni skills.
"""
from __future__ import annotations

import time
from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

from app.ai.errors import (
    AiProductError,
    classify_gemini_exception,
    product_error,
)
from app.config import Settings, get_settings
from app.logging_ import AppLogger

T = TypeVar("T")
ai_log = AppLogger("ai")


class GeminiGateway:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def is_enabled(self) -> bool:
        return bool(self.settings.ai_enabled)

    def ensure_configured(self) -> None:
        if not self.is_enabled():
            raise product_error("ai_not_configured")
        if not self.settings.gemini_api_key_resolved():
            raise product_error("ai_not_configured")

    def model_ids(self) -> list[str]:
        return self.settings.gemini_model_list()

    def model_ids_for_purpose(self, purpose: str) -> list[str]:
        return self.settings.gemini_model_list_for_purpose(purpose)

    def model_string(self, model_id: str) -> str:
        return self.settings.pydantic_google_model(model_id)

    async def run_with_model_list(
        self,
        purpose: str,
        runner: Callable[[str], Awaitable[T]],
        *,
        child_id: str | None = None,
    ) -> tuple[T, str]:
        """Prueba modelos en orden; ``runner`` recibe el id corto (sin prefijo google:)."""
        self.ensure_configured()
        tried: list[str] = []
        last_code = "ai_provider_unavailable"
        last_model: str | None = None

        for model_id in self.settings.gemini_model_list_resilient(purpose):
            tried.append(model_id)
            last_model = model_id
            started = time.perf_counter()
            try:
                result = await runner(model_id)
                duration_ms = int((time.perf_counter() - started) * 1000)
                ai_log.info(
                    "llm_attempt",
                    provider="gemini",
                    model=model_id,
                    ok=True,
                    duration_ms=duration_ms,
                    purpose=purpose,
                    child_id=child_id,
                )
                return result, model_id
            except AiProductError as exc:
                duration_ms = int((time.perf_counter() - started) * 1000)
                ai_log.warning(
                    "llm_attempt",
                    provider="gemini",
                    model=model_id,
                    ok=False,
                    error_class=exc.error_code,
                    http_status=exc.http_status,
                    duration_ms=duration_ms,
                    purpose=purpose,
                    child_id=child_id,
                )
                last_code = exc.error_code
                if exc.error_code in {"ai_not_configured", "ai_safety_blocked"}:
                    raise product_error(
                        exc.error_code,
                        model=model_id,
                        models_tried=tried,
                        retryable=exc.retryable,
                        http_status=exc.http_status,
                    ) from exc
                continue
            except Exception as exc:  # noqa: BLE001 — clasificar y avanzar lista
                classified = classify_gemini_exception(exc)
                duration_ms = int((time.perf_counter() - started) * 1000)
                ai_log.warning(
                    "llm_attempt",
                    provider="gemini",
                    model=model_id,
                    ok=False,
                    error_class=classified.error_code,
                    http_status=classified.http_status,
                    duration_ms=duration_ms,
                    purpose=purpose,
                    child_id=child_id,
                    raw=classified.raw[:500],
                )
                last_code = classified.error_code
                if not classified.advance_model:
                    raise product_error(
                        classified.error_code,
                        model=model_id,
                        models_tried=tried,
                        retryable=classified.retryable,
                        http_status=classified.http_status,
                    ) from exc
                continue

        raise product_error(
            last_code if last_code in {
                "ai_quota_exhausted",
                "ai_rate_limited",
                "ai_provider_unavailable",
            } else "ai_quota_exhausted",
            model=last_model,
            models_tried=tried,
            retryable=False,
        )
