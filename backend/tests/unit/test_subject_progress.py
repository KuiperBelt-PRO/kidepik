from __future__ import annotations

import pytest

from app.services.subject_progress import SubjectProgressService


@pytest.mark.unit
def test_blend_rolling_moves_toward_score() -> None:
    first = SubjectProgressService._blend_rolling(0.5, 1.0)
    second = SubjectProgressService._blend_rolling(first, 1.0)
    third = SubjectProgressService._blend_rolling(second, 1.0)
    assert first > 0.5
    assert third >= SubjectProgressService.THRESHOLD_UP


@pytest.mark.unit
def test_rank_id_for_general_fantasy_l2() -> None:
    assert SubjectProgressService._rank_id_for_general("fantasy", "L2") == "fantasy_apprentice"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_record_path_challenge_updates_row(monkeypatch) -> None:
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
                                return {"level_id": "L1", "accuracy_rolling": 0.5}

                        return M()

                return Row()
            return None

    svc = SubjectProgressService(FakeSession())  # type: ignore[arg-type]
    effect = await svc.record_path_challenge("child", "fantasy", "reading", score=1.0)
    assert effect["type"] == "record_learning_result"
    assert effect["subject_id"] == "reading"
    assert effect["accuracy_rolling"] > 0.5
    assert any("insert into user_subject_levels" in row["sql"] for row in executed)
