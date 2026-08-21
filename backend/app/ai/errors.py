"""Códigos de error del camino Gemini agentic (SPEC_AI_GEMINI_GATEWAY)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


class AiProductError(Exception):
    """Error de producto tipado para mapear a HTTP JSON."""

    def __init__(
        self,
        error_code: str,
        detail: str,
        *,
        http_status: int = 503,
        provider: str = "gemini",
        model: str | None = None,
        models_tried: list[str] | None = None,
        retryable: bool = False,
        compose_debug: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(detail)
        self.error_code = error_code
        self.detail = detail
        self.http_status = http_status
        self.provider = provider
        self.model = model
        self.models_tried = models_tried or []
        self.retryable = retryable
        self.compose_debug = compose_debug or {}

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "detail": self.detail,
            "error_code": self.error_code,
            "provider": self.provider,
            "retryable": self.retryable,
        }
        if self.model:
            payload["model"] = self.model
        if self.models_tried:
            payload["models_tried"] = self.models_tried
        return payload


COPY = {
    "ai_quota_exhausted": (
        "Se ha acabado la cuota gratuita de IA por ahora. Vuelve más tarde."
    ),
    "ai_rate_limited": (
        "La IA está muy ocupada ahora. Espera un momento e inténtalo de nuevo."
    ),
    "ai_provider_unavailable": (
        "No hemos podido hablar con la IA. Reinténtalo."
    ),
    "ai_not_configured": "La IA no está configurada en este entorno.",
    "ai_compose_failed": "No se pudo generar la respuesta. Reinténtalo.",
    "ai_safety_blocked": (
        "No podemos continuar con ese mensaje. Prueba otra respuesta."
    ),
}


@dataclass
class ClassifiedGeminiError:
    error_code: str
    http_status: int
    retryable: bool
    advance_model: bool
    raw: str = ""


def classify_gemini_exception(exc: BaseException) -> ClassifiedGeminiError:
    """Clasifica excepciones de Google / httpx / genai en códigos de producto."""
    text = f"{type(exc).__name__}: {exc}".lower()
    status = getattr(exc, "status_code", None) or getattr(exc, "code", None) or 0
    try:
        status = int(status)
    except (TypeError, ValueError):
        status = 0

    if "resource_exhausted" in text or status == 429:
        if any(token in text for token in ("per day", "daily", "quota", "rpd")):
            return ClassifiedGeminiError(
                "ai_quota_exhausted", 503, False, True, text
            )
        return ClassifiedGeminiError("ai_rate_limited", 429, True, True, text)

    if status in {401, 403} or "api key" in text or "permission" in text:
        return ClassifiedGeminiError("ai_not_configured", 503, False, False, text)

    if status == 400 and ("safety" in text or "blocked" in text):
        return ClassifiedGeminiError("ai_safety_blocked", 422, False, False, text)

    if status >= 500 or "unavailable" in text or "timeout" in text:
        return ClassifiedGeminiError(
            "ai_provider_unavailable", 503, True, True, text
        )

    return ClassifiedGeminiError("ai_provider_unavailable", 503, True, True, text)


def product_error(
    error_code: str,
    *,
    model: str | None = None,
    models_tried: list[str] | None = None,
    retryable: bool | None = None,
    http_status: int | None = None,
    compose_debug: dict[str, Any] | None = None,
    detail: str | None = None,
) -> AiProductError:
    defaults = {
        "ai_quota_exhausted": (503, False),
        "ai_rate_limited": (429, True),
        "ai_provider_unavailable": (503, True),
        "ai_not_configured": (503, False),
        "ai_compose_failed": (503, False),
        "ai_safety_blocked": (422, False),
    }
    status, retry = defaults.get(error_code, (503, False))
    message = detail or COPY.get(error_code, COPY["ai_provider_unavailable"])
    return AiProductError(
        error_code,
        message,
        http_status=http_status if http_status is not None else status,
        model=model,
        models_tried=models_tried,
        retryable=retryable if retryable is not None else retry,
        compose_debug=compose_debug,
    )


@dataclass
class LlmAttemptLog:
    purpose: str
    model: str
    ok: bool
    error_class: str | None = None
    http_status: int | None = None
    duration_ms: int = 0
    child_id: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)
