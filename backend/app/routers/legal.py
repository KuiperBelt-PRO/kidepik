from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.db import get_engine

router = APIRouter(tags=["legal"])

_SLUG_ALIASES = {
    "terms": "terms",
    "terminos": "terms",
    "privacy": "privacy",
    "privacidad": "privacy",
}


@router.get("/api/v1/legal/{slug}")
async def legal_show(slug: str) -> dict:
    canonical = _SLUG_ALIASES.get(slug.lower())
    if canonical is None:
        raise HTTPException(status_code=404, detail="Legal document not found")
    engine = get_engine()
    if engine is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                """
                SELECT slug, version, title, body_markdown, published_at
                FROM public.legal_documents
                WHERE slug = :slug
                ORDER BY version DESC
                LIMIT 1
                """
            ),
            {"slug": canonical},
        )
        row = result.mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Legal document not found")
    return {
        "slug": str(row["slug"]),
        "version": int(row["version"]),
        "title": str(row["title"]),
        "body_markdown": str(row["body_markdown"]),
        "published_at": str(row["published_at"]),
    }
