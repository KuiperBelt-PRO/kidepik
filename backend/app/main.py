from __future__ import annotations

import time
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from app.ai.errors import AiProductError
from app.config import get_settings
from app.db import dispose_engine, init_engine
from app.db.migrations import MigrationError, MigrationRunner
from app.logging_ import channel, timed_ms
from app.routers import architecture, client_logs, health, legal, storage


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    init_engine(settings)
    if settings.run_migrations_on_startup:
        try:
            await MigrationRunner.from_env().ensure_applied()
        except MigrationError as exc:
            channel("api").error(
                "migration_failed",
                version=exc.version,
                message=str(exc),
            )
            raise
    yield
    await dispose_engine()


def create_app() -> FastAPI:
    app = FastAPI(title="kidepik-api", lifespan=lifespan)

    @app.middleware("http")
    async def log_requests(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration = timed_ms(start)
        status = response.status_code
        level = "error" if status >= 500 else ("warning" if status >= 400 else "info")
        getattr(channel("api"), level)(
            "http_request",
            method=request.method,
            path=request.url.path,
            status=status,
            duration_ms=duration,
            debug_ai_header=request.headers.get("x-kidepik-debug-ai") == "1",
        )
        return response

    @app.exception_handler(MigrationError)
    async def migration_failed(_request: Request, exc: MigrationError) -> JSONResponse:
        payload: dict = {"detail": "Migration failed"}
        if exc.version:
            payload["version"] = exc.version
        return JSONResponse(payload, status_code=503)

    @app.exception_handler(AiProductError)
    async def ai_product_failed(_request: Request, exc: AiProductError) -> JSONResponse:
        return JSONResponse(exc.to_dict(), status_code=exc.http_status)

    app.include_router(health.router)
    app.include_router(architecture.router)
    app.include_router(legal.router)
    app.include_router(storage.router)
    app.include_router(client_logs.router)

    for module_name in (
        "app.routers.parents",
        "app.routers.settings",
        "app.routers.crew",
        "app.routers.play",
        "app.routers.debug_ai",
        "app.routers.debug_journey",
    ):
        try:
            module = __import__(module_name, fromlist=["router"])
            app.include_router(module.router)
        except Exception as exc:  # noqa: BLE001 — no tumbar health por un router roto
            channel("api").error("router_import_failed", module=module_name, error=str(exc))

    return app


app = create_app()
