"""OpenRouter free-model gateway.

This is the async port of shared/Ai/AiGateway.php and LLMClient.php.  It never
selects paid models: every resolved model must end in ``:free``.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings


class LLMException(RuntimeError):
    def __init__(self, message: str, status: int = 0) -> None:
        super().__init__(message)
        self.status = status


@dataclass
class AiAttemptTrace:
    purpose: str
    queue_source: str
    resolved_models: list[str]
    max_attempts: int
    attempts: list[dict[str, Any]] = field(default_factory=list)
    winner_model: str | None = None
    total_latency_ms: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "purpose": self.purpose, "queue_source": self.queue_source,
            "resolved_models": self.resolved_models, "max_attempts": self.max_attempts,
            "attempts": self.attempts, "winner_model": self.winner_model,
            "total_latency_ms": self.total_latency_ms,
        }


class LLMClient:
    def __init__(self, settings: Settings | None = None, client: httpx.AsyncClient | None = None) -> None:
        self.settings = settings or get_settings()
        self.client = client

    async def chat(self, model: str, messages: list[dict[str, str]], opts: dict[str, Any]) -> dict[str, Any]:
        if not self.settings.openrouter_api_key:
            raise LLMException("OPENROUTER_API_KEY missing", 503)
        payload: dict[str, Any] = {
            "model": model, "messages": messages, "temperature": opts.get("temperature", 0.5),
        }
        for key in ("max_tokens", "response_format"):
            if key in opts:
                payload[key] = opts[key]
        owns = self.client is None
        client = self.client or httpx.AsyncClient(timeout=30.0, connect_timeout=10.0)
        try:
            response = await client.post(
                f"{self.settings.openrouter_base}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.settings.openrouter_api_key}",
                    "HTTP-Referer": self.settings.ai_http_referer,
                    "X-Title": self.settings.ai_app_title,
                },
                json=payload,
            )
            if not response.is_success:
                raise LLMException(f"upstream HTTP {response.status_code}", response.status_code)
            try:
                data = response.json()
            except ValueError as exc:
                raise LLMException("invalid JSON from upstream", response.status_code) from exc
            content = data.get("choices", [{}])[0].get("message", {}).get("content")
            if not isinstance(content, str) or not content.strip():
                raise LLMException("empty content from upstream", response.status_code)
            return {"content": content.strip(), "usage": data.get("usage"), "raw_model": data.get("model")}
        except httpx.HTTPError as exc:
            raise LLMException(f"transport error: {exc}") from exc
        finally:
            if owns:
                await client.aclose()


class AiGateway:
    def __init__(self, session: AsyncSession | None = None, settings: Settings | None = None,
                 model_queue: list[str] | None = None, client: httpx.AsyncClient | None = None) -> None:
        self.session, self.settings, self.model_queue, self.client = session, settings or get_settings(), model_queue, client
        self.last_trace: AiAttemptTrace | None = None

    def is_enabled(self) -> bool:
        return self.settings.ai_enabled

    async def resolve_queue_snapshot(self, purpose: str) -> dict[str, Any]:
        source, models = await self._resolve(purpose)
        return {"queue_source": source, "resolved_models": models, "max_attempts": self.settings.ai_max_model_attempts}

    async def _resolve(self, purpose: str) -> tuple[str, list[str]]:
        if self.model_queue is not None:
            return "injected", self.model_queue[:self.settings.ai_max_model_attempts]
        ids: list[str] = []
        if self.session is not None:
            try:
                rows = (await self.session.execute(text(
                    "select model_id from ai_purpose_model_queues where purpose=:purpose "
                    "and enabled=true order by priority asc"
                ), {"purpose": purpose})).scalars().all()
                ids.extend(str(row) for row in rows)
            except Exception:
                pass
        ids.extend(self.settings.model_preference_seed(purpose))
        unique = list(dict.fromkeys(item for item in ids if item.endswith(":free")))
        return ("db" if ids and self.session is not None else "env_seed",
                unique[:self.settings.ai_max_model_attempts])

    async def complete(self, messages: list[dict[str, str]], opts: dict[str, Any] | None = None) -> dict[str, Any]:
        opts = opts or {}
        if not self.is_enabled():
            raise LLMException("AI disabled", 503)
        purpose = str(opts.get("purpose", "dialogue"))
        source, models = await self._resolve(purpose)
        if not models:
            raise LLMException("no free models available", 503)
        trace = AiAttemptTrace(purpose, source, models, self.settings.ai_max_model_attempts)
        last: LLMException | None = None
        for model in models:
            started = time.perf_counter()
            try:
                result = await LLMClient(self.settings, self.client).chat(model, messages, opts)
                latency = round((time.perf_counter() - started) * 1000)
                trace.attempts.append({"model_id": model, "ok": True, "latency_ms": latency})
                trace.winner_model = str(result.get("raw_model") or model)
                trace.total_latency_ms += latency
                self.last_trace = trace
                return {"content": result["content"], "provider": "openrouter",
                        "model": trace.winner_model, "usage": result.get("usage"),
                        **({"trace": trace.to_dict()} if opts.get("capture_trace") else {})}
            except LLMException as exc:
                latency = round((time.perf_counter() - started) * 1000)
                trace.attempts.append({"model_id": model, "ok": False, "http_status": exc.status or None,
                                       "latency_ms": latency, "error_class": self.classify_error(exc),
                                       "error_brief": str(exc)[:160]})
                trace.total_latency_ms += latency
                last = exc
        self.last_trace = trace
        raise last or LLMException("all free models failed", 503)

    @staticmethod
    def classify_error(error: LLMException) -> str:
        message = str(error).lower()
        if "transport" in message:
            return "transport"
        if "timeout" in message:
            return "timeout"
        if "empty content" in message:
            return "empty"
        if "invalid json" in message:
            return "json"
        return "http" if error.status >= 400 else "other"
