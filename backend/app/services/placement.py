"""Placement exam persistence service (async port surface)."""
from __future__ import annotations
import json
from typing import Any
from sqlalchemy import text
from app.catalogs import AgeBand, SubjectCatalog

class PlacementComposeFailedException(RuntimeError):
    def __init__(self,compose_debug:dict[str,Any])->None: super().__init__("PLACEMENT_COMPOSE_FAILED"); self.compose_debug=compose_debug
class PlacementService:
    def __init__(self,session:Any,bank:Any|None=None)->None:self.session,self.bank=session,bank
    @staticmethod
    def active_subjects_for_child(child:dict[str,Any])->list[str]:
        settings=child.get("settings") or {}; learning=settings.get("learning") if isinstance(settings,dict) else {}; raw=learning.get("active_subjects") if isinstance(learning,dict) else None
        band=AgeBand.from_legacy(child.get("age_band"),child.get("age_years")) or AgeBand.CHILD
        try:return SubjectCatalog.normalize_active_subjects(raw) if isinstance(raw,list) else SubjectCatalog.base_subjects_for_band(band)
        except ValueError:return SubjectCatalog.base_subjects_for_band(band)
    async def start_exam(self,child_id:str,child:dict[str,Any],session_id:str,flow_id:str,sequence:int,mentor_id:str,queue:list[dict[str,Any]])->dict[str,Any]:
        if not queue:raise PlacementComposeFailedException({"reason":"empty_queue"})
        await self.session.execute(text("update placement_exams set status='abandoned' where child_id=:id and status='in_progress'"),{"id":child_id})
        exam=(await self.session.execute(text("insert into placement_exams(child_id,world_theme,status,item_queue,current_index) values(:id,:theme,'in_progress',cast(:queue as jsonb),0) returning id"),{"id":child_id,"theme":child.get("world_theme") or "fantasy","queue":json.dumps(queue,ensure_ascii=False)})).scalar_one()
        await self.session.execute(text("update children set placement_status='in_progress',onboarding_step='placement',updated_at=now() where id=:id"),{"id":child_id})
        return {"exam_id":str(exam),"turn":self.item_to_turn(session_id,child_id,flow_id,sequence,mentor_id,child.get("world_theme") or "fantasy",queue[0],0,len(queue),child),"effects":[{"type":"advance_onboarding","to":"placement"}]}
    def item_to_turn(self,session_id:str,child_id:str,flow_id:str,sequence:int,mentor_id:str,theme:str,item:dict[str,Any],index:int,total:int,child:dict[str,Any]|None=None)->dict[str,Any]:
        typ=str(item.get("item_type") or "mcq"); return {"session_id":session_id,"child_id":child_id,"flow_id":flow_id,"sequence":sequence,"role":"mentor","text":str(item.get("presentation_text") or item.get("prompt_text") or ""),"input_mode":"options_only" if typ=="mcq" else "text_only","options":item.get("options"),"explorer_reply":None,"meta":{"phase":"placement_item","subject_id":item.get("subject_id"),"item_key":item.get("item_key"),"mentor_id":mentor_id,"index":index,"total":total},"model_used":None}
