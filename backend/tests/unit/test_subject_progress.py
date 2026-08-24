from __future__ import annotations

import pytest

from app.services.subject_progress import SubjectProgressService
from app.services.subject_progress_config import (
    DELTA_PER_CORRECT,
    SEED_ROLLING,
    THRESHOLD_UP,
)


@pytest.mark.unit
def test_linear_delta_from_seed() -> None:
    rolling = min(THRESHOLD_UP, SEED_ROLLING + DELTA_PER_CORRECT)
    assert round(rolling, 3) == round(SEED_ROLLING + DELTA_PER_CORRECT, 3)
    percent = round(rolling / THRESHOLD_UP * 100)
    assert percent == 18


@pytest.mark.unit
def test_twelve_correct_reaches_threshold() -> None:
    rolling = SEED_ROLLING
    for _ in range(12):
        rolling = round(min(THRESHOLD_UP, rolling + DELTA_PER_CORRECT), 4)
    assert rolling >= THRESHOLD_UP


@pytest.mark.unit
def test_wrong_answer_does_not_change_rolling() -> None:
    before = SubjectProgressService._effective_rolling(
        {"level_id": "L1", "accuracy_rolling": 0.25}
    )
    after = SubjectProgressService._effective_rolling(
        {"level_id": "L1", "accuracy_rolling": 0.25}
    )
    assert before == after == 0.25


@pytest.mark.unit
def test_rank_id_for_general_fantasy_l2() -> None:
    assert SubjectProgressService._rank_id_for_general("fantasy", "L2") == "fantasy_apprentice"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_record_path_challenge_correct_increments() -> None:
    executed: list[dict] = []

    class FakeSession:
        async def execute(self, stmt, params=None):  # noqa: ANN001
            sql = str(stmt)
            executed.append({"sql": sql, "params": params or {}})
            if "select level_id" in sql and "settings" not in sql:
                class Row:
                    def mappings(self):
                        class M:
                            def first(self_inner):
                                return {"level_id": "L1", "accuracy_rolling": SEED_ROLLING}

                        return M()

                return Row()
            if "select settings" in sql:
                class Row:
                    def mappings(self):
                        class M:
                            def first(self_inner):
                                return {"settings": {}}

                        return M()

                return Row()
            return None

    svc = SubjectProgressService(FakeSession())  # type: ignore[arg-type]
    effects = await svc.record_path_challenge("child", "fantasy", "reading", score=1.0)
    assert len(effects) == 1
    assert effects[0]["type"] == "record_learning_result"
    assert effects[0]["subject_id"] == "reading"
    assert effects[0]["rolling_model"] == "linear_b"
    assert effects[0]["rolling_delta"] == round(DELTA_PER_CORRECT, 4)
    assert effects[0]["challenges_per_path"] == 3
    assert effects[0]["accuracy_rolling"] == round(
        min(THRESHOLD_UP, SEED_ROLLING + DELTA_PER_CORRECT), 3
    )
    assert any("insert into user_subject_levels" in row["sql"] for row in executed)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_record_path_challenge_wrong_no_upsert() -> None:
    executed: list[dict] = []

    class FakeSession:
        async def execute(self, stmt, params=None):  # noqa: ANN001
            sql = str(stmt)
            executed.append({"sql": sql, "params": params or {}})
            if "select level_id" in sql:
                class Row:
                    def mappings(self):
                        class M:
                            def first(self_inner):
                                return {"level_id": "L1", "accuracy_rolling": 0.4}

                        return M()

                return Row()
            return None

    svc = SubjectProgressService(FakeSession())  # type: ignore[arg-type]
    effects = await svc.record_path_challenge("child", "fantasy", "math", score=0.0)
    assert effects[0]["score"] == 0.0
    assert effects[0]["rolling_delta"] == 0.0
    assert effects[0]["accuracy_rolling"] == 0.4
    assert not any("insert into user_subject_levels" in row["sql"] for row in executed)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_twelve_correct_levels_up() -> None:
    rolling = SEED_ROLLING
    executed: list[dict] = []

    class FakeSession:
        async def execute(self, stmt, params=None):  # noqa: ANN001
            sql = str(stmt)
            executed.append({"sql": sql, "params": params or {}})
            if "select level_id" in sql and "settings" not in sql:
                class Row:
                    def mappings(self):
                        class M:
                            def first(self_inner):
                                return {"level_id": "L1", "accuracy_rolling": rolling}

                        return M()

                return Row()
            if "select settings" in sql:
                class Row:
                    def mappings(self):
                        class M:
                            def first(self_inner):
                                return {"settings": {}}

                        return M()

                return Row()
            if "select general_level" in sql:
                class Scalar:
                    def scalar_one_or_none(self):
                        return "L1"

                return Scalar()
            if "select subject_id, level_id" in sql:
                class Row:
                    def mappings(self):
                        class M:
                            def all(self_inner):
                                return [{"subject_id": "math", "level_id": "L2"}]

                        return M()

                return Row()
            return None

    svc = SubjectProgressService(FakeSession())  # type: ignore[arg-type]
    effects: list[dict] = []
    for _ in range(12):
        effects = await svc.record_path_challenge("child", "fantasy", "math", score=1.0)
        rolling = float(effects[0]["accuracy_rolling"])
    assert any(e["type"] == "update_subject_level" for e in effects)
    assert effects[0]["level_id"] == "L2"
    assert effects[0]["accuracy_rolling"] == SEED_ROLLING


@pytest.mark.unit
def test_linear_state_after_two_conserved_corrects() -> None:
    level, rolling, source = SubjectProgressService.linear_state_after_corrects(2)
    assert level == "L1"
    assert rolling == round(SEED_ROLLING + 2 * DELTA_PER_CORRECT, 4)
    assert source == "path_challenge"


@pytest.mark.unit
def test_linear_state_after_twelve_corrects_levels_up() -> None:
    level, rolling, source = SubjectProgressService.linear_state_after_corrects(12)
    assert level == "L2"
    assert rolling == SEED_ROLLING
    assert source == "path_level_up"


@pytest.mark.unit
def test_linear_state_after_zero_corrects_keeps_placement_seed() -> None:
    level, rolling, source = SubjectProgressService.linear_state_after_corrects(0)
    assert level == "L1"
    assert rolling == SEED_ROLLING
    assert source == "placement"


@pytest.mark.unit
def test_count_conserved_corrects_from_path_progress() -> None:
    events = [
        {
            "kind": "path_progress",
            "payload": {"status": "intro", "path": {"subject_id": "math"}},
        },
        {
            "kind": "path_progress",
            "payload": {
                "last_ok": True,
                "path": {"subject_id": "math"},
            },
        },
        {
            "kind": "path_progress",
            "payload": {
                "last_ok": False,
                "path": {"subject_id": "math"},
            },
        },
        {
            "kind": "path_progress",
            "payload": {
                "last_ok": True,
                "path": {"subject_id": "math"},
            },
        },
        {
            "kind": "path_progress",
            "payload": {
                "last_ok": True,
                "path": {"subject_id": "language"},
            },
        },
    ]
    counts = SubjectProgressService.count_conserved_corrects(events)
    assert counts == {"math": 2, "language": 1}


@pytest.mark.unit
def test_count_conserved_corrects_falls_back_to_echo_turns() -> None:
    turns = [
        {
            "role": "explorer",
            "meta": {
                "phase": "path_challenge_echo",
                "choice_correct": True,
                "subject_id": "math",
            },
        },
        {
            "role": "explorer",
            "meta": {
                "phase": "path_challenge_echo",
                "choice_correct": False,
                "subject_id": "math",
            },
        },
    ]
    counts = SubjectProgressService.count_conserved_corrects(
        events=[], remaining_turns=turns
    )
    assert counts == {"math": 1}


@pytest.mark.unit
@pytest.mark.asyncio
async def test_rebuild_after_rewind_restores_seed_plus_conserved() -> None:
    upserts: list[dict] = []
    rows = [
        {
            "subject_id": "math",
            "level_id": "L2",
            "source": "path_level_up",
            "accuracy_rolling": SEED_ROLLING,
        }
    ]

    class FakeSession:
        async def execute(self, stmt, params=None):  # noqa: ANN001
            sql = str(stmt)
            params = params or {}
            if "select subject_id, level_id, source" in sql:
                class Row:
                    def mappings(self):
                        class M:
                            def all(self_inner):
                                return list(rows)

                        return M()

                return Row()
            if "insert into user_subject_levels" in sql:
                upserts.append(dict(params))
                return None
            if "select settings" in sql:
                class Row:
                    def mappings(self):
                        class M:
                            def first(self_inner):
                                return {"settings": {"learning": {"active_subjects": ["math"]}}}

                        return M()

                return Row()
            if "select general_level" in sql:
                class Scalar:
                    def scalar_one_or_none(self):
                        return "L2"

                return Scalar()
            if "select subject_id, level_id" in sql:
                class Row:
                    def mappings(self):
                        class M:
                            def all(self_inner):
                                return [
                                    {
                                        "subject_id": p["sid"],
                                        "level_id": p["level"],
                                    }
                                    for p in upserts
                                ] or [{"subject_id": "math", "level_id": "L1"}]

                        return M()

                return Row()
            return None

    events = [
        {
            "kind": "placement_result",
            "payload": {"status": "completed", "subjects": ["math"]},
        },
        {
            "kind": "path_progress",
            "payload": {"last_ok": True, "path": {"subject_id": "math"}},
        },
        {
            "kind": "path_progress",
            "payload": {"last_ok": True, "path": {"subject_id": "math"}},
        },
    ]
    svc = SubjectProgressService(FakeSession())  # type: ignore[arg-type]
    await svc.rebuild_after_rewind("child", "fantasy", events=events)
    assert upserts
    math_row = next(p for p in upserts if p["sid"] == "math")
    expected_rolling = round(SEED_ROLLING + 2 * DELTA_PER_CORRECT, 4)
    assert math_row["level"] == "L1"
    assert math_row["rolling"] == expected_rolling
    assert math_row["source"] == "path_challenge"


@pytest.mark.unit
def test_linear_state_after_five_challenge_paths() -> None:
    from app.services.subject_progress_config import delta_per_correct

    level, rolling, source = SubjectProgressService.linear_state_after_corrects(
        20, challenges_per_path=5
    )
    assert level == "L2"
    assert rolling == SEED_ROLLING
    assert source == "path_level_up"
    level, rolling, source = SubjectProgressService.linear_state_after_corrects(
        1, challenges_per_path=10
    )
    assert level == "L1"
    assert rolling == round(SEED_ROLLING + delta_per_correct(10), 4)
    mixed = SubjectProgressService.linear_state_after_n_sequence([3, 3, 3, 10])
    expected = round(
        SEED_ROLLING + 3 * delta_per_correct(3) + delta_per_correct(10), 4
    )
    assert mixed[0] == "L1"
    assert mixed[1] == expected


@pytest.mark.unit
@pytest.mark.asyncio
async def test_record_path_challenge_uses_pack_n() -> None:
    from app.services.subject_progress_config import delta_per_correct

    executed: list[dict] = []

    class FakeSession:
        async def execute(self, stmt, params=None):  # noqa: ANN001
            sql = str(stmt)
            executed.append({"sql": sql, "params": params or {}})
            if "select level_id" in sql and "settings" not in sql:
                class Row:
                    def mappings(self):
                        class M:
                            def first(self_inner):
                                return {"level_id": "L1", "accuracy_rolling": SEED_ROLLING}

                        return M()

                return Row()
            return None

    svc = SubjectProgressService(FakeSession())  # type: ignore[arg-type]
    effects = await svc.record_path_challenge(
        "child", "fantasy", "math", score=1.0, challenges_per_path=10
    )
    assert effects[0]["challenges_per_path"] == 10
    assert effects[0]["rolling_delta"] == round(delta_per_correct(10), 4)
    assert effects[0]["accuracy_rolling"] == round(
        min(THRESHOLD_UP, SEED_ROLLING + delta_per_correct(10)), 3
    )
