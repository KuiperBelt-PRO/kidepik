from __future__ import annotations

import json
import re
import secrets
import time
from dataclasses import dataclass
from pathlib import Path

from app.config import get_settings

ALLOWED_CATEGORIES = ("avatars", "audio", "pdf", "illustrations", "poc", "dictations")


@dataclass
class UploadPlan:
    upload_url: str
    method: str
    fields: dict[str, str]
    public_url: str
    token: str
    expires_in: int

    def to_dict(self) -> dict:
        return {
            "upload": {
                "url": self.upload_url,
                "method": self.method,
                "fields": self.fields,
            },
            "public_url": self.public_url,
            "expires_in": self.expires_in,
            "token": self.token,
        }


class UploadTokenStore:
    def __init__(self, directory: str) -> None:
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)

    def _path_for(self, token: str) -> Path:
        if not re.fullmatch(r"[a-f0-9]{32}", token):
            raise ValueError("Invalid upload token")
        return self.directory / f"{token}.json"

    def create(
        self,
        user_id: str,
        category: str,
        object_key: str,
        public_url: str,
        ttl_seconds: int,
    ) -> str:
        token = secrets.token_hex(16)
        payload = {
            "user_id": user_id,
            "category": category,
            "object_key": object_key,
            "public_url": public_url,
            "expires_at": int(time.time()) + ttl_seconds,
        }
        self._path_for(token).write_text(json.dumps(payload), encoding="utf-8")
        return token

    def consume(self, token: str) -> dict[str, str] | None:
        path = self._path_for(token)
        if not path.is_file():
            return None
        raw = path.read_text(encoding="utf-8")
        path.unlink(missing_ok=True)
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return None
        if int(data.get("expires_at", 0)) < int(time.time()):
            return None
        return {
            "user_id": str(data.get("user_id", "")),
            "category": str(data.get("category", "")),
            "object_key": str(data.get("object_key", "")),
            "public_url": str(data.get("public_url", "")),
        }


class LocalFilesystemDriver:
    def __init__(self) -> None:
        settings = get_settings()
        self.media_root = Path(settings.media_root)
        self.public_base_url = settings.media_base
        self.tokens = UploadTokenStore(str(self.media_root / ".tokens"))
        self.ttl = settings.upload_token_ttl

    def prepare_upload(self, user_id: str, filename: str, category: str) -> UploadPlan:
        if category not in ALLOWED_CATEGORIES:
            raise ValueError("Invalid media category")
        safe_name = self._sanitize_filename(filename)
        object_key = f"{category}/{user_id}/{secrets.token_hex(8)}-{safe_name}"
        public_url = f"{self.public_base_url}/{object_key}"
        token = self.tokens.create(user_id, category, object_key, public_url, self.ttl)
        return UploadPlan(
            upload_url="/api/v1/storage/upload",
            method="POST",
            fields={"token": token, "category": category},
            public_url=public_url,
            token=token,
            expires_in=self.ttl,
        )

    def complete_upload(self, token: str, tmp_path: Path) -> str:
        meta = self.tokens.consume(token)
        if meta is None:
            raise RuntimeError("Invalid or expired upload token")
        target = self.media_root / meta["object_key"].replace("/", "/")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(tmp_path.read_bytes())
        tmp_path.unlink(missing_ok=True)
        return meta["public_url"]

    def status(self) -> dict:
        writable = self.media_root.is_dir() and self.media_root.stat().st_mode
        try:
            writable = self.media_root.is_dir() and os_access_write(self.media_root)
        except Exception:
            writable = False
        return {
            "ok": bool(writable),
            "driver": "local",
            "root": str(self.media_root),
        }

    @staticmethod
    def _sanitize_filename(filename: str) -> str:
        basename = Path(filename.replace("\\", "_").replace("/", "_")).name
        cleaned = re.sub(r"[^a-zA-Z0-9._-]", "_", basename) or "upload.bin"
        return cleaned


def os_access_write(path: Path) -> bool:
    import os

    return os.access(path, os.W_OK)


def create_storage_driver() -> LocalFilesystemDriver:
    settings = get_settings()
    if settings.storage_driver != "local":
        raise RuntimeError(f"Unsupported STORAGE_DRIVER={settings.storage_driver}")
    return LocalFilesystemDriver()
