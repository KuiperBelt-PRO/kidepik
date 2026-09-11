"""Diff token-wise y umbral de aprobado (SPEC_APP_DICTATION §4.5–4.6)."""
from __future__ import annotations

import re
import unicodedata
from typing import Any

PASS_THRESHOLD: dict[str, float] = {
    "band_early": 0.75,
    "band_child": 0.80,
    "band_tween": 0.85,
    "band_teen": 0.90,
    "band_adult": 0.90,
    "band_senior": 0.85,
}
MAX_SEVERE: dict[str, int] = {
    "band_early": 3,
    "band_child": 3,
    "band_tween": 2,
    "band_teen": 2,
    "band_adult": 2,
    "band_senior": 2,
}
SEVERE_CLASSES = frozenset({"grapheme", "accent"})
_WORD_RE = re.compile(r"\w+|[^\w\s]", re.UNICODE)


def pass_threshold_for_band(band: str | None) -> float:
    return PASS_THRESHOLD.get(str(band or ""), 0.80)


def max_severe_for_band(band: str | None) -> int:
    return MAX_SEVERE.get(str(band or ""), 3)


def tokenize_dictation(text: str) -> list[str]:
    normalized = unicodedata.normalize("NFC", text or "")
    return [tok for tok in _WORD_RE.findall(normalized) if tok.strip()]


def _strip_marks(token: str) -> str:
    decomposed = unicodedata.normalize("NFD", token)
    return "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")


def _letters(token: str) -> str:
    return "".join(ch for ch in token if ch.isalnum())


def classify_token_error(expected: str, got: str | None) -> str | None:
    if got is None or got == "":
        return "omission"
    if expected == got:
        return None
    exp_letters = _letters(expected)
    got_letters = _letters(got)
    if not exp_letters and not got_letters:
        return "punctuation"
    if not exp_letters or not got_letters:
        return "punctuation"
    exp_fold = _strip_marks(expected).casefold()
    got_fold = _strip_marks(got).casefold()
    if exp_fold == got_fold:
        if expected.casefold() != got.casefold():
            return "accent"
        return "capitalization"
    return "grapheme"


def _align_errors(expected: list[str], got: list[str]) -> list[dict[str, str]]:
    errors: list[dict[str, str]] = []
    i = 0
    j = 0
    while i < len(expected) or j < len(got):
        exp = expected[i] if i < len(expected) else None
        actual = got[j] if j < len(got) else None
        if exp is not None and actual is not None and exp == actual:
            i += 1
            j += 1
            continue
        if exp is not None and actual is not None:
            kind = classify_token_error(exp, actual)
            if kind:
                errors.append(
                    {
                        "error_class": kind,
                        "expected": exp,
                        "got": actual,
                    }
                )
            i += 1
            j += 1
            continue
        if exp is not None and actual is None:
            errors.append({"error_class": "omission", "expected": exp, "got": ""})
            i += 1
            continue
        if actual is not None and exp is None:
            errors.append({"error_class": "insertion", "expected": "", "got": actual})
            j += 1
            continue
        break
    return errors


def grade_transcription(
    canonical: str,
    transcription: str,
    band: str | None,
) -> dict[str, Any]:
    exp = tokenize_dictation(unicodedata.normalize("NFC", canonical or ""))
    got = tokenize_dictation(unicodedata.normalize("NFC", transcription or ""))
    if not exp:
        return {"score": 1.0, "passed": True, "errors": []}
    errors = _align_errors(exp, got)
    correct = 0
    gi = 0
    for token in exp:
        if gi < len(got) and got[gi] == token:
            correct += 1
            gi += 1
        elif gi < len(got):
            gi += 1
    score = correct / len(exp)
    # recount correct as tokens without error on expected side
    expected_errors = [
        e for e in errors if e["error_class"] not in {"insertion"}
    ]
    correct = max(0, len(exp) - len(expected_errors))
    score = round(correct / len(exp), 4)
    severe = sum(1 for e in errors if e["error_class"] in SEVERE_CLASSES)
    passed = score >= pass_threshold_for_band(band) and severe <= max_severe_for_band(
        band
    )
    return {"score": score, "passed": passed, "errors": errors}
