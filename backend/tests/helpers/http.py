from __future__ import annotations

from typing import Any

from httpx import Response


def assert_status(response: Response, expected: int) -> dict[str, Any]:
    assert response.status_code == expected, response.text
    return response.json()


def assert_auth_error(response: Response) -> None:
    body = assert_status(response, 401)
    assert "detail" in body
