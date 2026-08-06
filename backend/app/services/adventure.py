"""Adventure state helpers and compose-failure contract."""
from __future__ import annotations
from typing import Any
from app.catalogs import ZoneCatalog

class AdventureService:
    ZONE_INTRO_GATES=3
    ZONE_IDS=ZoneCatalog.ZONE_IDS
    def __init__(self,session:Any,gateway:Any=None,compose:Any=None)->None:self.session,self.gateway,self.compose=session,gateway,compose
    @staticmethod
    def zone_title(theme:str,zone_id:str)->str:return ZoneCatalog.label(theme,zone_id)
    @staticmethod
    def compose_failed_turn(compose_kind:str)->dict[str,Any]:
        return {"text":"","input_mode":"options_only","options":[{"id":"retry_compose","label":"Reintentar"}],"meta":{"phase":"compose_failed","error_code":"ADVENTURE_COMPOSE_FAILED","compose_kind":compose_kind,"compose_failed":True,"retry_allowed":True}}
    @staticmethod
    def completed_zone_ids(child:dict[str,Any])->list[str]:
        settings=child.get("settings") or {}; journey=settings.get("journey") if isinstance(settings,dict) else {}; zones=journey.get("zones_completed") if isinstance(journey,dict) else []
        return [str(x) for x in zones] if isinstance(zones,list) else []
