from __future__ import annotations
from typing import Any
from fastapi import APIRouter, Header, HTTPException, Query
from app.config import get_settings
from app.db import session_scope
from app.services.auth import AuthError, SupabaseAuthService
from app.services.debug_ai import DebugAiService
from app.services.parents import ParentAccountService

router=APIRouter(tags=["debug-ai"])
async def _auth(authorization:str|None)->None:
    if not get_settings().ai_debug_enabled(): raise HTTPException(404,"Not Found")
    try: claims=await SupabaseAuthService().validate_bearer(authorization)
    except AuthError as exc: raise HTTPException(401,exc.message) from exc
    if not claims.get("email"): raise HTTPException(422,"Email required")
    await ParentAccountService().get_or_bootstrap(claims["sub"],claims["email"],claims.get("display_name"),claims.get("avatar_url"))
@router.get("/api/v1/debug/ai/status")
async def status(authorization:str|None=Header(default=None))->dict[str,Any]:
    await _auth(authorization)
    async with session_scope() as s:return await DebugAiService(s).status()
@router.get("/api/v1/debug/ai/queues")
async def queues(purpose:str|None=Query(default=None),authorization:str|None=Header(default=None))->dict[str,Any]:
    await _auth(authorization)
    async with session_scope() as s:return {"rows":await DebugAiService(s).queues(purpose)}
@router.get("/api/v1/debug/ai/resolve")
async def resolve(purpose:str=Query(default="placement_exam_composer"),authorization:str|None=Header(default=None))->dict[str,Any]:
    await _auth(authorization)
    async with session_scope() as s:return await DebugAiService(s).resolve(purpose)
@router.get("/api/v1/debug/ai/attempts")
async def attempts(limit:int=Query(default=20),authorization:str|None=Header(default=None))->dict[str,Any]:
    await _auth(authorization)
    async with session_scope() as s:return {"attempts":await DebugAiService(s).attempts(limit)}
@router.post("/api/v1/debug/ai/ping")
async def ping(payload:dict[str,Any]|None=None,authorization:str|None=Header(default=None))->dict[str,Any]:
    await _auth(authorization)
    async with session_scope() as s:return await DebugAiService(s).ping((payload or {}).get("child_id"))
