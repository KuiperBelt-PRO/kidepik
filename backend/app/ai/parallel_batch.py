"""Bounded asynchronous equivalent of PHP ParallelLlmBatch."""
from __future__ import annotations

import asyncio
import time
from typing import Any

from .gateway import LLMClient, LLMException


class ParallelLlmBatch:
    @staticmethod
    async def chat_many(
        model: str, jobs: list[dict[str, Any]], client: LLMClient, concurrency: int | None = None
    ) -> list[dict[str, Any]]:
        if not jobs:
            return []
        semaphore = asyncio.Semaphore(concurrency or len(jobs))

        async def run(job: dict[str, Any]) -> dict[str, Any]:
            started = time.perf_counter()
            async with semaphore:
                try:
                    result = await client.chat(model, job["messages"], job.get("opts", {}))
                    return {"ok": True, "content": result["content"], "http_status": 200,
                            "latency_ms": round((time.perf_counter() - started) * 1000)}
                except LLMException as exc:
                    return {"ok": False, "error": str(exc), "http_status": exc.status or None,
                            "latency_ms": round((time.perf_counter() - started) * 1000)}
        return list(await asyncio.gather(*(run(job) for job in jobs)))
