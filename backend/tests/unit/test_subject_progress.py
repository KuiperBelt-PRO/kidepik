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
