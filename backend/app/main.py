"""FastAPI entrypoint — POC local / Cloud Run target."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import architecture, storage_routes

app = FastAPI(title=settings.app_name, version="0.1.0-poc")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    """Cloud Run compatible health probe."""
    return {"status": "ok", "service": settings.app_name}


app.include_router(architecture.router)
app.include_router(storage_routes.router)
