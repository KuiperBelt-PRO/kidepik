"""Eval de instrucciones de placement: 1 ítem por materia × banda (Gemini real).

No forma parte del compose de producto: solo sirve para revisar tautologías
y alineación pregunta↔opciones después de cambiar skills/prompts.

Uso (contenedor api)::

    python -m app.scripts.eval_placement_instructions
    python -m app.scripts.eval_placement_instructions --bands band_teen --subjects reading,language
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.catalogs.age_band import AgeBand
from app.catalogs.subject_catalog import SubjectCatalog
from app.config import get_settings
from app.services.dialogue import DialogueService

_BAND_AGES = {
    AgeBand.EARLY: 6,
    AgeBand.CHILD: 9,
    AgeBand.TWEEN: 12,
    AgeBand.TEEN: 15,
    AgeBand.ADULT: 35,
    AgeBand.SENIOR: 70,
}

_MEANING_OF_TERM = re.compile(
    r"(?:"
    r"significado(?:\s+\w+){0,2}\s+de(?:\s+la\s+palabra)?|"
    r"qu[eé]\s+significa|"
    r"qu[eé]\s+quiere\s+decir|"
    r"definici[oó]n(?:\s+\w+){0,2}\s+de|"
    r"sin[oó]nimo(?:\s+\w+){0,2}\s+de|"
    r"ant[oó]nimo(?:\s+\w+){0,2}\s+de"
    r")\s+"
    r"(?:el\s+|la\s+|los\s+|las\s+)?"
    r"['\"«“”]?\s*([a-záéíóúñü]{3,})",
    re.IGNORECASE,
)

_OUTPUT = Path("/var/www/html/logs/placement-eval.jsonl")


def _chunks(values: list[str], size: int) -> list[list[str]]:
    return [values[i : i + size] for i in range(0, len(values), size)]


def _review_item(item: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    presentation = " ".join(
        str(item.get(key) or "") for key in ("presentation_text", "prompt_text")
    )
    options = item.get("options") if isinstance(item.get("options"), list) else []
    labels = [str(opt.get("label") or "").strip() for opt in options]
    match = _MEANING_OF_TERM.search(presentation)
    if match:
        term = match.group(1).lower()
        for label in labels:
            tokens = re.findall(r"[a-záéíóúñü]+", label.lower())
            if tokens == [term]:
                issues.append(f"meaning_echo:{term}")
                break
    if len(labels) < 2:
        issues.append("too_few_options")
    if not str(item.get("correct_option_id") or "").strip():
        issues.append("missing_correct_option_id")
    return issues


def _child_for(band: str) -> dict[str, Any]:
    return {
        "id": str(uuid4()),
        "parent_id": str(uuid4()),
        "display_name": "EvalViajero",
        "world_theme": "sci-fi",
        "active_world_theme": "sci-fi",
        "onboarding_step": "placement",
        "placement_status": "in_progress",
        "age_band": band,
        "effective_age_band": band,
        "age_years": _BAND_AGES.get(band, 9),
        "explorer_gender": "female",
        "settings": {"learning": {"active_subjects": list(SubjectCatalog.ALL)}},
    }


async def _eval_band(
    svc: DialogueService,
    band: str,
    subjects: list[str],
    batch_size: int,
) -> list[dict[str, Any]]:
    child = _child_for(band)
    session_id = str(uuid4())
    rows: list[dict[str, Any]] = []
    for chunk in _chunks(subjects, batch_size):
        try:
            items = await svc._compose_placement_batch_with_retry(
                child,
                session_id,
                chunk,
                band,
                batch_index=0,
                batch_retries=svc.settings.ai_compose_batch_retries,
            )
        except Exception as exc:
            rows.append(
                {
                    "band": band,
                    "subjects": chunk,
                    "error": f"{type(exc).__name__}: {exc}"[:400],
                    "issues": ["compose_failed"],
                }
            )
            continue
        by_subject = {str(item.get("subject_id") or ""): item for item in items}
        for subject_id, item in zip(chunk, items, strict=False):
            resolved = by_subject.get(subject_id, item)
            issues = _review_item(resolved)
            rows.append(
                {
                    "band": band,
                    "subject_id": subject_id,
                    "prompt": str(
                        resolved.get("presentation_text")
                        or resolved.get("prompt_text")
                        or ""
                    )[:500],
                    "options": [
                        str(opt.get("label") or "")
                        for opt in (resolved.get("options") or [])
                    ],
                    "correct_option_id": resolved.get("correct_option_id"),
                    "issues": issues,
                }
            )
    return rows


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--bands",
        default=",".join(AgeBand.ALL),
        help="bandas separadas por coma",
    )
    parser.add_argument(
        "--subjects",
        default=",".join(SubjectCatalog.ALL),
        help="materias separadas por coma",
    )
    parser.add_argument("--batch-size", type=int, default=4)
    return parser.parse_args(argv)


async def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv or sys.argv[1:])
    bands = [part.strip() for part in args.bands.split(",") if part.strip()]
    subjects = [part.strip() for part in args.subjects.split(",") if part.strip()]
    for band in bands:
        if not AgeBand.is_valid(band):
            raise SystemExit(f"banda desconocida: {band}")
    for subject_id in subjects:
        if not SubjectCatalog.is_valid(subject_id):
            raise SystemExit(f"materia desconocida: {subject_id}")

    get_settings.cache_clear()
    settings = get_settings()
    if not settings.gemini_api_key_resolved():
        raise SystemExit("missing GOOGLE_API_KEY / GEMINI_API_KEY")

    svc = DialogueService(session=None)
    all_rows: list[dict[str, Any]] = []
    for band in bands:
        print(f"== {band} ({_BAND_AGES[band]} años) ==")
        rows = await _eval_band(svc, band, subjects, max(1, args.batch_size))
        all_rows.extend(rows)
        for row in rows:
            flag = "FAIL" if row.get("issues") else "ok"
            subject = row.get("subject_id") or ",".join(row.get("subjects") or [])
            print(f"  [{flag}] {subject}: {row.get('issues') or '-'}")
            if row.get("options"):
                print(f"       chips={row['options']}")

    _OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    _OUTPUT.write_text(
        "\n".join(json.dumps(row, ensure_ascii=False) for row in all_rows) + "\n",
        encoding="utf-8",
    )
    failed = [row for row in all_rows if row.get("issues")]
    print(f"wrote {_OUTPUT} rows={len(all_rows)} failed={len(failed)}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
