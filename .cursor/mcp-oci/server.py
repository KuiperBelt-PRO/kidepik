"""MCP stdio: operaciones Oracle Cloud Infrastructure para KidepiK."""

from __future__ import annotations

import json
import shlex
import subprocess
import sys
from pathlib import Path
from typing import Any

from fastmcp import FastMCP

from env_loader import get_settings
from oci_client import OciKidepikClient

mcp = FastMCP(name="oci-kidepik")

_CLI_ALLOWLIST_PREFIXES: tuple[tuple[str, ...], ...] = (
    ("iam", "region", "list"),
    ("iam", "availability-domain", "list"),
    ("iam", "user", "get"),
    ("compute", "instance", "list"),
    ("compute", "image", "list"),
    ("network", "vcn", "list"),
    ("network", "subnet", "list"),
)


def _client() -> OciKidepikClient:
    return OciKidepikClient()


def _cli_allowed(args: list[str]) -> bool:
    if not args:
        return False
    for prefix in _CLI_ALLOWLIST_PREFIXES:
        if tuple(args[: len(prefix)]) == prefix:
            return True
    return False


@mcp.tool
def oci_status() -> dict[str, Any]:
    """Comprueba autenticación OCI, región y availability domains."""
    try:
        return _client().status()
    except Exception as exc:
        return {"ok": False, "data": None, "error": str(exc), "error_code": "CONFIG_ERROR"}


@mcp.tool
def oci_list_instances(name_prefix: str = "kidepik") -> dict[str, Any]:
    """Lista instancias compute cuyo display_name empieza por name_prefix."""
    return _client().list_instances(name_prefix=name_prefix)


@mcp.tool
def oci_network_ensure() -> dict[str, Any]:
    """Crea VCN kidepik-vcn, IGW, rutas y subnet pública si no existen."""
    return _client().network_ensure()


@mcp.tool
def oci_launch_arm_instance(
    display_name: str = "kidepik-mvp",
    ocpus: float = 1.0,
    memory_gb: float = 6.0,
    availability_domain: str = "",
) -> dict[str, Any]:
    """Lanza VM ARM Always Free (VM.Standard.A1.Flex). Idempotente si ya existe."""
    return _client().launch_arm_instance(
        display_name=display_name,
        ocpus=ocpus,
        memory_gb=memory_gb,
        availability_domain=availability_domain,
    )


@mcp.tool
def oci_retry_launch_arm(
    max_attempts: int = 5,
    interval_seconds: int = 60,
    display_name: str = "kidepik-mvp",
) -> dict[str, Any]:
    """Reintenta lanzamiento ARM ante Out of capacity (bloquea hasta max_attempts * interval)."""
    return _client().retry_launch_arm(
        max_attempts=max_attempts,
        interval_seconds=interval_seconds,
        display_name=display_name,
    )


@mcp.tool
def oci_instance_get(display_name: str = "kidepik-mvp", instance_id: str = "") -> dict[str, Any]:
    """Estado e IP pública de una instancia por nombre o OCID."""
    return _client().instance_get(display_name=display_name, instance_id=instance_id)


def _oci_executable() -> str:
    venv_oci = Path(sys.executable).with_name("oci.exe")
    if venv_oci.is_file():
        return str(venv_oci)
    return "oci"


@mcp.tool
def oci_run_cli(command: str) -> dict[str, Any]:
    """Ejecuta subcomando oci de solo lectura (allowlist). Ej: 'compute instance list --compartment-id ...'."""
    try:
        settings = get_settings()
        tokens = shlex.split(command, posix=False)
        if not _cli_allowed(tokens):
            return {
                "ok": False,
                "data": None,
                "error": "Comando no permitido. Solo subcomandos read-only en allowlist.",
                "error_code": "CLI_DENIED",
            }
        full_cmd = [
            _oci_executable(),
            "--config-file",
            str(settings.config_file),
            *tokens,
        ]
        proc = subprocess.run(
            full_cmd,
            capture_output=True,
            text=True,
            check=False,
            timeout=120,
        )
        if proc.returncode != 0:
            return {
                "ok": False,
                "data": {"stderr": proc.stderr.strip()[:2000]},
                "error": proc.stderr.strip() or f"oci exit {proc.returncode}",
                "error_code": "CLI_FAILED",
            }
        try:
            parsed = json.loads(proc.stdout) if proc.stdout.strip() else {}
        except json.JSONDecodeError:
            parsed = {"raw": proc.stdout[:4000]}
        return {"ok": True, "data": parsed, "error": None}
    except Exception as exc:
        return {"ok": False, "data": None, "error": str(exc), "error_code": "CLI_ERROR"}


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
