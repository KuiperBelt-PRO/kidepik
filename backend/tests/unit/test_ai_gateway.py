from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from app.ai.gateway import AiAttemptTrace, AiGateway, LLMClient, LLMException
from app.config import Settings
from tests.helpers.db_session import FakeExecuteResult, ScriptedSession


@pytest.mark.unit
def test_ai_attempt_trace_to_dict() -> None:
    trace = AiAttemptTrace("dialogue", "env_seed", ["model:free"], 2)
    body = trace.to_dict()
    assert body["purpose"] == "dialogue"
    assert body["resolved_models"] == ["model:free"]


@pytest.mark.unit
@pytest.mark.parametrize(
    "message,expected",
    [
        ("transport error: boom", "transport"),
        ("empty content from upstream", "empty"),
        ("invalid JSON from upstream", "json"),
        ("upstream HTTP 429", "http"),
    ],
)
def test_classify_error(message: str, expected: str) -> None:
    assert AiGateway.classify_error(LLMException(message, 429)) == expected


@pytest.mark.unit
@pytest.mark.asyncio
async def test_llm_client_missing_key() -> None:
    settings = Settings(ai_enabled=True, openrouter_api_key="")
    client = LLMClient(settings)
    with pytest.raises(LLMException, match="OPENROUTER_API_KEY missing"):
        await client.chat("model:free", [{"role": "user", "content": "hola"}], {})


@pytest.mark.unit
@pytest.mark.asyncio
async def test_llm_client_success() -> None:
    settings = Settings(ai_enabled=True, openrouter_api_key="test-key")
    transport = httpx.MockTransport(
        lambda request: httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "  hola  "}}],
                "model": "model:free",
                "usage": {},
            },
        )
    )
    async with httpx.AsyncClient(transport=transport) as http:
        client = LLMClient(settings, client=http)
        result = await client.chat("model:free", [{"role": "user", "content": "hola"}], {})
    assert result["content"] == "hola"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ai_gateway_complete_uses_injected_queue() -> None:
    settings = Settings(ai_enabled=True, openrouter_api_key="test-key")
    transport = httpx.MockTransport(
        lambda request: httpx.Response(
            200,
            json={"choices": [{"message": {"content": "ok"}}], "model": "model:free"},
        )
    )
    async with httpx.AsyncClient(transport=transport) as http:
        gw = AiGateway(settings=settings, model_queue=["model:free"], client=http)
        result = await gw.complete([{"role": "user", "content": "hola"}], {"purpose": "dialogue"})
    assert result["content"] == "ok"
    assert gw.last_trace and gw.last_trace.winner_model == "model:free"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ai_gateway_disabled() -> None:
    gw = AiGateway(settings=Settings(ai_enabled=False))
    with pytest.raises(LLMException, match="AI disabled"):
        await gw.complete([{"role": "user", "content": "hola"}], {})


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ai_gateway_resolve_injected_queue() -> None:
    settings = Settings(ai_enabled=True)
    gw = AiGateway(settings=settings, model_queue=["model:free", "paid-model"])
    source, models = await gw._resolve("dialogue")
    assert source == "injected"
    assert models == ["model:free", "paid-model"]
