from __future__ import annotations

import hashlib
import re
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.config import get_settings
from app.db import get_engine

ADVISORY_LOCK_KEY = 42420107
FILE_PATTERN = re.compile(r"^(\d{14})_([a-z0-9_]+)\.sql$")


class MigrationError(Exception):
    def __init__(self, message: str, version: str | None = None) -> None:
        super().__init__(message)
        self.version = version


class MigrationRunner:
    _ensured_state_key: str | None = None
    _ensured_fs_fingerprint: str | None = None

    def __init__(self, engine: AsyncEngine | None, migrations_dir: str) -> None:
        self.engine = engine
        self.migrations_dir = migrations_dir

    @classmethod
    def from_env(cls) -> MigrationRunner:
        settings = get_settings()
        return cls(get_engine(), settings.migrations_dir)

    @classmethod
    def reset_cache_for_tests(cls) -> None:
        cls._ensured_state_key = None
        cls._ensured_fs_fingerprint = None

    def discover_files(self) -> dict[str, list[Any]]:
        root = Path(self.migrations_dir)
        valid: list[dict[str, str]] = []
        invalid: list[str] = []
        if not root.is_dir():
            return {"valid": [], "invalid": []}
        for path in sorted(root.glob("*.sql")):
            match = FILE_PATTERN.match(path.name)
            if not match:
                invalid.append(path.name)
                continue
            valid.append(
                {
                    "version": match.group(1),
                    "name": match.group(2),
                    "file": path.name,
                    "path": str(path),
                }
            )
        valid.sort(key=lambda item: item["version"])
        return {"valid": valid, "invalid": invalid}

    def migrations_fingerprint(self) -> str:
        root = Path(self.migrations_dir)
        if not root.is_dir():
            return ""
        parts: list[str] = []
        for path in root.glob("*.sql"):
            mtime = path.stat().st_mtime if path.exists() else 0
            parts.append(f"{path.name}:{int(mtime)}")
        parts.sort()
        return hashlib.sha256("\n".join(parts).encode()).hexdigest()

    async def ensure_applied(self) -> None:
        if self.engine is None:
            return
        fingerprint = self.migrations_fingerprint()
        if self.__class__._ensured_fs_fingerprint == fingerprint:
            return
        async with self.engine.connect() as conn:
            state_key = await self._migration_state_key(conn)
            if self.__class__._ensured_state_key == state_key:
                self.__class__._ensured_fs_fingerprint = fingerprint
                return
            await conn.execute(text(f"SELECT pg_advisory_lock({ADVISORY_LOCK_KEY})"))
            try:
                await self._ensure_history_table(conn)
                applied = await self._applied_versions(conn)
                discovered = self.discover_files()
                for migration in discovered["valid"]:
                    if migration["version"] in applied:
                        continue
                    await self._apply_one(conn, migration)
                await conn.commit()
            finally:
                try:
                    await conn.execute(text(f"SELECT pg_advisory_unlock({ADVISORY_LOCK_KEY})"))
                except Exception:
                    pass
            self.__class__._ensured_state_key = await self._migration_state_key(conn)
            self.__class__._ensured_fs_fingerprint = fingerprint

    async def status(self) -> dict[str, Any]:
        relative = "supabase/migrations"
        root = Path(self.migrations_dir)
        if not root.is_dir():
            return {
                "ok": False,
                "directory": relative,
                "error": "migrations_dir_missing",
                "applied": [],
                "pending": [],
                "invalid_files": [],
            }
        discovered = self.discover_files()
        if self.engine is None:
            pending = [
                {
                    "version": m["version"],
                    "name": m["name"],
                    "file": m["file"],
                }
                for m in discovered["valid"]
            ]
            return {
                "ok": True,
                "directory": relative,
                "skipped": True,
                "applied": [],
                "pending": pending,
                "invalid_files": discovered["invalid"],
            }
        try:
            async with self.engine.connect() as conn:
                await self._ensure_history_table(conn)
                applied_map = await self._applied_rows(conn)
                await conn.commit()
        except Exception as exc:
            return {
                "ok": False,
                "directory": relative,
                "error": str(exc),
                "applied": [],
                "pending": [],
                "invalid_files": discovered["invalid"],
            }
        pending = []
        for migration in discovered["valid"]:
            if migration["version"] not in applied_map:
                pending.append(
                    {
                        "version": migration["version"],
                        "name": migration["name"],
                        "file": migration["file"],
                    }
                )
        return {
            "ok": True,
            "directory": relative,
            "applied": list(applied_map.values()),
            "pending": pending,
            "invalid_files": discovered["invalid"],
        }

    async def _ensure_history_table(self, conn: Any) -> None:
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS supabase_migrations"))
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
                    version text PRIMARY KEY
                )
                """
            )
        )
        await conn.execute(
            text(
                """
                ALTER TABLE supabase_migrations.schema_migrations
                ADD COLUMN IF NOT EXISTS name text
                """
            )
        )
        await conn.execute(
            text(
                """
                ALTER TABLE supabase_migrations.schema_migrations
                ADD COLUMN IF NOT EXISTS applied_at timestamptz NOT NULL DEFAULT now()
                """
            )
        )

    async def _applied_versions(self, conn: Any) -> dict[str, bool]:
        rows = await self._applied_rows(conn)
        return {version: True for version in rows}

    async def _applied_rows(self, conn: Any) -> dict[str, dict[str, Any]]:
        result = await conn.execute(
            text(
                """
                SELECT version, name, applied_at
                FROM supabase_migrations.schema_migrations
                ORDER BY version ASC
                """
            )
        )
        mapping: dict[str, dict[str, Any]] = {}
        for row in result.mappings():
            version = str(row["version"] or "")
            if not version:
                continue
            applied_at = row["applied_at"]
            mapping[version] = {
                "version": version,
                "name": str(row["name"] or ""),
                "applied_at": str(applied_at) if applied_at is not None else None,
            }
        return mapping

    async def _migration_state_key(self, conn: Any) -> str:
        fingerprint = self.migrations_fingerprint()
        try:
            result = await conn.execute(
                text(
                    """
                    SELECT count(*)::text, coalesce(max(version), '')
                    FROM supabase_migrations.schema_migrations
                    """
                )
            )
            row = result.one()
            return f"{fingerprint}:{row[0]}:{row[1]}"
        except Exception:
            return f"{fingerprint}:error"

    async def _apply_one(self, conn: Any, migration: dict[str, str]) -> None:
        sql = Path(migration["path"]).read_text(encoding="utf-8")
        try:
            # Multi-statement SQL files: use DBAPI raw connection.
            raw = await conn.get_raw_connection()
            driver_conn = raw.driver_connection
            await driver_conn.execute(sql)
            await conn.execute(
                text(
                    """
                    INSERT INTO supabase_migrations.schema_migrations (version, name)
                    VALUES (:version, :name)
                    ON CONFLICT (version) DO NOTHING
                    """
                ),
                {"version": migration["version"], "name": migration["name"]},
            )
        except Exception as exc:
            raise MigrationError(
                f"Migration failed: {migration['version']}",
                migration["version"],
            ) from exc
