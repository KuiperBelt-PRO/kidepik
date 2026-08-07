from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.helpers.factories import CHILD_ID, PARENT_ID, sample_crew_member
from tests.helpers.http import assert_auth_error, assert_status


@pytest.mark.contract
@pytest.mark.asyncio
async def test_crew_list_ok(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
    mock_crew_service,
) -> None:
    body = assert_status(await client.get("/api/v1/crew", headers=auth_headers), 200)
    assert body["member_count"] == 1
    assert len(body["members"]) == 2


@pytest.mark.contract
@pytest.mark.asyncio
async def test_crew_create_ok(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
    mock_crew_service,
) -> None:
    body = assert_status(
        await client.post("/api/v1/crew", json={"tutor_label": "Mamá"}, headers=auth_headers),
        201,
    )
    assert body["id"] == CHILD_ID


@pytest.mark.contract
@pytest.mark.asyncio
async def test_crew_show_ok(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
    mock_crew_service,
) -> None:
    body = assert_status(
        await client.get(f"/api/v1/crew/{CHILD_ID}", headers=auth_headers),
        200,
    )
    assert body["display_name"] == "Ada"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_crew_show_not_found(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
    mock_crew_service,
    mocker,
) -> None:
    mock_crew_service.get_for_auth_user = mocker.AsyncMock(
        side_effect=RuntimeError("Crew member not found")
    )
    body = assert_status(
        await client.get(f"/api/v1/crew/{CHILD_ID}", headers=auth_headers),
        404,
    )
    assert body["detail"] == "Crew member not found"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_crew_update_requires_body(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
) -> None:
    body = assert_status(
        await client.patch(f"/api/v1/crew/{CHILD_ID}", headers=auth_headers),
        422,
    )
    assert body["detail"] == "Body required"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_crew_update_ok(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
    mock_crew_service,
) -> None:
    body = assert_status(
        await client.patch(
            f"/api/v1/crew/{CHILD_ID}",
            json={"display_name": "Ada actualizada"},
            headers=auth_headers,
        ),
        200,
    )
    assert body["display_name"] == "Ada"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_crew_verify_exit_pin_forbidden(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
    mock_crew_service,
    mocker,
) -> None:
    mock_crew_service.verify_exit_pin_for_auth_user = mocker.AsyncMock(return_value={"ok": False})
    body = assert_status(
        await client.post(
            f"/api/v1/crew/{CHILD_ID}/verify-exit-pin",
            json={"pin": "0000"},
            headers=auth_headers,
        ),
        403,
    )
    assert body["detail"] == "PIN incorrecto"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_crew_tutor_report_rejects_tutor_profile(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
    mock_crew_service,
    mocker,
) -> None:
    mock_crew_service.get_for_auth_user = mocker.AsyncMock(
        return_value={**sample_crew_member(is_tutor=True), "is_tutor_profile": True}
    )
    body = assert_status(
        await client.post(f"/api/v1/crew/{CHILD_ID}/tutor-report", headers=auth_headers),
        422,
    )
    assert "tutor" in body["detail"].lower()


@pytest.mark.contract
@pytest.mark.asyncio
async def test_crew_permissions_update_ok(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
    mock_crew_service,
) -> None:
    body = assert_status(
        await client.patch(
            f"/api/v1/crew/{CHILD_ID}/permissions",
            json={"font_scale_play": "lg"},
            headers=auth_headers,
        ),
        200,
    )
    assert body["permissions"]["require_exit_pin"] is True


@pytest.mark.contract
@pytest.mark.asyncio
async def test_crew_permissions_requires_body(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
) -> None:
    body = assert_status(
        await client.patch(f"/api/v1/crew/{CHILD_ID}/permissions", headers=auth_headers),
        422,
    )
    assert body["detail"] == "Body required"


@pytest.mark.contract
@pytest.mark.asyncio
async def test_crew_delete_ok(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
    mock_crew_service,
) -> None:
    body = assert_status(
        await client.request(
            "DELETE",
            f"/api/v1/crew/{CHILD_ID}",
            json={"confirm": True},
            headers=auth_headers,
        ),
        200,
    )
    assert body["deleted"] is True


@pytest.mark.contract
@pytest.mark.asyncio
async def test_crew_verify_exit_pin_ok(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
    mock_crew_service,
) -> None:
    body = assert_status(
        await client.post(
            f"/api/v1/crew/{CHILD_ID}/verify-exit-pin",
            json={"pin": "1234"},
            headers=auth_headers,
        ),
        200,
    )
    assert body["ok"] is True


@pytest.mark.contract
@pytest.mark.asyncio
async def test_crew_tutor_report_ok(
    client: AsyncClient,
    mock_auth,
    auth_headers,
    mock_parent_service,
    mock_crew_service,
    mocker,
) -> None:
    mock_crew_service.get_for_auth_user = mocker.AsyncMock(
        return_value={
            **sample_crew_member(),
            "progress": {"general_level": "L1"},
            "settings": {"learning": {"weak_spots": []}},
        }
    )
    mocker.patch(
        "app.services.parents.ParentAccountService"
    ).return_value.find_by_auth_user_id = mocker.AsyncMock(
        return_value={"parent_id": PARENT_ID}
    )
    mocker.patch(
        "app.services.tutor_reports.TutorReportService"
    ).return_value.write_evaluation_report = mocker.Mock(
        return_value={"filename": "report.md", "body": "Informe"}
    )
    body = assert_status(
        await client.post(f"/api/v1/crew/{CHILD_ID}/tutor-report", headers=auth_headers),
        200,
    )
    assert body["ok"] is True
    assert body["filename"] == "report.md"
