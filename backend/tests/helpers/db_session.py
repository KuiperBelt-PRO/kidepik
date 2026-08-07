from __future__ import annotations

from collections.abc import Callable
from typing import Any


class FakeIterableResult:
    """Resultado SQLAlchemy iterable (p. ej. list_resettable_children)."""

    def __init__(self, rows: list[Any]) -> None:
        self._rows = rows

    def __iter__(self):
        return iter(self._rows)


class FakeMappingsResult:
    def __init__(self, rows: Any) -> None:
        if rows is None:
            self._rows: list[Any] = []
        elif isinstance(rows, list):
            self._rows = rows
        else:
            self._rows = [rows]

    def first(self) -> Any:
        return self._rows[0] if self._rows else None

    def all(self) -> list[Any]:
        return self._rows

    def one(self) -> Any:
        if not self._rows:
            raise RuntimeError("No row returned")
        return self._rows[0]


class FakeExecuteResult:
    def __init__(self, rows: Any = None, scalar: Any = None, rowcount: int = 1) -> None:
        self._rows = rows
        self._scalar = scalar
        self.rowcount = rowcount

    def mappings(self) -> FakeMappingsResult:
        return FakeMappingsResult(self._rows)

    def scalar(self) -> Any:
        return self._scalar

    def scalar_one(self) -> Any:
        if self._scalar is not None:
            return self._scalar
        row = self.mappings().one()
        if isinstance(row, dict):
            return next(iter(row.values()))
        return row

    def scalar_one_or_none(self) -> Any:
        return self._scalar


ExecuteHandler = Callable[[Any, dict[str, Any] | None], FakeExecuteResult]


class ScriptedSession:
    """Sesión async con respuestas encadenadas para `session.execute`."""

    def __init__(self, results: list[FakeExecuteResult | ExecuteHandler]) -> None:
        self._results = results
        self._index = 0
        self.executed: list[tuple[Any, dict[str, Any] | None]] = []

    async def execute(self, stmt: Any, params: dict[str, Any] | None = None) -> FakeExecuteResult:
        self.executed.append((stmt, params))
        if self._index >= len(self._results):
            return FakeExecuteResult()
        item = self._results[self._index]
        self._index += 1
        if callable(item):
            return item(stmt, params)
        return item

    async def commit(self) -> None:
        return None
