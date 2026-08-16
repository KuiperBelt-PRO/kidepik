"""Tests for baggage offer chips in play."""

from __future__ import annotations

import pytest

from app.services.baggage_offers import BaggageOfferService


@pytest.mark.unit
def test_challenge_context_path_challenge() -> None:
    ctx = BaggageOfferService._challenge_context(
        "path_challenge",
        {"phase": "path_challenge", "challenge_index": 1, "path_id": "p1"},
        {
            "path": {
                "path_id": "p1",
                "subject_id": "math",
                "challenges": [{"subject_id": "math"}, {"subject_id": "math"}],
            },
            "challenge_index": 1,
            "helps": {},
        },
        eligible_retry=False,
    )
    assert ctx is not None
    assert ctx["subject_id"] == "math"
    assert ctx["challenge_ref"] == "p1:1"


@pytest.mark.unit
def test_challenge_context_path_intro_retry() -> None:
    ctx = BaggageOfferService._challenge_context(
        "path_intro",
        {"phase": "path_intro", "retry": True, "challenge_index": 0},
        {
            "path": {
                "path_id": "p2",
                "subject_id": "language",
                "challenges": [{"subject_id": "language"}],
            },
            "helps": {},
        },
        eligible_retry=True,
    )
    assert ctx is not None
    assert ctx["eligible_retry"] is True
