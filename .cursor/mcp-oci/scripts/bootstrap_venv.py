#!/usr/bin/env python3
"""Crea el venv MCP con uv e instala dependencias (sustituye scripts PowerShell)."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
VENV_DIR = REPO_ROOT / ".cursor" / ".venv-mcp"
REQUIREMENTS = REPO_ROOT / ".cursor" / "mcp-oci" / "requirements-mcp.txt"
PYTHON = VENV_DIR / "Scripts" / "python.exe"
SMOKE = REPO_ROOT / ".cursor" / "mcp-oci" / "scripts" / "smoke_test.py"


def _run(cmd: list[str]) -> None:
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, cwd=REPO_ROOT)


def main() -> int:
    os.environ["KIDEPIK_REPO"] = str(REPO_ROOT)
    uv = [sys.executable, "-m", "uv"]
    _run([*uv, "venv", str(VENV_DIR), "--clear"])
    _run([*uv, "pip", "install", "-r", str(REQUIREMENTS), "--python", str(PYTHON)])
    _run([str(PYTHON), str(SMOKE)])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
