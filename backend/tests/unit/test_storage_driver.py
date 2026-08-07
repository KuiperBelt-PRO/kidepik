from __future__ import annotations

import json
import time

import pytest

from app.storage import LocalFilesystemDriver, UploadTokenStore


@pytest.mark.unit
def test_upload_token_store_roundtrip(tmp_path) -> None:
    store = UploadTokenStore(str(tmp_path))
    token = store.create("user-1", "avatars", "avatars/u/file.png", "/media/x.png", 60)
    meta = store.consume(token)
    assert meta is not None
    assert meta["object_key"] == "avatars/u/file.png"
    assert store.consume(token) is None


@pytest.mark.unit
def test_upload_token_store_rejects_invalid_token(tmp_path) -> None:
    store = UploadTokenStore(str(tmp_path))
    with pytest.raises(ValueError, match="Invalid upload token"):
        store.consume("not-a-token")


@pytest.mark.unit
def test_upload_token_store_expired(tmp_path) -> None:
    store = UploadTokenStore(str(tmp_path))
    token = store.create("user-1", "poc", "poc/u/file.png", "/media/x.png", 1)
    path = store._path_for(token)
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["expires_at"] = int(time.time()) - 5
    path.write_text(json.dumps(payload), encoding="utf-8")
    assert store.consume(token) is None


@pytest.mark.unit
def test_local_filesystem_prepare_upload(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path / "media"))
    monkeypatch.setenv("STORAGE_DRIVER", "local")
    from app.config import get_settings

    get_settings.cache_clear()
    driver = LocalFilesystemDriver()
    plan = driver.prepare_upload("user-1", "avatar.png", "avatars")
    assert plan.public_url.startswith("/media/avatars/")
    assert plan.token
    get_settings.cache_clear()


@pytest.mark.unit
def test_upload_plan_to_dict(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path / "media"))
    from app.config import get_settings
    from app.storage import UploadPlan

    get_settings.cache_clear()
    plan = UploadPlan(
        upload_url="/upload",
        method="POST",
        fields={"token": "abc"},
        public_url="/media/x.png",
        token="abc",
        expires_in=60,
    )
    body = plan.to_dict()
    assert body["public_url"] == "/media/x.png"
    get_settings.cache_clear()


@pytest.mark.unit
def test_local_filesystem_invalid_category(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path / "media"))
    from app.config import get_settings
    from app.storage import LocalFilesystemDriver

    get_settings.cache_clear()
    driver = LocalFilesystemDriver()
    with pytest.raises(ValueError, match="Invalid media category"):
        driver.prepare_upload("user-1", "file.png", "invalid")
    get_settings.cache_clear()


@pytest.mark.unit
def test_local_filesystem_complete_upload(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path / "media"))
    from app.config import get_settings
    from app.storage import LocalFilesystemDriver

    get_settings.cache_clear()
    driver = LocalFilesystemDriver()
    plan = driver.prepare_upload("user-1", "avatar.png", "avatars")
    tmp_file = tmp_path / "upload.bin"
    tmp_file.write_bytes(b"data")
    public_url = driver.complete_upload(plan.token, tmp_file)
    assert public_url.endswith(".png")
    get_settings.cache_clear()


@pytest.mark.unit
def test_create_storage_driver(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("MEDIA_ROOT", str(tmp_path / "media"))
    monkeypatch.setenv("STORAGE_DRIVER", "local")
    from app.config import get_settings
    from app.storage import create_storage_driver

    get_settings.cache_clear()
    driver = create_storage_driver()
    assert driver.status()["driver"] == "local"
    get_settings.cache_clear()


@pytest.mark.unit
def test_upload_token_invalid_json(tmp_path) -> None:
    store = UploadTokenStore(str(tmp_path))
    token = store.create("user-1", "poc", "poc/u/file.png", "/media/x.png", 60)
    path = store._path_for(token)
    path.write_text("{bad json", encoding="utf-8")
    assert store.consume(token) is None
